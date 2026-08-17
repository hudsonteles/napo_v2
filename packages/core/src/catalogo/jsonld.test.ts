import { describe, expect, it } from 'vitest';

import { jsonLdProduto } from './jsonld';
import { precoEfetivoCentavos } from './preco';
import type { FaixaPreco, ProdutoCatalogo } from './tipos';

const premium: FaixaPreco = { id: 'f3', nome: 'Premium', precoCentavos: 4990 };
const tradicional: FaixaPreco = { id: 'f1', nome: 'Tradicional', precoCentavos: 3990 };

function produto(over: Partial<ProdutoCatalogo> = {}): ProdutoCatalogo {
  return {
    id: 'p1',
    slug: 'banana',
    nome: 'Banana',
    categoriaId: 'c2',
    faixaPrecoId: 'f1',
    denominacaoVenda: 'Pizza doce congelada de banana',
    descricao: 'Banana e canela sobre massa doce.',
    pesoLiquidoG: 450,
    validadeDias: 90,
    conservacao: '−18 °C',
    preparo: 'Forno a 220 °C.',
    diametroCm: 30,
    porcoes: 2,
    precoOverrideCentavos: 4200,
    alergenosContem: ['gluten', 'leite'],
    alergenosPodeConter: [],
    rankingMaisPedidas: null,
    ordem: 2,
    ativo: true,
    ...over,
  };
}

describe('jsonLdProduto (RN9)', () => {
  it('T25 — preço do JSON-LD é o preço efetivo, com ponto decimal e BRL', () => {
    const ld = jsonLdProduto({
      produto: produto(),
      faixa: tradicional,
      url: 'https://napobsb.com.br/sabores/banana',
      disponibilidade: 'InStock',
    });
    const offer = (ld.offers ?? {}) as Record<string, unknown>;
    // override (4200) vence a faixa (3990) — o mesmo valor da tela.
    expect(offer.price).toBe('42.00');
    expect(offer.priceCurrency).toBe('BRL');
    expect(offer.availability).toBe('https://schema.org/InStock');
  });

  it('T25 — preço do JSON-LD nunca diverge de precoEfetivoCentavos', () => {
    const p = produto({ precoOverrideCentavos: null });
    const ld = jsonLdProduto({
      produto: p,
      faixa: premium,
      url: 'https://napobsb.com.br/sabores/banana',
      disponibilidade: 'InStock',
    });
    const offer = ld.offers as Record<string, unknown>;
    const esperado = (precoEfetivoCentavos(p, premium) / 100).toFixed(2);
    expect(offer.price).toBe(esperado);
    expect(offer.price).toBe('49.90');
  });

  it('esgotado em toda fornada vira OutOfStock', () => {
    const ld = jsonLdProduto({
      produto: produto(),
      faixa: tradicional,
      url: 'https://napobsb.com.br/sabores/banana',
      disponibilidade: 'OutOfStock',
    });
    const offer = ld.offers as Record<string, unknown>;
    expect(offer.availability).toBe('https://schema.org/OutOfStock');
  });

  it('declara Product + Offer do schema.org', () => {
    const ld = jsonLdProduto({
      produto: produto(),
      faixa: tradicional,
      url: 'https://napobsb.com.br/sabores/banana',
      disponibilidade: 'InStock',
    });
    expect(ld['@type']).toBe('Product');
    expect(ld['@context']).toBe('https://schema.org');
    expect((ld.offers as Record<string, unknown>)['@type']).toBe('Offer');
  });
});
