import { describe, expect, it } from 'vitest';
import type { Database } from '@napo/db';

import { mapearCategoria, mapearFaixa, mapearProduto } from './mapear';

const linhaProduto: Database['public']['Tables']['produtos']['Row'] = {
  id: 'p1',
  slug: 'nutella-com-avela',
  nome: 'Nutella com Avelã',
  categoria_id: 'c2',
  faixa_preco_id: 'f3',
  denominacao_venda: 'Pizza doce congelada',
  descricao: 'Creme de avelã.',
  peso_liquido_g: 450,
  validade_dias: 90,
  conservacao: '−18 °C',
  preparo: 'Forno a 220 °C.',
  diametro_cm: 30,
  porcoes: 2,
  preco_override_centavos: null,
  alergenos_contem: ['avela', 'gluten', 'leite', 'soja'],
  alergenos_pode_conter: ['amendoim', 'castanhas'],
  ranking_mais_pedidas: null,
  ordem: 1,
  ativo: true,
  created_at: '2026-08-17T00:00:00Z',
  updated_at: '2026-08-17T00:00:00Z',
};

describe('mapearProduto — fronteira banco → domínio', () => {
  it('traduz snake_case para o tipo puro camelCase', () => {
    const p = mapearProduto(linhaProduto);
    expect(p.slug).toBe('nutella-com-avela');
    expect(p.categoriaId).toBe('c2');
    expect(p.faixaPrecoId).toBe('f3');
    expect(p.pesoLiquidoG).toBe(450);
    expect(p.alergenosContem).toEqual(['avela', 'gluten', 'leite', 'soja']);
    expect(p.alergenosPodeConter).toEqual(['amendoim', 'castanhas']);
    expect(p.precoOverrideCentavos).toBeNull();
    expect(p.ativo).toBe(true);
  });
});

describe('mapearCategoria / mapearFaixa', () => {
  it('categoria carrega ehMassa (sub-teto de massa vive na categoria)', () => {
    const c = mapearCategoria({
      id: 'c3',
      nome: 'Massas',
      slug: 'massas',
      eh_massa: true,
      ordem: 3,
      created_at: 'x',
      updated_at: 'x',
    });
    expect(c).toEqual({ id: 'c3', nome: 'Massas', slug: 'massas', ehMassa: true });
  });

  it('faixa traz o preço em centavos', () => {
    const f = mapearFaixa({
      id: 'f1',
      nome: 'Tradicional',
      preco_centavos: 3990,
      ordem: 1,
      created_at: 'x',
      updated_at: 'x',
    });
    expect(f).toEqual({ id: 'f1', nome: 'Tradicional', precoCentavos: 3990 });
  });
});
