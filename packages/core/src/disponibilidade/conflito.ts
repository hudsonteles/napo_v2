import { calcularCutoff } from './cutoff';
import { calcularDisponibilidade } from './capacidade';
import type { DataCalendario, Snapshot } from './tipos';

/** O que aconteceu com a promessa entre a escolha do cliente e a confirmação. */
export type Veredito = 'viavel' | 'cutoff_vencido' | 'sem_vaga';

/** O que um cancelamento devolve ao motor, conforme a fase (RN13). */
export type Devolucao = 'capacidade' | 'lote';

/**
 * Avalia se o dia ainda pode ser honrado (RN12).
 *
 * Reporta o veredito e **não decide o destino** — realocar ou estornar é
 * escolha humana, tomada no admin. Quem grava esse veredito no pedido é o
 * webhook de NAPO-006; aqui mora só a regra (ver `drift.md`).
 */
export function avaliarViabilidade(
  diaEntrega: DataCalendario,
  produtoId: string,
  quantidade: number,
  snapshot: Snapshot,
): Veredito {
  const dia = calcularDisponibilidade(snapshot).find((d) => d.data === diaEntrega);
  const disponivel = dia?.produtos.find((p) => p.produtoId === produtoId)?.disponivel ?? 0;

  if (disponivel >= quantidade) return 'viavel';

  // Distinguir os dois casos é o que dá ao gerente contexto para decidir: o
  // cutoff vencido significa que a produção não cabe mais; sem vaga significa
  // que o dia encheu enquanto o cliente pagava.
  const cutoffVencido = snapshot.agora.getTime() >= calcularCutoff(diaEntrega, snapshot).getTime();
  return cutoffVencido ? 'cutoff_vencido' : 'sem_vaga';
}

/**
 * O que retorna ao estoque quando um pedido é cancelado (RN13).
 *
 * Antes do cutoff nada foi produzido e o que volta é vaga de forno; depois, a
 * pizza existe e o que volta é lote pronto — vendável para outro dia dentro da
 * validade. Tratar os dois como a mesma coisa faria o dia vender menos do que
 * pode ou prometer o que não tem.
 */
export function devolucaoPorCancelamento(
  diaEntrega: DataCalendario,
  snapshot: Snapshot,
): Devolucao {
  const antesDoCutoff =
    snapshot.agora.getTime() < calcularCutoff(diaEntrega, snapshot).getTime();
  return antesDoCutoff ? 'capacidade' : 'lote';
}
