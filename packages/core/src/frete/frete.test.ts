import { describe, expect, it } from 'vitest';

import { calcularFrete, faixaDaDistancia, type FaixaFrete } from './frete';

/** As três faixas semeadas pela migration 0012 (RN7). */
const FAIXAS: FaixaFrete[] = [
  { kmDe: 0, kmAte: 4, valorCentavos: 600 },
  { kmDe: 4, kmAte: 8, valorCentavos: 1000 },
  { kmDe: 8, kmAte: 12, valorCentavos: 1400 },
];

const GRATIS_A_PARTIR_DE = 15_000;

function frete(distanciaKm: number, subtotalCentavos = 0) {
  return calcularFrete({
    distanciaKm,
    subtotalCentavos,
    atendido: true,
    motivoNaoAtendido: null,
    faixas: FAIXAS,
    freteGratisCentavos: GRATIS_A_PARTIR_DE,
  });
}

describe('T7 — a faixa de distância define o valor (RN7, RN16)', () => {
  it('devolve R$ 6,00, R$ 10,00 e R$ 14,00 para 2,0 km, 5,5 km e 11,9 km', () => {
    expect(frete(2.0).freteCentavos).toBe(600);
    expect(frete(5.5).freteCentavos).toBe(1000);
    expect(frete(11.9).freteCentavos).toBe(1400);
  });

  it('devolve a faixa aplicada junto com o valor — o checkout precisa das duas', () => {
    expect(frete(5.5).faixa).toEqual({ kmDe: 4, kmAte: 8, valorCentavos: 1000 });
  });
});

describe('T26 — borda exata entre faixas (RN7)', () => {
  it('4,00 km cai na faixa superior: fechado no início, aberto no fim', () => {
    expect(faixaDaDistancia(4.0, FAIXAS)).toEqual({ kmDe: 4, kmAte: 8, valorCentavos: 1000 });
  });

  it('3,99 km ainda é a faixa de baixo', () => {
    expect(faixaDaDistancia(3.99, FAIXAS)?.valorCentavos).toBe(600);
  });

  it('12,00 km — a borda do raio (T25) — pertence à última faixa, que fecha à direita', () => {
    expect(faixaDaDistancia(12.0, FAIXAS)?.valorCentavos).toBe(1400);
  });

  it('além da última faixa não existe faixa', () => {
    expect(faixaDaDistancia(12.01, FAIXAS)).toBeNull();
  });
});

describe('T6 — pedido a partir de R$ 150 tem frete zero (RN8)', () => {
  it('zera o frete da faixa 8–12 km quando o subtotal atinge o piso', () => {
    const resultado = frete(9.1, 15_000);

    expect(resultado.freteCentavos).toBe(0);
    expect(resultado.gratis).toBe(true);
  });

  it('mantém a faixa mesmo grátis — o painel econômico precisa saber o que foi absorvido', () => {
    expect(frete(9.1, 15_000).faixa?.valorCentavos).toBe(1400);
  });

  it('um centavo abaixo do piso ainda cobra', () => {
    const resultado = frete(9.1, 14_999);

    expect(resultado.freteCentavos).toBe(1400);
    expect(resultado.gratis).toBe(false);
  });
});

describe('endereço fora de área não tem frete (RN9)', () => {
  it('não devolve valor nem faixa, e carrega o motivo', () => {
    const resultado = calcularFrete({
      distanciaKm: 28.6,
      subtotalCentavos: 20_000,
      atendido: false,
      motivoNaoAtendido: 'fora do raio de 12 km',
      faixas: FAIXAS,
      freteGratisCentavos: GRATIS_A_PARTIR_DE,
    });

    expect(resultado.foraDeArea).toBe(true);
    expect(resultado.freteCentavos).toBeNull();
    expect(resultado.faixa).toBeNull();
    expect(resultado.motivo).toBe('fora do raio de 12 km');
  });

  it('subtotal acima do piso não compra entrega onde não se entrega', () => {
    const resultado = calcularFrete({
      distanciaKm: 28.6,
      subtotalCentavos: 50_000,
      atendido: false,
      motivoNaoAtendido: null,
      faixas: FAIXAS,
      freteGratisCentavos: GRATIS_A_PARTIR_DE,
    });

    expect(resultado.gratis).toBe(false);
    expect(resultado.freteCentavos).toBeNull();
  });
});

describe('distância dentro do raio mas sem faixa configurada', () => {
  it('trata como fora de área em vez de cobrar zero — frete zero silencioso é prejuízo', () => {
    const resultado = calcularFrete({
      distanciaKm: 20,
      subtotalCentavos: 5_000,
      atendido: true,
      motivoNaoAtendido: null,
      faixas: FAIXAS,
      freteGratisCentavos: GRATIS_A_PARTIR_DE,
    });

    expect(resultado.foraDeArea).toBe(true);
    expect(resultado.freteCentavos).toBeNull();
  });
});

describe('faixas fora de ordem no banco', () => {
  it('ordena antes de decidir — a ordem das linhas não é contrato', () => {
    const invertidas = [...FAIXAS].reverse();

    expect(faixaDaDistancia(5.5, invertidas)?.valorCentavos).toBe(1000);
    expect(faixaDaDistancia(12.0, invertidas)?.valorCentavos).toBe(1400);
  });
});
