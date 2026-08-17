import { describe, expect, it } from 'vitest';

import { camposDeRotulagemFaltantes, rotulagemCompleta } from './rotulagem';
import type { ProdutoCatalogo } from './tipos';

function produtoCompleto(over: Partial<ProdutoCatalogo> = {}): ProdutoCatalogo {
  return {
    id: 'p1',
    slug: 'margherita',
    nome: 'Margherita',
    categoriaId: 'c1',
    faixaPrecoId: 'f1',
    denominacaoVenda: 'Pizza congelada pré-assada de muçarela e tomate',
    descricao: 'Muçarela e tomate.',
    pesoLiquidoG: 450,
    validadeDias: 90,
    conservacao: '−18 °C · não recongelar',
    preparo: 'Forno a 220 °C por 8 a 10 minutos.',
    diametroCm: 30,
    porcoes: 2,
    precoOverrideCentavos: null,
    alergenosContem: ['gluten', 'leite'],
    alergenosPodeConter: [],
    rankingMaisPedidas: 1,
    ordem: 1,
    ativo: true,
    ...over,
  };
}

describe('rotulagemCompleta (RN2)', () => {
  it('produto com todos os campos obrigatórios está completo', () => {
    expect(rotulagemCompleta(produtoCompleto())).toBe(true);
    expect(camposDeRotulagemFaltantes(produtoCompleto())).toEqual([]);
  });

  it('peso ausente reprova e é nomeado', () => {
    const p = produtoCompleto({ pesoLiquidoG: null });
    expect(rotulagemCompleta(p)).toBe(false);
    expect(camposDeRotulagemFaltantes(p)).toContain('pesoLiquidoG');
  });

  it('lista "contém" vazia reprova (RN2 exige ao menos um)', () => {
    const p = produtoCompleto({ alergenosContem: [] });
    expect(rotulagemCompleta(p)).toBe(false);
    expect(camposDeRotulagemFaltantes(p)).toContain('alergenosContem');
  });

  it('acumula todos os campos faltantes, não só o primeiro', () => {
    const p = produtoCompleto({ conservacao: null, preparo: null });
    expect(camposDeRotulagemFaltantes(p)).toEqual(
      expect.arrayContaining(['conservacao', 'preparo']),
    );
  });
});
