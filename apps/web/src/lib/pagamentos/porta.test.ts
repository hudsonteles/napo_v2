import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPagamentoEnv = vi.fn();

vi.mock('@/lib/env', () => ({ getPagamentoEnv: () => getPagamentoEnv() }));
vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class {},
  Preference: class {},
  Payment: class {},
}));

const COBRANCA = {
  referenciaExterna: 'pedido-1',
  numeroPedido: 1042,
  itens: [
    { titulo: 'Calabresa', quantidade: 2, precoUnitarioCentavos: 6490 },
    { titulo: 'Margherita', quantidade: 1, precoUnitarioCentavos: 5990 },
  ],
  freteCentavos: 1000,
  urlRetorno: 'https://napobsb.com.br/pedido/1042',
};

async function carregarPorta(provider: string) {
  vi.resetModules();
  getPagamentoEnv.mockReturnValue({
    PAGAMENTO_PROVIDER: provider,
    MP_ACCESS_TOKEN: 'token',
    MP_WEBHOOK_SECRET: 'segredo',
  });
  const { portaDePagamento } = await import('./porta');
  return portaDePagamento();
}

describe('portaDePagamento', () => {
  beforeEach(() => vi.clearAllMocks());

  it('a variável de ambiente é quem escolhe o gateway', async () => {
    expect((await carregarPorta('fake')).constructor.name).toBe('PagamentoFake');
    expect((await carregarPorta('mercado_pago')).constructor.name).toBe('PagamentoMercadoPago');
  });

  it('a mesma instância atende a cobrança e a consulta', async () => {
    const porta = await carregarPorta('fake');
    const { portaDePagamento } = await import('./porta');

    expect(portaDePagamento()).toBe(porta);
  });
});

describe('PagamentoFake', () => {
  it('devolve o total cobrado, para a conferência de valor ter o que conferir (RN10)', async () => {
    const porta = await carregarPorta('fake');
    const cobranca = await porta.criarCobranca(COBRANCA);
    const idPagamento = new URL(cobranca.urlPagamento).searchParams.get('pagamento_falso');

    const pagamento = await porta.consultarPagamento(idPagamento as string);

    // 2 × 64,90 + 59,90 + 10,00 de frete.
    expect(pagamento).toEqual({
      id: idPagamento,
      status: 'aprovado',
      valorCentavos: 19970,
      forma: 'pix',
      referenciaExterna: 'pedido-1',
    });
  });

  it('o retorno leva de volta ao pedido, sem exigir túnel', async () => {
    const porta = await carregarPorta('fake');

    const { urlPagamento } = await porta.criarCobranca(COBRANCA);

    expect(urlPagamento).toContain('https://napobsb.com.br/pedido/1042');
  });

  it('pagamento que ninguém cobrou não existe', async () => {
    const porta = await carregarPorta('fake');

    expect(await porta.consultarPagamento('fake-pag-inventado')).toBeNull();
  });
});
