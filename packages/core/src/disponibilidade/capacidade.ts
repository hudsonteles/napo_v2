import { hojeEmBrasilia, somarDias } from '../tempo';
import { calcularCutoff, produzEm } from './cutoff';
import { diasDeEntregaDoHorizonte } from './janela';
import type {
  DataCalendario,
  DisponibilidadeDia,
  DisponibilidadeProduto,
  ModoPromessa,
  Snapshot,
} from './tipos';

/** Dias de produção no intervalo `[inicio, fim)` — a produção termina antes da entrega. */
function diasDeProducaoEntre(
  inicio: DataCalendario,
  fim: DataCalendario,
  snapshot: Snapshot,
): number {
  let total = 0;
  for (let dia = inicio; dia < fim; dia = somarDias(dia, 1)) {
    if (produzEm(dia, snapshot)) total += 1;
  }
  return total;
}

function somar<T>(itens: T[], valor: (item: T) => number): number {
  return itens.reduce((total, item) => total + valor(item), 0);
}

function consumoDoDia(dia: DataCalendario, snapshot: Snapshot, produtoId?: string): number {
  return somar(
    snapshot.consumos.filter(
      (c) => c.diaEntrega === dia && (produtoId === undefined || c.produtoId === produtoId),
    ),
    (c) => c.quantidade,
  );
}

/** Lotes válidos para o dia: dentro da validade e livres ou já casados com ele. */
function estoqueAlocavel(dia: DataCalendario, snapshot: Snapshot, produtoId: string): number {
  return somar(
    snapshot.lotes.filter(
      (l) =>
        l.produtoId === produtoId &&
        l.validade >= dia &&
        (l.diaEntregaAlocado === null || l.diaEntregaAlocado === dia),
    ),
    (l) => l.quantidade,
  );
}

/** Somente o que já está pronto e reservado para o dia — a promessa do ATP. */
function lotesProntosDoDia(dia: DataCalendario, snapshot: Snapshot, produtoId: string): number {
  return somar(
    snapshot.lotes.filter(
      (l) => l.produtoId === produtoId && l.validade >= dia && l.diaEntregaAlocado === dia,
    ),
    (l) => l.quantidade,
  );
}

/**
 * Vagas ainda produzíveis para um dia de entrega (RN7).
 *
 * **Dois tetos, não um.** O forno limita o fluxo diário; o freezer limita o
 * acúmulo. Com um único dia de entrega por semana, é o freezer que aperta
 * primeiro — cinco dias de produção acumulam exatamente a sua capacidade.
 */
export function capacidadeRestante(dia: DataCalendario, snapshot: Snapshot): number {
  const hoje = hojeEmBrasilia(snapshot.agora);
  const { tetoFornoDia, capacidadeFreezer } = snapshot.config;

  const planejadoAteODia = somar(
    snapshot.producaoPlanejada.filter((p) => p.data >= hoje && p.data < dia),
    (p) => p.quantidade,
  );

  const limiteForno = tetoFornoDia * diasDeProducaoEntre(hoje, dia, snapshot) - planejadoAteODia;

  const estoqueEmFreezer = somar(snapshot.lotes, (l) => l.quantidade);
  const limiteFreezer = capacidadeFreezer - estoqueEmFreezer - planejadoAteODia;

  return Math.max(0, Math.min(limiteForno, limiteFreezer) - consumoDoDia(dia, snapshot));
}

/** Ocupação do dia contra o teto de forno, em pontos percentuais. */
function ocupacaoPct(dia: DataCalendario, snapshot: Snapshot): number {
  return (consumoDoDia(dia, snapshot) / snapshot.config.tetoFornoDia) * 100;
}

function disponibilidadeDoDia(dia: DataCalendario, snapshot: Snapshot): DisponibilidadeDia {
  const cutoff = calcularCutoff(dia, snapshot);
  const modo: ModoPromessa = snapshot.agora.getTime() < cutoff.getTime() ? 'CTP' : 'ATP';
  const capacidade = modo === 'CTP' ? capacidadeRestante(dia, snapshot) : 0;
  const massaForaDoCatalogo = ocupacaoPct(dia, snapshot) > snapshot.config.limiteOcupacaoMassaPct;

  const produtos: DisponibilidadeProduto[] = snapshot.produtos.map((produto) => {
    const base =
      modo === 'CTP'
        ? capacidade + estoqueAlocavel(dia, snapshot, produto.id)
        : lotesProntosDoDia(dia, snapshot, produto.id);

    if (!produto.ehMassa) return { produtoId: produto.id, disponivel: base };

    // Massa consome vaga igual a uma pizza e rende R$ 7,21 contra R$ 20,82:
    // limitada por dia e removida quando o dia enche (RN8).
    if (massaForaDoCatalogo) return { produtoId: produto.id, disponivel: 0 };

    const restanteNoSubTeto =
      snapshot.config.subTetoMassaDia - consumoDoDia(dia, snapshot, produto.id);
    return { produtoId: produto.id, disponivel: Math.max(0, Math.min(base, restanteNoSubTeto)) };
  });

  return { data: dia, cutoff, modo, capacidadeRestante: capacidade, produtos };
}

/** Disponibilidade de cada dia do horizonte (RN6, RN7, RN8). */
export function calcularDisponibilidade(snapshot: Snapshot): DisponibilidadeDia[] {
  return diasDeEntregaDoHorizonte(snapshot).map((dia) => disponibilidadeDoDia(dia, snapshot));
}

/**
 * Próximo dia com vaga **real** para o produto (RN9).
 *
 * Com teto de 30, esse caminho é rotina e não exceção — por isso ele herda a
 * capacidade do dia sugerido em vez de apontar a próxima data do calendário.
 */
export function proximoDiaComVaga(produtoId: string, snapshot: Snapshot): DataCalendario | null {
  const comVaga = calcularDisponibilidade(snapshot).find(
    (dia) => (dia.produtos.find((p) => p.produtoId === produtoId)?.disponivel ?? 0) > 0,
  );
  return comVaga?.data ?? null;
}
