import { describe, expect, it } from 'vitest';

import { formatarTelefoneBR, normalizarTelefoneBR } from './e164';

describe('T9 — normalização para E.164 (RN8)', () => {
  it.each([
    ['(61) 99150-4477'],
    ['61991504477'],
    ['+55 61 99150-4477'],
    ['005561991504477'],
    ['  61 9 9150 4477  '],
    ['+5561991504477'],
  ])('normaliza %s para +5561991504477', (entrada) => {
    const resultado = normalizarTelefoneBR(entrada);
    expect(resultado).toEqual({ valido: true, e164: '+5561991504477' });
  });

  it('não confunde DDD 55 (RS) com o código do país', () => {
    expect(normalizarTelefoneBR('(55) 99150-4477')).toEqual({
      valido: true,
      e164: '+5555991504477',
    });
  });

  it('formata de volta para exibição', () => {
    expect(formatarTelefoneBR('+5561991504477')).toBe('(61) 99150-4477');
  });
});

describe('T10 — recusa o que não é celular brasileiro (RN8)', () => {
  it('recusa telefone fixo', () => {
    expect(normalizarTelefoneBR('(61) 3321-4477')).toEqual({
      valido: false,
      motivo: 'nao_celular',
    });
  });

  it('recusa DDD inexistente', () => {
    expect(normalizarTelefoneBR('(00) 99150-4477')).toEqual({
      valido: false,
      motivo: 'ddd_inexistente',
    });
    expect(normalizarTelefoneBR('(23) 99150-4477')).toEqual({
      valido: false,
      motivo: 'ddd_inexistente',
    });
  });

  it.each([['619915044'], ['619915044771'], [''], ['abcdefghijk'], ['+351 912 345 678']])(
    'recusa %s por formato',
    (entrada) => {
      expect(normalizarTelefoneBR(entrada)).toEqual({ valido: false, motivo: 'formato' });
    },
  );

  it('recusa celular sem o nono dígito', () => {
    expect(normalizarTelefoneBR('(61) 89150-4477')).toEqual({
      valido: false,
      motivo: 'nao_celular',
    });
  });

  // Estrangeiro de 11 dígitos é indistinguível de nacional mal digitado: +1 415
  // 555 2671 vira DDD 14 (que existe) sem nono dígito. Recusar é o que importa;
  // o motivo exato não é observável sem saber o país de origem.
  it('recusa estrangeiro que colide com o formato nacional', () => {
    expect(normalizarTelefoneBR('+1 415 555 2671')).toEqual({
      valido: false,
      motivo: 'nao_celular',
    });
  });
});
