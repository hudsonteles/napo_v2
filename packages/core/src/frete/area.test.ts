import { describe, expect, it } from 'vitest';

import { avaliarArea, type ExcecaoArea } from './area';

const RAIO_KM = 12;

function avaliar(distanciaKm: number, cep: string, excecoes: ExcecaoArea[] = []) {
  return avaliarArea({ distanciaKm, cep, raioKm: RAIO_KM, excecoes });
}

describe('T25 — borda exata do raio (RN9)', () => {
  it('12,00 km é atendido: o limite inclui a borda', () => {
    expect(avaliar(12.0, '70862-030').atendido).toBe(true);
  });

  it('12,01 km já está fora', () => {
    const resultado = avaliar(12.01, '70862-030');

    expect(resultado.atendido).toBe(false);
    expect(resultado.motivo).toContain('12');
  });
});

describe('T12 — fora do raio salva, mas não vende (RN9)', () => {
  it('28,6 km não é atendido e o motivo diz por quê', () => {
    const resultado = avaliar(28.6, '73255-900');

    expect(resultado.atendido).toBe(false);
    expect(resultado.motivo).not.toBeNull();
  });
});

describe('T13 — exceção de CEP vence o raio (RN10)', () => {
  const excecoes: ExcecaoArea[] = [
    { tipo: 'bloqueio', cepPrefixo: '71680', motivo: 'condomínio não autoriza entrega' },
    { tipo: 'liberacao', cepPrefixo: '73255', motivo: 'rota semanal já passa em Sobradinho' },
  ];

  it('bloqueio recusa endereço dentro do raio, com o motivo cadastrado', () => {
    const resultado = avaliar(6, '71680-000', excecoes);

    expect(resultado.atendido).toBe(false);
    expect(resultado.motivo).toBe('condomínio não autoriza entrega');
  });

  it('liberação atende endereço fora do raio, com o motivo cadastrado', () => {
    const resultado = avaliar(15, '73255-900', excecoes);

    expect(resultado.atendido).toBe(true);
    expect(resultado.motivo).toBe('rota semanal já passa em Sobradinho');
  });

  it('CEP sem relação com as exceções continua decidido pelo raio', () => {
    expect(avaliar(6, '70862-030', excecoes).atendido).toBe(true);
    expect(avaliar(15, '70862-030', excecoes).atendido).toBe(false);
  });
});

describe('normalização e especificidade do prefixo (RN10)', () => {
  const excecoes: ExcecaoArea[] = [
    { tipo: 'bloqueio', cepPrefixo: '716', motivo: 'região inteira suspensa' },
    { tipo: 'liberacao', cepPrefixo: '71680', motivo: 'exceção do condomínio X' },
  ];

  it('ignora máscara do CEP — hífen não muda decisão de área', () => {
    expect(avaliar(6, '71680000', excecoes)).toEqual(avaliar(6, '71680-000', excecoes));
  });

  it('o prefixo mais específico vence — senão a regra geral engole a exceção dela', () => {
    expect(avaliar(6, '71680-000', excecoes).motivo).toBe('exceção do condomínio X');
    expect(avaliar(6, '71690-000', excecoes).motivo).toBe('região inteira suspensa');
  });
});

describe('distância desconhecida', () => {
  it('não é atendido: sem distância medida não há promessa de entrega a fazer', () => {
    const resultado = avaliarArea({
      distanciaKm: null,
      cep: '70862-030',
      raioKm: RAIO_KM,
      excecoes: [],
    });

    expect(resultado.atendido).toBe(false);
  });

  it('mas uma liberação explícita ainda vale — a exceção é decisão humana registrada', () => {
    const resultado = avaliarArea({
      distanciaKm: null,
      cep: '73255-900',
      raioKm: RAIO_KM,
      excecoes: [{ tipo: 'liberacao', cepPrefixo: '73255', motivo: 'rota semanal' }],
    });

    expect(resultado.atendido).toBe(true);
  });
});
