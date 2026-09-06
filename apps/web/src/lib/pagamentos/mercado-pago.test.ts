import { beforeEach, describe, expect, it, vi } from 'vitest';

const criarPagamento = vi.fn();
const buscarPagamento = vi.fn();
const procurarPagamento = vi.fn();

vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class {},
  Payment: class {
    create = criarPagamento;
    get = buscarPagamento;
    search = procurarPagamento;
  },
}));

const { PagamentoMercadoPago } = await import('./mercado-pago');

const CREDENCIAIS = { accessToken: 'token', webhookSecret: 'segredo' };

const ENTRADA = {
  cobrancaId: '7c0b0000-0000-0000-0000-000000000001',
  numeroPedido: 1042,
  valorCentavos: 13970,
  descricao: 'Napo — pedido #1042',
  token: 'tok-do-brick',
  metodo: 'master',
  parcelas: 1,
  emailPagador: 'cliente@napo.test',
  expiraEm: '2026-09-11T20:30:00.000-03:00',
};

/** Erro no formato que o SDK do Mercado Pago levanta. */
function erroDoSdk(status: number) {
  return Object.assign(new Error('erro do gateway'), { status });
}

describe('PagamentoMercadoPago.criarCobranca', () => {
  beforeEach(() => vi.clearAllMocks());

  it('manda o valor em reais e amarra a notificação à cobrança, não ao pedido', async () => {
    criarPagamento.mockResolvedValueOnce({ id: 123, status: 'approved', status_detail: 'accredited' });

    await new PagamentoMercadoPago(CREDENCIAIS).criarCobranca(ENTRADA);

    const [{ body }] = criarPagamento.mock.calls[0] as [{ body: Record<string, unknown> }];
    expect(body.transaction_amount).toBe(139.7);
    expect(body.external_reference).toBe(ENTRADA.cobrancaId);
    expect(body.token).toBe('tok-do-brick');
    expect(body.date_of_expiration).toBe(new Date(ENTRADA.expiraEm).toISOString());
  });

  it('a data de expiração vai no formato que o gateway aceita, não no do Postgres', async () => {
    // `timestamptz` chega com seis casas de microssegundo e o Mercado Pago
    // recusa com 400. Traduzir é obrigação do adaptador.
    criarPagamento.mockResolvedValueOnce({ id: 4, status: 'approved' });

    await new PagamentoMercadoPago(CREDENCIAIS).criarCobranca({
      ...ENTRADA,
      expiraEm: '2026-09-11T20:30:00.123456+00:00',
    });

    const [{ body }] = criarPagamento.mock.calls[0] as [{ body: Record<string, unknown> }];
    expect(body.date_of_expiration).toBe('2026-09-11T20:30:00.123Z');
  });

  it('T20/RN10 — envia a chave de idempotência derivada da cobrança', async () => {
    criarPagamento.mockResolvedValueOnce({ id: 123, status: 'approved' });

    await new PagamentoMercadoPago(CREDENCIAIS).criarCobranca(ENTRADA);

    const [{ requestOptions }] = criarPagamento.mock.calls[0] as [
      { requestOptions: { idempotencyKey: string } },
    ];
    expect(requestOptions.idempotencyKey).toBe(ENTRADA.cobrancaId);
  });

  it('RN12 — cartão responde na hora: nada de "em análise" contra uma reserva de 30 min', async () => {
    criarPagamento.mockResolvedValueOnce({ id: 5, status: 'approved' });

    await new PagamentoMercadoPago(CREDENCIAIS).criarCobranca(ENTRADA);

    const [{ body }] = criarPagamento.mock.calls[0] as [{ body: Record<string, unknown> }];
    expect(body.binary_mode).toBe(true);
  });

  it('Pix não leva binary_mode: pendente é a natureza do meio', async () => {
    criarPagamento.mockResolvedValueOnce({ id: 6, status: 'pending' });

    await new PagamentoMercadoPago(CREDENCIAIS).criarCobranca({
      ...ENTRADA,
      metodo: 'pix',
      token: undefined,
    });

    const [{ body }] = criarPagamento.mock.calls[0] as [{ body: Record<string, unknown> }];
    expect(body.binary_mode).toBeUndefined();
  });

  it('devolve o QR quando o meio é Pix', async () => {
    criarPagamento.mockResolvedValueOnce({
      id: 9,
      status: 'pending',
      point_of_interaction: {
        transaction_data: { qr_code: '00020126...BR', qr_code_base64: 'iVBORw0KGgo=' },
      },
    });

    const criada = await new PagamentoMercadoPago(CREDENCIAIS).criarCobranca({
      ...ENTRADA,
      metodo: 'pix',
      token: undefined,
    });

    expect(criada.status).toBe('pendente');
    expect(criada.pix).toEqual({ codigo: '00020126...BR', imagemBase64: 'iVBORw0KGgo=' });
  });

  it('guarda o motivo cru da recusa para auditoria, sem interpretá-lo', async () => {
    criarPagamento.mockResolvedValueOnce({
      id: 7,
      status: 'rejected',
      status_detail: 'cc_rejected_insufficient_amount',
    });

    const criada = await new PagamentoMercadoPago(CREDENCIAIS).criarCobranca(ENTRADA);

    expect(criada.status).toBe('recusado');
    expect(criada.detalhe).toBe('cc_rejected_insufficient_amount');
  });

  it('status novo do gateway não confirma pedido por omissão', async () => {
    criarPagamento.mockResolvedValueOnce({ id: 8, status: 'algo_que_o_mp_inventou' });

    const criada = await new PagamentoMercadoPago(CREDENCIAIS).criarCobranca(ENTRADA);

    expect(criada.status).toBe('pendente');
  });
});

