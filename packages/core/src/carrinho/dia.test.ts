import { describe, expect, it } from 'vitest';

import type { DisponibilidadeDia } from '../disponibilidade';
import { resolverDiaDoPedido } from './dia';

const MARGHERITA = 'dddddddd-0000-0000-0000-000000000001';
const CALABRESA = 'dddddddd-0000-0000-0000-000000000002';

/** Duas fornadas do horizonte; só o que `resolverDiaDoPedido` lê é preenchido. */
function dia(data: string, produtos: Array<[string, number]>): DisponibilidadeDia {
  return {
    data,
    cutoff: new Date(`${data}T12:00:00Z`),
    modo: 'CTP',
    capacidadeRestante: 30,
    produtos: produtos.map(([produtoId, disponivel]) => ({ produtoId, disponivel })),
  };
}

describe('T2 — o pedido vai para o dia mais tardio entre os itens (RN2)', () => {
  const dias = [
    dia('2026-08-22', [
      [CALABRESA, 10],
      [MARGHERITA, 0],
    ]),
    dia('2026-08-29', [
      [CALABRESA, 10],
      [MARGHERITA, 10],
    ]),
  ];

  it('escolhe 29/08 quando um sabor só cabe lá, mesmo com o outro livre em 22/08', () => {
    const escolha = resolverDiaDoPedido(
      [
        { produtoId: CALABRESA, quantidade: 2 },
        { produtoId: MARGHERITA, quantidade: 1 },
      ],
      dias,
    );
    expect(escolha).toEqual({ data: '2026-08-29', determinadoPor: MARGHERITA });
  });

  it('nomeia qual produto empurrou a data — a tela mostra o motivo, não só o dia', () => {
    expect(resolverDiaDoPedido([{ produtoId: MARGHERITA, quantidade: 1 }], dias)?.determinadoPor).toBe(
      MARGHERITA,
    );
  });

  it('carrinho inteiro viável na primeira fornada fica nela', () => {
    expect(resolverDiaDoPedido([{ produtoId: CALABRESA, quantidade: 3 }], dias)).toEqual({
      data: '2026-08-22',
      determinadoPor: CALABRESA,
    });
  });

  it('respeita a quantidade, não só a existência do sabor', () => {
    expect(resolverDiaDoPedido([{ produtoId: CALABRESA, quantidade: 11 }], dias)).toBeNull();
  });

  it('devolve null quando algum item não cabe em nenhuma fornada do horizonte', () => {
    expect(
      resolverDiaDoPedido(
        [
          { produtoId: CALABRESA, quantidade: 2 },
          { produtoId: 'produto-inexistente', quantidade: 1 },
        ],
        dias,
      ),
    ).toBeNull();
  });

  it('carrinho vazio não tem dia', () => {
    expect(resolverDiaDoPedido([], dias)).toBeNull();
  });

  it('sem fornada no horizonte não há dia', () => {
    expect(resolverDiaDoPedido([{ produtoId: CALABRESA, quantidade: 1 }], [])).toBeNull();
  });
});
