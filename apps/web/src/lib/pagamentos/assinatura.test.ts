import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verificarAssinaturaMercadoPago } from './assinatura';

const SEGREDO = 'segredo-de-teste';
const DATA_ID = '1234567890';
const REQUEST_ID = 'req-abc';
const TS = '1755300000';

function assinar(manifesto: string, segredo = SEGREDO) {
  return createHmac('sha256', segredo).update(manifesto).digest('hex');
}

function cabecalho(hash: string, ts = TS) {
  return `ts=${ts},v1=${hash}`;
}

const VALIDA = cabecalho(assinar(`id:${DATA_ID};request-id:${REQUEST_ID};ts:${TS};`));

describe('verificarAssinaturaMercadoPago (RN10)', () => {
  it('T25 — aceita a assinatura que o segredo produz', () => {
    expect(
      verificarAssinaturaMercadoPago(
        { assinatura: VALIDA, requestId: REQUEST_ID, dataId: DATA_ID },
        SEGREDO,
      ),
    ).toBe(true);
  });

  it('T25 — recusa assinatura forjada com outro segredo', () => {
    const forjada = cabecalho(
      assinar(`id:${DATA_ID};request-id:${REQUEST_ID};ts:${TS};`, 'segredo-do-atacante'),
    );

    expect(
      verificarAssinaturaMercadoPago(
        { assinatura: forjada, requestId: REQUEST_ID, dataId: DATA_ID },
        SEGREDO,
      ),
    ).toBe(false);
  });

  it('T25 — recusa quando o id notificado não é o que foi assinado', () => {
    expect(
      verificarAssinaturaMercadoPago(
        { assinatura: VALIDA, requestId: REQUEST_ID, dataId: '9999999999' },
        SEGREDO,
      ),
    ).toBe(false);
  });

  it('T25 — recusa cabeçalho ausente, incompleto ou sem segredo', () => {
    const entrada = { assinatura: VALIDA, requestId: REQUEST_ID, dataId: DATA_ID };

    expect(verificarAssinaturaMercadoPago({ ...entrada, assinatura: null }, SEGREDO)).toBe(false);
    expect(verificarAssinaturaMercadoPago({ ...entrada, assinatura: 'v1=só-hash' }, SEGREDO)).toBe(
      false,
    );
    expect(verificarAssinaturaMercadoPago({ ...entrada, requestId: null }, SEGREDO)).toBe(false);
    expect(verificarAssinaturaMercadoPago({ ...entrada, dataId: null }, SEGREDO)).toBe(false);
    expect(verificarAssinaturaMercadoPago(entrada, '')).toBe(false);
  });

  it('T25 — hash de tamanho diferente não derruba a verificação', () => {
    expect(
      verificarAssinaturaMercadoPago(
        { assinatura: cabecalho('abc'), requestId: REQUEST_ID, dataId: DATA_ID },
        SEGREDO,
      ),
    ).toBe(false);
  });

  it('T25 — o id alfanumérico é comparado em minúsculas, como o manifesto do Mercado Pago', () => {
    const id = 'AbC123';
    const hash = assinar(`id:${id.toLowerCase()};request-id:${REQUEST_ID};ts:${TS};`);

    expect(
      verificarAssinaturaMercadoPago(
        { assinatura: cabecalho(hash), requestId: REQUEST_ID, dataId: id },
        SEGREDO,
      ),
    ).toBe(true);
  });
});
