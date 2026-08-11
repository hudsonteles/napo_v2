import { describe, expect, it } from 'vitest';

import {
  ESPERA_REENVIO_SEGUNDOS,
  MAX_ENVIOS_POR_IP_24H,
  MAX_ENVIOS_POR_NUMERO_24H,
  MAX_TENTATIVAS,
  avaliarConferencia,
  avaliarReenvio,
  avaliarTetoDeEnvio,
  expiracaoDe,
  gerarCodigo,
  tentativasRestantes,
} from './codigo';

const EMISSAO = new Date('2026-08-11T12:00:00Z');

describe('T11 — código de 6 dígitos (RN6)', () => {
  it('preserva zeros à esquerda', () => {
    expect(gerarCodigo(() => 42)).toBe('000042');
    expect(gerarCodigo(() => 0)).toBe('000000');
    expect(gerarCodigo(() => 999999)).toBe('999999');
  });

  it('gera sempre 6 caracteres numéricos', () => {
    for (let i = 0; i < 1000; i += 1) {
      const codigo = gerarCodigo((limite) => Math.floor(Math.random() * limite));
      expect(codigo).toMatch(/^\d{6}$/);
    }
  });

  it('sorteia dentro do espaço de 6 dígitos', () => {
    let limiteRecebido = 0;
    gerarCodigo((limite) => {
      limiteRecebido = limite;
      return 0;
    });
    expect(limiteRecebido).toBe(1_000_000);
  });
});

describe('T12 — expiração em 10 minutos (RN6)', () => {
  it('expira 10 minutos após a emissão', () => {
    expect(expiracaoDe(EMISSAO)).toEqual(new Date('2026-08-11T12:10:00Z'));
  });

  it('é válido aos 9 minutos e expirado aos 11', () => {
    const expira = expiracaoDe(EMISSAO);
    const estado = { tentativas: 0, expiraEm: expira, validadoEm: null };

    expect(avaliarConferencia(estado, new Date('2026-08-11T12:09:00Z'))).toBe('pode_conferir');
    expect(avaliarConferencia(estado, new Date('2026-08-11T12:11:00Z'))).toBe('expirado');
  });
});

describe('T13 — tentativas (RN6)', () => {
  it('permite conferir até a quinta tentativa', () => {
    const estado = { tentativas: 4, expiraEm: expiracaoDe(EMISSAO), validadoEm: null };
    expect(avaliarConferencia(estado, EMISSAO)).toBe('pode_conferir');
  });

  it('esgota após a quinta tentativa errada', () => {
    const estado = { tentativas: MAX_TENTATIVAS, expiraEm: expiracaoDe(EMISSAO), validadoEm: null };
    expect(avaliarConferencia(estado, EMISSAO)).toBe('tentativas_esgotadas');
  });

  it('recusa código já validado', () => {
    const estado = { tentativas: 1, expiraEm: expiracaoDe(EMISSAO), validadoEm: EMISSAO };
    expect(avaliarConferencia(estado, EMISSAO)).toBe('ja_validado');
  });

  it('conta quantas tentativas restam', () => {
    expect(tentativasRestantes(0)).toBe(5);
    expect(tentativasRestantes(4)).toBe(1);
    expect(tentativasRestantes(5)).toBe(0);
    expect(tentativasRestantes(9)).toBe(0);
  });
});

describe('T14 — reenvio e tetos diários (RN7)', () => {
  it('recusa reenvio antes de 60 segundos', () => {
    const ultimoEnvio = new Date('2026-08-11T12:00:00Z');
    const decisao = avaliarReenvio(ultimoEnvio, new Date('2026-08-11T12:00:59Z'));
    expect(decisao).toEqual({ permitido: false, segundosRestantes: 1 });
  });

  it('permite reenvio a partir de 60 segundos', () => {
    const ultimoEnvio = new Date('2026-08-11T12:00:00Z');
    expect(avaliarReenvio(ultimoEnvio, new Date('2026-08-11T12:01:00Z'))).toEqual({
      permitido: true,
      segundosRestantes: 0,
    });
  });

  it('permite o primeiro envio', () => {
    expect(avaliarReenvio(null, EMISSAO)).toEqual({ permitido: true, segundosRestantes: 0 });
  });

  it('a espera é de 60 segundos', () => {
    expect(ESPERA_REENVIO_SEGUNDOS).toBe(60);
  });

  it('recusa acima do teto por número', () => {
    expect(avaliarTetoDeEnvio(MAX_ENVIOS_POR_NUMERO_24H, 0)).toEqual({
      permitido: false,
      motivo: 'teto_numero',
    });
  });

  it('recusa acima do teto por IP', () => {
    expect(avaliarTetoDeEnvio(0, MAX_ENVIOS_POR_IP_24H)).toEqual({
      permitido: false,
      motivo: 'teto_ip',
    });
  });

  it('permite abaixo dos dois tetos', () => {
    expect(avaliarTetoDeEnvio(MAX_ENVIOS_POR_NUMERO_24H - 1, MAX_ENVIOS_POR_IP_24H - 1)).toEqual({
      permitido: true,
    });
  });

  it('o teto por IP é o dobro do teto por número', () => {
    expect(MAX_ENVIOS_POR_IP_24H).toBe(MAX_ENVIOS_POR_NUMERO_24H * 2);
  });
});