describe('PagamentoMercadoPago.consultarPagamento', () => {
  beforeEach(() => vi.clearAllMocks());

  it('T25/RN14 — pagamento que o gateway não conhece devolve nulo, não exceção', async () => {
    // O SDK lança no 404. Deixar a exceção subir faz o webhook responder 500
    // sem gravar linha nenhuma em `pagamento_eventos` — o defeito observado com
    // o gateway real em 2026-09-05.
    buscarPagamento.mockRejectedValueOnce(erroDoSdk(404));

    const consultado = await new PagamentoMercadoPago(CREDENCIAIS).consultarPagamento('nao-existe');

    expect(consultado).toBeNull();
  });

  it('RN14 — gateway fora do ar continua sendo erro, não "não encontrado"', async () => {
    buscarPagamento.mockRejectedValueOnce(erroDoSdk(503));

    await expect(
      new PagamentoMercadoPago(CREDENCIAIS).consultarPagamento('qualquer'),
    ).rejects.toThrow();
  });

  it('converte o valor para centavos e devolve o detalhe', async () => {
    buscarPagamento.mockResolvedValueOnce({
      id: 123,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 139.7,
      payment_method_id: 'pix',
      external_reference: ENTRADA.cobrancaId,
    });

    const consultado = await new PagamentoMercadoPago(CREDENCIAIS).consultarPagamento('123');

    expect(consultado).toEqual({
      id: '123',
      status: 'aprovado',
      valorCentavos: 13970,
      forma: 'pix',
      detalhe: 'accredited',
      referenciaExterna: ENTRADA.cobrancaId,
    });
  });
});

describe('PagamentoMercadoPago.buscarPagamentoDaReferencia', () => {
  beforeEach(() => vi.clearAllMocks());

  it('RN19 — procura pela referência da cobrança', async () => {
    procurarPagamento.mockResolvedValueOnce({
      results: [{ id: 55, status: 'approved', transaction_amount: 10, external_reference: 'c-1' }],
    });

    const achado = await new PagamentoMercadoPago(CREDENCIAIS).buscarPagamentoDaReferencia('c-1');

    const [{ options }] = procurarPagamento.mock.calls[0] as [
      { options: { external_reference: string } },
    ];
    expect(options.external_reference).toBe('c-1');
    expect(achado?.id).toBe('55');
  });

  it('RN14 — referência desconhecida devolve nulo mesmo quando o SDK lança', async () => {
    procurarPagamento.mockRejectedValueOnce(erroDoSdk(404));

    expect(
      await new PagamentoMercadoPago(CREDENCIAIS).buscarPagamentoDaReferencia('c-2'),
    ).toBeNull();
  });
});
