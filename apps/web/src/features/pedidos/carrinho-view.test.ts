import { describe, expect, it } from 'vitest';

import { formatarCentavos, formatarDiaBarra, montarVistaCarrinho } from './carrinho-view';

const PID_A = '00000000-0000-0000-0000-0000000000aa';
const PID_B = '00000000-0000-0000-0000-0000000000bb';

const CATALOGO = [
  { produtoId: PID_A, nome: 'Calabresa', faixaNome: 'Tradicional', pesoG: 550, fotoUrl: '/a.jpg' },
  { produtoId: PID_B, nome: 'Peito de Peru', faixaNome: 'Premium', pesoG: 550, fotoUrl: null },
];

describe('montarVistaCarrinho', () => {
  it('sem revalidação: preços e subtotal ficam nulos e não pode finalizar', () => {
    const vista = montarVistaCarrinho([{ produtoId: PID_A, quantidade: 2 }], CATALOGO, null);
    expect(vista.linhas[0]!.precoUnitarioCentavos).toBeNull();
    expect(vista.subtotalCentavos).toBeNull();
    expect(vista.podeFinalizar).toBe(false);
  });

  it('junta catálogo e revalidação, soma o subtotal e libera o checkout', () => {
    const vista = montarVistaCarrinho(
      [
        { produtoId: PID_A, quantidade: 2 },
        { produtoId: PID_B, quantidade: 1 },
      ],
      CATALOGO,
      [
        { produtoId: PID_A, precoUnitarioCentavos: 3990, disponivel: 9, esgotado: false },
        { produtoId: PID_B, precoUnitarioCentavos: 4990, disponivel: 4, esgotado: false },
      ],
    );

    expect(vista.linhas[0]).toMatchObject({ nome: 'Calabresa', totalLinhaCentavos: 7980 });
    expect(vista.subtotalCentavos).toBe(12970);
    expect(vista.podeFinalizar).toBe(true);
    expect(vista.temEsgotado).toBe(false);
  });

  it('T41 — item esgotado é sinalizado e trava o checkout', () => {
    const vista = montarVistaCarrinho(
      [
        { produtoId: PID_A, quantidade: 2 },
        { produtoId: PID_B, quantidade: 1 },
      ],
      CATALOGO,
      [
        { produtoId: PID_A, precoUnitarioCentavos: 3990, disponivel: 9, esgotado: false },
        { produtoId: PID_B, precoUnitarioCentavos: 4990, disponivel: 0, esgotado: true },
      ],
    );

    expect(vista.temEsgotado).toBe(true);
    expect(vista.linhas.find((l) => l.produtoId === PID_B)!.esgotado).toBe(true);
    expect(vista.podeFinalizar).toBe(false);
  });

  it('produto que saiu do catálogo não vira linha', () => {
    const vista = montarVistaCarrinho(
      [{ produtoId: 'fantasma', quantidade: 1 }],
      CATALOGO,
      [{ produtoId: 'fantasma', precoUnitarioCentavos: 100, disponivel: 1, esgotado: false }],
    );
    expect(vista.linhas).toHaveLength(0);
    expect(vista.podeFinalizar).toBe(false);
  });

  it('carrinho vazio não finaliza mesmo revalidado', () => {
    expect(montarVistaCarrinho([], CATALOGO, []).podeFinalizar).toBe(false);
  });
});

describe('formatadores', () => {
  it('formata centavos em reais', () => {
    // Normaliza qualquer espaço unicode (nbsp/estreito) para comparar conteúdo.
    expect(formatarCentavos(12970).replace(/\s/g, ' ')).toBe('R$ 129,70');
  });

  it('formata a fornada como dia/mês', () => {
    expect(formatarDiaBarra('2026-08-22')).toBe('22/08');
  });
});
