import { beforeEach, describe, expect, it, vi } from 'vitest';

const criarPreferencia = vi.fn();
const buscarPagamento = vi.fn();

vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class {},
  Preference: class {
    create = criarPreferencia;
  },
  Payment: class {
    get = buscarPagamento;
  },
}));

const { PagamentoMercadoPago } = await import('./mercado-pago');

const CREDENCIAIS = { accessToken: 'token', webhookSecret: 'segredo' };

const COBRANCA = {
  referenciaExterna: 'pedido-1',
  numeroPedido: 1042,
  itens: [{ titulo: 'Calabresa', quantidade: 2, precoUnitarioCentavos: 6490 }],
  freteCentavos: 1000,
  urlRetorno: 'https://napobsb.com.br/pedido/1042',
};

describe('PagamentoMercadoPago', () => {
  beforeEach(() => vi.clearAllMocks());

  it('manda o valor em reais e amarra a preferência ao pedido', async () => {
    criarPreferencia.mockResolvedValueOnce({ id: 'pref-1', init_point: 'https://mp/pagar' });

    const cobranca = await new PagamentoMercadoPago(CREDENCIAIS).criarCobranca(COBRANCA);

    const [{ body }] = criarPreferencia.mock.calls[0] as [{ body: Record<string, unknown> }];
    expect(body.external_reference).toBe('pedido-1');
    expect(body.items).toEqual([
      expect.objectContaining({ quantity: 2, unit_price: 64.9, currency_id: 'BRL' }),
    ]);
    expect(body.shipments).toEqual({ cost: 10, mode: 'not_specified' });
    expect(cobranca).toEqual({ preferenciaId: 'pref-1', urlPagamento: 'https://mp/pagar' });
  });

  it('preferência sem URL de pagamento é erro, não cobrança vazia', async () => {
    criarPreferencia.mockResolvedValueOnce({ id: 'pref-1' });

    await expect(new PagamentoMercadoPago(CREDENCIAIS).criarCobranca(COBRANCA)).rejects.toThrow(
      /sem id ou sem URL/,
    );
  });

  it('T27 — o status e o valor saem da consulta, em centavos', async () => {
    buscarPagamento.mockResolvedValueOnce({
      id: 123456,
      status: 'rejected',
      transaction_amount: 135.7,
      payment_method_id: 'pix',
      external_reference: 'pedido-1',
    });

    const pagamento = await new PagamentoMercadoPago(CREDENCIAIS).consultarPagamento('123456');

    expect(pagamento).toEqual({
      id: '123456',
      status: 'recusado',
      valorCentavos: 13570,
      forma: 'pix',
      referenciaExterna: 'pedido-1',
    });
  });

  it('status desconhecido não confirma pagamento', async () => {
    buscarPagamento.mockResolvedValueOnce({ id: 1, status: 'status_que_ainda_nao_existe' });

    const pagamento = await new PagamentoMercadoPago(CREDENCIAIS).consultarPagamento('1');

    expect(pagamento?.status).toBe('pendente');
  });

  it('estorno e chargeback chegam como estornado (RN14)', async () => {
    for (const status of ['refunded', 'charged_back']) {
      buscarPagamento.mockResolvedValueOnce({ id: 1, status, transaction_amount: 10 });
      const pagamento = await new PagamentoMercadoPago(CREDENCIAIS).consultarPagamento('1');
      expect(pagamento?.status).toBe('estornado');
    }
  });

  it('pagamento inexistente devolve null', async () => {
    buscarPagamento.mockResolvedValueOnce(null);

    expect(await new PagamentoMercadoPago(CREDENCIAIS).consultarPagamento('999')).toBeNull();
  });
});
