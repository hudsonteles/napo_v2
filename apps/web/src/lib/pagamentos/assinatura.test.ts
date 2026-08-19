import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verificarAssinaturaMercadoPago } from './assinatura';

const SEGREDO = 'segredo-de-teste';
const DATA_ID = '123456';
const REQUEST_ID = 'req-abc';
const TS = '1700000000';

function assinar(dataId = DATA_ID, requestId: string | null = REQUEST_ID, ts = TS) {
  let manifesto = `id:${dataId};`;
  if (requestId) manifesto += `request-id:${requestId};`;
  manifesto += `ts:${ts};`;
  const v1 = createHmac('sha256', SEGREDO).update(manifesto).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

describe('verificarAssinaturaMercadoPago (RN10)', () => {
  it('aceita uma assinatura íntegra', () => {
    const ok = verificarAssinaturaMercadoPago({
      xSignature: assinar(),
      xRequestId: REQUEST_ID,
      dataId: DATA_ID,
      segredo: SEGREDO,
    });
    expect(ok).toBe(true);
  });

  it('T25 — recusa v1 forjado', () => {
    const ok = verificarAssinaturaMercadoPago({
      xSignature: `ts=${TS},v1=${'0'.repeat(64)}`,
      xRequestId: REQUEST_ID,
      dataId: DATA_ID,
      segredo: SEGREDO,
    });
    expect(ok).toBe(false);
  });

  it('T25 — recusa header ausente', () => {
    const ok = verificarAssinaturaMercadoPago({
      xSignature: null,
      xRequestId: REQUEST_ID,
      dataId: DATA_ID,
      segredo: SEGREDO,
    });
    expect(ok).toBe(false);
  });

  it('recusa quando o id assinado não é o id recebido (troca de alvo)', () => {
    const ok = verificarAssinaturaMercadoPago({
      xSignature: assinar('999'),
      xRequestId: REQUEST_ID,
      dataId: DATA_ID,
      segredo: SEGREDO,
    });
    expect(ok).toBe(false);
  });

  it('T30 — verifica de forma síncrona, antes de qualquer I/O', () => {
    // O retorno é um boolean, não uma Promise: assinatura e recusa acontecem sem
    // rede, o que sustenta a resposta rápida do webhook a duplicatas e forjas.
    const resultado = verificarAssinaturaMercadoPago({
      xSignature: assinar(),
      xRequestId: REQUEST_ID,
      dataId: DATA_ID,
      segredo: SEGREDO,
    });
    expect(typeof resultado).toBe('boolean');
  });
});
