import { describe, expect, it } from 'vitest';

import {
  arredondarKm,
  deslocamentoMetros,
  distanciaEmLinhaRetaKm,
  estimarDistanciaRodoviariaKm,
  excedeLimiteDeAjuste,
  type Coordenada,
} from './distancia';

const CONGRESSO: Coordenada = { lat: -15.7997, lng: -47.8645 };
const TORRE_TV: Coordenada = { lat: -15.7901, lng: -47.8929 };

describe('distância em linha reta (RN11)', () => {
  it('é zero entre um ponto e ele mesmo', () => {
    expect(distanciaEmLinhaRetaKm(CONGRESSO, CONGRESSO)).toBe(0);
  });

  it('mede o Eixo Monumental com precisão de dezenas de metros', () => {
    // Congresso → Torre de TV: ~3,2 km em linha reta.
    expect(distanciaEmLinhaRetaKm(CONGRESSO, TORRE_TV)).toBeCloseTo(3.22, 1);
  });

  it('é simétrica — a ida não é maior que a volta', () => {
    expect(distanciaEmLinhaRetaKm(CONGRESSO, TORRE_TV)).toBe(
      distanciaEmLinhaRetaKm(TORRE_TV, CONGRESSO),
    );
  });
});

describe('T23 — rota indisponível cai para estimativa marcada (RN11)', () => {
  it('multiplica a linha reta pelo fator configurado', () => {
    expect(estimarDistanciaRodoviariaKm(10, 1.35)).toBe(13.5);
  });

  it('arredonda em duas casas, como a coluna numeric(6,2) do banco', () => {
    expect(estimarDistanciaRodoviariaKm(3.09, 1.35)).toBe(4.17);
  });

  it('o fator é configuração, não constante — trocar o fator muda a estimativa', () => {
    expect(estimarDistanciaRodoviariaKm(10, 1.4)).toBe(14);
    expect(estimarDistanciaRodoviariaKm(10, 1.3)).toBe(13);
  });

  it('recusa fator abaixo de 1 — rodovia nunca é mais curta que a linha reta', () => {
    expect(() => estimarDistanciaRodoviariaKm(10, 0.9)).toThrow();
  });
});

describe('T24 — deslocamento do pin (RN6)', () => {
  it('mede em metros o quanto o pin saiu do ponto geocodificado', () => {
    expect(deslocamentoMetros(CONGRESSO, TORRE_TV)).toBeCloseTo(3220, -2);
  });

  it('não acusa deslocamento quando o cliente não tocou no mapa', () => {
    expect(deslocamentoMetros(CONGRESSO, CONGRESSO)).toBe(0);
    expect(excedeLimiteDeAjuste(0, 300)).toBe(false);
  });

  it('1,2 km excede o limite de 300 m e marca o endereço para conferência', () => {
    expect(excedeLimiteDeAjuste(1200, 300)).toBe(true);
  });

  it('exatamente no limite ainda é aceitável — a RN fala em "acima de"', () => {
    expect(excedeLimiteDeAjuste(300, 300)).toBe(false);
    expect(excedeLimiteDeAjuste(300.01, 300)).toBe(true);
  });
});

describe('arredondarKm', () => {
  it('mantém duas casas para a distância caber em numeric(6,2) sem surpresa na borda', () => {
    expect(arredondarKm(11.995)).toBe(12);
    expect(arredondarKm(3.4449)).toBe(3.44);
  });
});
