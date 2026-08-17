import { describe, expect, it } from 'vitest';

import { centavosParaReais, formatarReais, precoEfetivoCentavos } from './preco';
import type { FaixaPreco } from './tipos';

const tradicional: FaixaPreco = { id: 'f1', nome: 'Tradicional', precoCentavos: 3990 };

describe('precoEfetivoCentavos (RN5)', () => {
  it('T10 — sem override, herda o preço da faixa', () => {
    expect(precoEfetivoCentavos({ precoOverrideCentavos: null }, tradicional)).toBe(3990);
  });

  it('T10 — com override, o override vence a faixa', () => {
    expect(precoEfetivoCentavos({ precoOverrideCentavos: 4200 }, tradicional)).toBe(4200);
  });

  it('override de zero é um preço válido, não "ausente"', () => {
    expect(precoEfetivoCentavos({ precoOverrideCentavos: 0 }, tradicional)).toBe(0);
  });
});

describe('formatação de preço', () => {
  it('centavosParaReais dá o número sem símbolo (fonte técnica do card)', () => {
    expect(centavosParaReais(3990)).toBe('39,90');
    expect(centavosParaReais(1500)).toBe('15,00');
  });

  it('formatarReais prefixa com R$', () => {
    expect(formatarReais(3990)).toBe('R$ 39,90');
    expect(formatarReais(4200)).toBe('R$ 42,00');
  });
});
