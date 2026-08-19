/**
 * O dia único do pedido (RN2).
 *
 * Cada sabor tem sua primeira fornada viável; o pedido vai para a mais tardia
 * entre elas. Escolher a mais próxima obrigaria a recusar o sabor que não cabe
 * nela — transformaria uma regra de agenda em perda de item da sacola.
 */

import type { DataCalendario, DisponibilidadeDia } from '../disponibilidade';
import type { ItemCarrinho } from './tipos';

export interface DiaDoPedido {
  data: DataCalendario;
  /** Produto que empurrou a data — a tela mostra o motivo, não só o dia. */
  determinadoPor: string;
}

/** Primeira fornada em que o produto cabe na quantidade pedida. */
function primeiroDiaViavel(
  item: ItemCarrinho,
  dias: DisponibilidadeDia[],
): DataCalendario | null {
  const ordenados = [...dias].sort((a, b) => a.data.localeCompare(b.data));

  for (const dia of ordenados) {
    const disponivel = dia.produtos.find((p) => p.produtoId === item.produtoId)?.disponivel ?? 0;
    if (disponivel >= item.quantidade) return dia.data;
  }

  return null;
}

/**
 * Devolve `null` quando **qualquer** item não cabe em nenhuma fornada do
 * horizonte: um pedido parcial entregaria menos do que a pessoa montou.
 */
export function resolverDiaDoPedido(
  itens: ItemCarrinho[],
  dias: DisponibilidadeDia[],
): DiaDoPedido | null {
  if (itens.length === 0) return null;

  let escolha: DiaDoPedido | null = null;

  for (const item of itens) {
    const data = primeiroDiaViavel(item, dias);
    if (data === null) return null;

    if (escolha === null || data > escolha.data) {
      escolha = { data, determinadoPor: item.produtoId };
    }
  }

  return escolha;
}
