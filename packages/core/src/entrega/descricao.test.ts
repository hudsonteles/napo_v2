import { describe, expect, it } from 'vitest';

import { descreverCobertura, descreverDiasDeEntrega, descreverRaio } from './descricao';

const SEXTA = 5;
const QUARTA = 3;
const SEGUNDA = 1;
const SABADO = 6;
const DOMINGO = 0;

describe('T27 — a cobertura exibida acompanha a configuração (RN17)', () => {
  it('um único dia: "às sextas"', () => {
    expect(descreverDiasDeEntrega([SEXTA])).toBe('às sextas');
  });

  it('dois dias: "e" antes do último, sem vírgula', () => {
    expect(descreverDiasDeEntrega([QUARTA, SEXTA])).toBe('às quartas e sextas');
  });

  it('três dias: vírgula entre os primeiros e "e" antes do último', () => {
    expect(descreverDiasDeEntrega([SEGUNDA, QUARTA, SEXTA])).toBe(
      'às segundas, quartas e sextas',
    );
  });

  it('ordena pela semana, não pela ordem que veio do banco', () => {
    expect(descreverDiasDeEntrega([SEXTA, SEGUNDA, QUARTA])).toBe(
      'às segundas, quartas e sextas',
    );
  });

  it('ignora repetição de dia', () => {
    expect(descreverDiasDeEntrega([SEXTA, SEXTA])).toBe('às sextas');
  });
});

describe('flexão de gênero do dia (RN17)', () => {
  it('sábado e domingo pedem "aos"', () => {
    expect(descreverDiasDeEntrega([SABADO])).toBe('aos sábados');
    expect(descreverDiasDeEntrega([DOMINGO])).toBe('aos domingos');
  });

  it('mistura de gêneros repete a preposição na virada', () => {
    expect(descreverDiasDeEntrega([SEXTA, SABADO])).toBe('às sextas e aos sábados');
  });

  it('domingo abre a semana', () => {
    expect(descreverDiasDeEntrega([DOMINGO, SEXTA])).toBe('aos domingos e às sextas');
  });
});

describe('operação sem dia de entrega ativo', () => {
  it('não inventa frase — anunciar entrega que a operação não faz é pior que não anunciar', () => {
    expect(descreverDiasDeEntrega([])).toBeNull();
    expect(descreverCobertura({ dias: [], raioKm: 12, cidade: 'Brasília' })).toBeNull();
  });
});

describe('raio derivado da configuração (RN17)', () => {
  it('inteiro não ganha casa decimal', () => {
    expect(descreverRaio(12)).toBe('12 km');
    expect(descreverRaio(15)).toBe('15 km');
  });

  it('fração usa vírgula, como todo número do site', () => {
    expect(descreverRaio(12.5)).toBe('12,5 km');
  });
});

describe('frase completa para e-mail e checkout', () => {
  it('monta a cobertura a partir da configuração, sem número cravado', () => {
    expect(descreverCobertura({ dias: [SEXTA], raioKm: 12, cidade: 'Brasília' })).toBe(
      'Entregamos às sextas em Brasília, num raio de 12 km da cozinha.',
    );
  });

  it('ligar a quarta e esticar o raio muda a frase sem tocar em código', () => {
    expect(descreverCobertura({ dias: [QUARTA, SEXTA], raioKm: 15, cidade: 'Brasília' })).toBe(
      'Entregamos às quartas e sextas em Brasília, num raio de 15 km da cozinha.',
    );
  });
});
