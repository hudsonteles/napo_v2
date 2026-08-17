/**
 * Regra de exibição da disponibilidade (RN13/RN14). Pura e testável: recebe a
 * resposta de `GET /api/disponibilidade` e decide o que o card/página mostra —
 * disponível, escasso, ou esgotado com rota para a próxima fornada com estoque.
 * A ilha cliente só renderiza o que esta função decide.
 */
export interface DiaDisponibilidade {
  data: string; // YYYY-MM-DD
  cutoff: string; // ISO
  modo: string;
  capacidadeRestante?: number;
  produtos: { produtoId: string; disponivel: number }[];
}

export type EstadoProduto =
  | { tipo: 'disponivel'; quantidade: number; escasso: boolean }
  | { tipo: 'esgotado'; proxima: { data: string; quantidade: number } | null };

/** Abaixo disto a tela mostra o número como "última chamada" — verdade, não urgência fabricada. */
export const LIMIAR_ESCASSO = 5;

function disponivelDe(dia: DiaDisponibilidade | undefined, produtoId: string): number {
  return dia?.produtos.find((p) => p.produtoId === produtoId)?.disponivel ?? 0;
}

export function estadoDoProduto(
  dias: DiaDisponibilidade[],
  dataAtiva: string,
  produtoId: string,
): EstadoProduto {
  const naAtiva = disponivelDe(
    dias.find((d) => d.data === dataAtiva),
    produtoId,
  );
  if (naAtiva > 0) {
    return { tipo: 'disponivel', quantidade: naAtiva, escasso: naAtiva <= LIMIAR_ESCASSO };
  }

  // Esgotado na fornada ativa: oferece a próxima fornada com estoque (RN14/T4).
  const proximas = dias
    .filter((d) => d.data > dataAtiva)
    .sort((a, b) => a.data.localeCompare(b.data));
  for (const dia of proximas) {
    const q = disponivelDe(dia, produtoId);
    if (q > 0) return { tipo: 'esgotado', proxima: { data: dia.data, quantidade: q } };
  }
  return { tipo: 'esgotado', proxima: null }; // sem estoque em fornada nenhuma (T23)
}

/**
 * Fornada ativa (RN13): a data pedida na URL se ainda existe no horizonte; senão
 * a primeira que o motor oferece. É o que faz a seleção "cair para a próxima
 * válida" quando o cutoff passa e a data sai da lista (T22).
 */
export function fornadaAtiva(dias: DiaDisponibilidade[], entregaParam: string | null): string | null {
  if (entregaParam && dias.some((d) => d.data === entregaParam)) return entregaParam;
  return dias[0]?.data ?? null;
}

/** "2026-08-21" → "21.08" (assinatura tipográfica da fornada, design §4.4.5). */
export function formatarDiaMes(data: string): string {
  const [, mes, dia] = data.split('-');
  return `${dia}.${mes}`;
}

/** Total de pizzas ainda disponíveis num dia — soma dos produtos, limitada pelo teto. */
export function pizzasDisponiveis(dia: DiaDisponibilidade): number {
  const somaProdutos = dia.produtos.reduce((s, p) => s + p.disponivel, 0);
  return dia.capacidadeRestante != null ? Math.min(dia.capacidadeRestante, somaProdutos) : somaProdutos;
}
