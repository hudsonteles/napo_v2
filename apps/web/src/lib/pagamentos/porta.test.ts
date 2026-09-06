import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPagamentoEnv = vi.fn();

vi.mock('@/lib/env', () => ({ getPagamentoEnv: () => getPagamentoEnv() }));
vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class {},
  Payment: class {},
}));

const COBRANCA = {
  cobrancaId: 'c0b-1',
  numeroPedido: 1042,
  valorCentavos: 19970,
  descricao: 'Napo — pedido #1042',
  token: 'tok',
  metodo: 'master',
  parcelas: 1,
  emailPagador: 'cliente@napo.test',
  expiraEm: '2026-09-11T20:30:00.000-03:00',
};

async function carregarPorta(provider: string) {
  vi.resetModules();
  getPagamentoEnv.mockReturnValue({
    PAGAMENTO_PROVIDER: provider,
    MP_ACCESS_TOKEN: 'token',
    MP_WEBHOOK_SECRET: 'segredo',
    NEXT_PUBLIC_MP_PUBLIC_KEY: 'chave-publica',
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
  it('devolve o valor cobrado, para a conferência de valor ter o que conferir (RN17)', async () => {
    const porta = await carregarPorta('fake');
    const { idPagamento } = await porta.criarCobranca(COBRANCA);

    expect(await porta.consultarPagamento(idPagamento)).toEqual({
      id: idPagamento,
      status: 'aprovado',
      valorCentavos: 19970,
      forma: 'master',
      detalhe: 'accredited',
      referenciaExterna: 'c0b-1',
    });
  });

  it('o método escolhe o desfecho, para recusa e pendência serem exercitáveis sem túnel', async () => {
    const porta = await carregarPorta('fake');

    const recusada = await porta.criarCobranca({ ...COBRANCA, cobrancaId: 'c0b-2', metodo: 'recusar' });
    expect(recusada.status).toBe('recusado');
    expect(recusada.detalhe).toBe('cc_rejected_insufficient_amount');

    const pendente = await porta.criarCobranca({ ...COBRANCA, cobrancaId: 'c0b-3', metodo: 'pendente' });
    expect(pendente.status).toBe('pendente');
    expect((await porta.consultarPagamento(pendente.idPagamento))?.status).toBe('pendente');
  });

  it('RN11 — o Pix devolve o código que a nossa tela desenha', async () => {
    const porta = await carregarPorta('fake');

    const { pix } = await porta.criarCobranca({ ...COBRANCA, cobrancaId: 'c0b-4', metodo: 'pix' });

    expect(pix?.codigo).toContain('c0b-4');
  });

  it('a cobrança de uma instância é encontrada por outra', async () => {
    // Cada Route Handler do Next é um bundle próprio: quem cria a cobrança
    // (`POST /api/pagamentos`) não é a mesma instância que a consulta
    // (`GET /api/pedidos/[numero]`). Com o registro preso ao módulo, o pedido
    // ficava eternamente "confirmando".
    const { PagamentoFake } = await import('./fake');
    const criador = new PagamentoFake();
    const consultor = new PagamentoFake();

    const { idPagamento } = await criador.criarCobranca({ ...COBRANCA, cobrancaId: 'c0b-5' });

    expect(await consultor.consultarPagamento(idPagamento)).toMatchObject({
      status: 'aprovado',
      valorCentavos: 19970,
    });
    expect(await consultor.buscarPagamentoDaReferencia('c0b-5')).toMatchObject({
      id: idPagamento,
    });
  });

  it('pagamento que ninguém cobrou não existe', async () => {
    const porta = await carregarPorta('fake');

    expect(await porta.consultarPagamento('fake-pag-inventado')).toBeNull();
  });
});
