import { describe, expect, it } from 'vitest';

import { estadoDoProduto, fornadaAtiva, type DiaDisponibilidade } from './disponibilidade-view';

const dias: DiaDisponibilidade[] = [
  {
    data: '2026-08-21',
    cutoff: '2026-08-19T21:00:00Z',
    modo: 'ATP',
    produtos: [
      { produtoId: 'margherita', disponivel: 12 },
      { produtoId: 'calabresa', disponivel: 4 },
      { produtoId: 'pepperoni', disponivel: 0 },
    ],
  },
  {
    data: '2026-08-28',
    cutoff: '2026-08-26T21:00:00Z',
    modo: 'CTP',
    produtos: [
      { produtoId: 'margherita', disponivel: 20 },
      { produtoId: 'pepperoni', disponivel: 20 },
    ],
  },
];

describe('estadoDoProduto (RN13/RN14)', () => {
  it('disponível com folga não é escasso', () => {
    expect(estadoDoProduto(dias, '2026-08-21', 'margherita')).toEqual({
      tipo: 'disponivel',
      quantidade: 12,
      escasso: false,
    });
  });

  it('poucas unidades marcam escasso (número, não urgência)', () => {
    expect(estadoDoProduto(dias, '2026-08-21', 'calabresa')).toEqual({
      tipo: 'disponivel',
      quantidade: 4,
      escasso: true,
    });
  });

  it('T4 — esgotado na fornada ativa oferece a próxima com estoque', () => {
    expect(estadoDoProduto(dias, '2026-08-21', 'pepperoni')).toEqual({
      tipo: 'esgotado',
      proxima: { data: '2026-08-28', quantidade: 20 },
    });
  });

  it('T23 — sem estoque em fornada nenhuma: esgotado sem alternativa', () => {
    const semEstoque: DiaDisponibilidade[] = dias.map((d) => ({
      ...d,
      produtos: d.produtos.map((p) => ({ ...p, disponivel: 0 })),
    }));
    expect(estadoDoProduto(semEstoque, '2026-08-21', 'pepperoni')).toEqual({
      tipo: 'esgotado',
      proxima: null,
    });
  });
});

describe('fornadaAtiva (RN13/T22)', () => {
  it('respeita a data pedida quando ainda existe no horizonte', () => {
    expect(fornadaAtiva(dias, '2026-08-28')).toBe('2026-08-28');
  });

  it('T22 — data que saiu da lista cai para a primeira válida', () => {
    expect(fornadaAtiva(dias, '2026-08-14')).toBe('2026-08-21');
  });

  it('sem parâmetro, usa a primeira fornada oferecida', () => {
    expect(fornadaAtiva(dias, null)).toBe('2026-08-21');
  });
});
