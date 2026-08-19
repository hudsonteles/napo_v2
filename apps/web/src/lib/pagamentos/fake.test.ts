import { describe, expect, it } from 'vitest';

import { PortaFake } from './fake';

const porta = new PortaFake();

const INPUT = {
  numeroPedido: 'NAPO-2026-000123',
  descricao: 'Pedido Napo',
  totalCentavos: 13570,
  urlRetorno: 'http://localhost:3000/pedido/NAPO-2026-000123',
  urlWebhook: 'http://localhost:3000/api/webhook/mp',
};

describe('PortaFake', () => {
  it('T27 — o valor vem da consulta, não do corpo: round-trip fecha no mesmo número', async () => {
    const cobranca = await porta.criarCobranca(INPUT);
    const url = new URL(cobranca.urlPagamento);
    const paymentId = url.searchParams.get('payment_id') as string;

    const consulta = await porta.consultarPagamento(paymentId);

    expect(consulta.status).toBe('aprovado');
    expect(consulta.valorCentavos).toBe(INPUT.totalCentavos);
  });

  it('embute o número do pedido na preferência e redireciona ao retorno', async () => {
    const cobranca = await porta.criarCobranca(INPUT);
    expect(cobranca.preferenceId).toContain(INPUT.numeroPedido);
    expect(cobranca.urlPagamento).toContain(INPUT.urlRetorno);
  });

  it('não valida assinatura em desenvolvimento (não há assinatura real)', () => {
    expect(porta.verificarAssinatura()).toBe(true);
  });
});
