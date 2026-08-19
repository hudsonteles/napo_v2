import type { ItemCarrinho } from '@napo/core';

/**
 * Lógica pura da tela do carrinho — sem React, testável em node (mesmo motivo do
 * bloco F: o runner é `environment: 'node'`). Junta o que o navegador guarda
 * (id + quantidade), o que o catálogo exibe (nome, faixa, foto) e o que o
 * servidor revalida (preço e disponibilidade atuais, RN3), e decide se o
 * carrinho pode avançar para o checkout.
 */

/** Dado de exibição vindo do catálogo (servidor), estável entre revalidações. */
export interface ProdutoParaExibir {
  produtoId: string;
  nome: string;
  faixaNome: string;
  pesoG: number | null;
  fotoUrl: string | null;
}

/** Um item como `POST /api/carrinho/validar` devolve (preço e vaga atuais). */
export interface ItemRevalidado {
  produtoId: string;
  precoUnitarioCentavos: number;
  disponivel: number;
  esgotado: boolean;
}

export interface LinhaCarrinho {
  produtoId: string;
  nome: string;
  faixaNome: string;
  pesoG: number | null;
  fotoUrl: string | null;
  quantidade: number;
  /** `null` enquanto a revalidação não chegou — o preço não é inventado no cliente. */
  precoUnitarioCentavos: number | null;
  totalLinhaCentavos: number | null;
  disponivel: number | null;
  esgotado: boolean;
}

export interface VistaCarrinho {
  linhas: LinhaCarrinho[];
  subtotalCentavos: number | null;
  temEsgotado: boolean;
  /** Só true com revalidação feita, carrinho não-vazio e nenhum item esgotado (T41). */
  podeFinalizar: boolean;
}

export function montarVistaCarrinho(
  itens: ItemCarrinho[],
  catalogo: ProdutoParaExibir[],
  revalidacao: ItemRevalidado[] | null,
): VistaCarrinho {
  const porCatalogo = new Map(catalogo.map((c) => [c.produtoId, c]));
  const porRevalidado = revalidacao ? new Map(revalidacao.map((r) => [r.produtoId, r])) : null;

  const linhas: LinhaCarrinho[] = itens
    .map((item): LinhaCarrinho | null => {
      const cat = porCatalogo.get(item.produtoId);
      // Produto que saiu do catálogo não vira linha: melhor sumir do que exibir lixo.
      if (!cat) return null;

      const rev = porRevalidado?.get(item.produtoId) ?? null;
      const preco = rev?.precoUnitarioCentavos ?? null;

      return {
        produtoId: item.produtoId,
        nome: cat.nome,
        faixaNome: cat.faixaNome,
        pesoG: cat.pesoG,
        fotoUrl: cat.fotoUrl,
        quantidade: item.quantidade,
        precoUnitarioCentavos: preco,
        totalLinhaCentavos: preco === null ? null : preco * item.quantidade,
        disponivel: rev?.disponivel ?? null,
        esgotado: rev?.esgotado ?? false,
      };
    })
    .filter((l): l is LinhaCarrinho => l !== null);

  const revalidado = porRevalidado !== null;
  const temEsgotado = linhas.some((l) => l.esgotado);
  const subtotalCentavos = revalidado
    ? linhas.reduce((soma, l) => soma + (l.totalLinhaCentavos ?? 0), 0)
    : null;

  // O checkout não avança sem a decisão do cliente sobre o item esgotado (T41),
  // nem antes de a revalidação confirmar preço e vaga (RN3).
  const podeFinalizar = revalidado && linhas.length > 0 && !temEsgotado;

  return { linhas, subtotalCentavos, temEsgotado, podeFinalizar };
}

export function formatarCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** "2026-08-22" → "sexta-feira, 22 de agosto" (bloco da fornada, RN2). */
export function formatarFornadaExtenso(data: string): string {
  // Meio-dia evita rollover de fuso; só dia/mês/semana são lidos.
  const d = new Date(`${data}T12:00:00`);
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
}

/** "2026-08-22" → "22/08" (para a marca de esgotado na fornada). */
export function formatarDiaBarra(data: string): string {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}
