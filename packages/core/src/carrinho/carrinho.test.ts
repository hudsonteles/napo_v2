import { describe, expect, it } from 'vitest';

import {
  aplicarTetos,
  calcularSubtotal,
  conferirPrecos,
  montarTotais,
  normalizarItens,
} from './carrinho';
import type { ItemPrecificado } from './tipos';

/** Preços reais das faixas semeadas pela migration 0011. */
const CALABRESA = 'dddddddd-0000-0000-0000-000000000002';
const PERU = 'dddddddd-0000-0000-0000-000000000009';

function item(
  produtoId: string,
  quantidade: number,
  precoUnitarioCentavos: number,
  disponivel = 99,
): ItemPrecificado {
  return { produtoId, quantidade, precoUnitarioCentavos, disponivel, nome: produtoId };
}

describe('T13 — o servidor decide o total a partir dos itens (RN3)', () => {
  it('soma quantidade × preço unitário de cada linha', () => {
    const itens = [item(CALABRESA, 2, 3990), item(PERU, 1, 4990)];
    expect(calcularSubtotal(itens)).toBe(12_970);
  });

  it('funde linhas repetidas do mesmo produto somando quantidades', () => {
    const normalizados = normalizarItens([
      { produtoId: CALABRESA, quantidade: 2 },
      { produtoId: PERU, quantidade: 1 },
      { produtoId: CALABRESA, quantidade: 1 },
    ]);
    expect(normalizados).toEqual([
      { produtoId: CALABRESA, quantidade: 3 },
      { produtoId: PERU, quantidade: 1 },
    ]);
  });

  it('descarta quantidade zero, negativa ou fracionária — não existe meia pizza', () => {
    expect(
      normalizarItens([
        { produtoId: CALABRESA, quantidade: 0 },
        { produtoId: PERU, quantidade: -3 },
        { produtoId: CALABRESA, quantidade: 1.5 },
      ]),
    ).toEqual([]);
  });
});

describe('T32 — carrinho vazio não vira pedido (RN3)', () => {
  it('subtotal de carrinho vazio é zero', () => {
    expect(calcularSubtotal([])).toBe(0);
  });

  it('normalizar lista vazia devolve lista vazia, não erro', () => {
    expect(normalizarItens([])).toEqual([]);
  });
});

describe('T14 — divergência de preço é detectada, não absorvida (RN3)', () => {
  it('aponta o produto com o preço antigo e o novo', () => {
    const conhecidos = [{ produtoId: CALABRESA, precoUnitarioCentavos: 3790 }];
    const atuais = [item(CALABRESA, 2, 3990)];
    expect(conferirPrecos(conhecidos, atuais)).toEqual([
      { produtoId: CALABRESA, deCentavos: 3790, paraCentavos: 3990 },
    ]);
  });

  it('preço que caiu também é divergência — o cliente confirma para baixo igual', () => {
    const conhecidos = [{ produtoId: CALABRESA, precoUnitarioCentavos: 4290 }];
    expect(conferirPrecos(conhecidos, [item(CALABRESA, 1, 3990)])).toHaveLength(1);
  });

  it('sem preço conhecido não há divergência: carrinho novo não bloqueia', () => {
    expect(conferirPrecos([], [item(CALABRESA, 1, 3990)])).toEqual([]);
  });
});

describe('T41 — item que estourou o teto da fornada é sinalizado (RN1, RN2)', () => {
  it('reduz a quantidade ao disponível e registra o ajuste', () => {
    const { itens, ajustes, bloqueado } = aplicarTetos([item(CALABRESA, 5, 3990, 2)]);
    expect(itens[0]?.quantidade).toBe(2);
    expect(ajustes).toEqual([{ produtoId: CALABRESA, tipo: 'reduzido', de: 5, para: 2 }]);
    expect(bloqueado).toBe(true);
  });

  it('remove o item esgotado e registra o motivo', () => {
    const { itens, ajustes } = aplicarTetos([item(CALABRESA, 1, 3990, 0), item(PERU, 1, 4990, 3)]);
    expect(itens.map((i) => i.produtoId)).toEqual([PERU]);
    expect(ajustes).toEqual([{ produtoId: CALABRESA, tipo: 'esgotado' }]);
  });

  it('carrinho dentro do teto não bloqueia e não gera ajuste', () => {
    const { ajustes, bloqueado } = aplicarTetos([item(CALABRESA, 2, 3990, 30)]);
    expect(ajustes).toEqual([]);
    expect(bloqueado).toBe(false);
  });
});

describe('T19 — totais somam frete ao subtotal (RN18)', () => {
  const itens = [item(CALABRESA, 2, 3990), item(PERU, 1, 4990)];

  it('total é subtotal mais frete', () => {
    const totais = montarTotais({ itens, freteCentavos: 600, freteGratisCentavos: 15_000 });
    expect(totais).toMatchObject({
      subtotalCentavos: 12_970,
      freteCentavos: 600,
      totalCentavos: 13_570,
    });
  });

  it('informa quanto falta para o frete grátis', () => {
    const totais = montarTotais({ itens, freteCentavos: 600, freteGratisCentavos: 15_000 });
    expect(totais.faltamParaFreteGratisCentavos).toBe(2030);
  });

  it('atingido o piso, não falta nada e o frete é zero', () => {
    const cheio = [item(CALABRESA, 4, 3990)];
    const totais = montarTotais({ itens: cheio, freteCentavos: 0, freteGratisCentavos: 15_000 });
    expect(totais.faltamParaFreteGratisCentavos).toBeNull();
    expect(totais.totalCentavos).toBe(15_960);
  });

  it('frete nulo (fora de área) não vira zero: o total também é nulo', () => {
    const totais = montarTotais({ itens, freteCentavos: null, freteGratisCentavos: 15_000 });
    expect(totais.freteCentavos).toBeNull();
    expect(totais.totalCentavos).toBeNull();
  });
});
