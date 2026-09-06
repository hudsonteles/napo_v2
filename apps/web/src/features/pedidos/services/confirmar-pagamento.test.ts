import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processarNotificacao, reconciliarPedido } from './confirmar-pagamento';
import type { DependenciasDaConfirmacao } from './confirmar-pagamento';
import type { CobrancaLida, RepositorioDeCobrancas } from './cobrancas-repo';
import type { PedidoLido, RepositorioDePedidos } from './pedidos-repo';

const PEDIDO_ID = 'pedido-1';
const COBRANCA_ID = 'cobranca-1';
const PRODUTO = 'produto-1';

const PEDIDO: PedidoLido = {
  id: PEDIDO_ID,
  numero: 1042,
  profileId: 'u-1',
  status: 'novo',
  situacaoPagamento: 'aguardando',
  diaEntrega: '2026-08-22',
  totalCentavos: 13570,
  expiraEm: '2030-01-01T00:00:00.000Z',
  itens: [{ produtoId: PRODUTO, quantidade: 3 }],
};

const COBRANCA: CobrancaLida = {
  id: COBRANCA_ID,
  pedidoId: PEDIDO_ID,
  instrumento: 'online',
  situacao: 'pendente',
  valorCentavos: 13570,
  mpPaymentId: null,
  expiraEm: '2030-01-01T00:00:00.000Z',
};

// A referência externa aponta para a COBRANÇA: a notificação diz qual
// tentativa foi paga, e duas tentativas do mesmo pedido chegariam
// indistinguíveis se ela apontasse para o pedido.
const APROVADO = {
  id: 'pag-1',
  status: 'aprovado' as const,
  valorCentavos: 13570,
  forma: 'pix',
  detalhe: 'accredited',
  referenciaExterna: COBRANCA_ID,
};

function cobrancasRepo(parcial: Partial<RepositorioDeCobrancas> = {}) {
  return {
    abrir: vi.fn(),
    ler: vi.fn().mockResolvedValue(COBRANCA),
    pendenteDoPedido: vi.fn().mockResolvedValue(COBRANCA),
    registrarTentativa: vi.fn().mockResolvedValue(undefined),
    mudarSituacao: vi.fn().mockResolvedValue(undefined),
    ...parcial,
  } as unknown as RepositorioDeCobrancas & Record<string, ReturnType<typeof vi.fn>>;
}

function repo(parcial: Partial<RepositorioDePedidos> = {}) {
  return {
    lerPedido: vi.fn().mockResolvedValue(PEDIDO),
    lerPedidoPorNumero: vi.fn(),
    confirmarPagamento: vi.fn().mockResolvedValue(true),
    cancelarPedido: vi.fn().mockResolvedValue(true),
    registrarEvento: vi.fn().mockResolvedValue(undefined),
    pedidosVencidos: vi.fn(),
    expirarPedidos: vi.fn(),
    pagamentoMinutos: vi.fn(),
    reservarCarrinho: vi.fn(),
    gravarPedido: vi.fn(),
    desfazerPedido: vi.fn(),
    ...parcial,
  } as unknown as RepositorioDePedidos & Record<string, ReturnType<typeof vi.fn>>;
}

function deps(
  parcial: {
    consultarPagamento?: unknown;
    buscarPagamentoDaReferencia?: unknown;
    veredito?: unknown;
    repo?: RepositorioDePedidos;
    cobrancas?: RepositorioDeCobrancas;
  } = {},
): DependenciasDaConfirmacao {
  return {
    pagamento: {
      criarCobranca: vi.fn(),
      consultarPagamento: vi.fn().mockResolvedValue(APROVADO),
      buscarPagamentoDaReferencia: vi.fn().mockResolvedValue(APROVADO),
      verificarAssinatura: vi.fn(),
      ...(parcial.consultarPagamento
        ? { consultarPagamento: parcial.consultarPagamento }
        : {}),
      ...(parcial.buscarPagamentoDaReferencia
        ? { buscarPagamentoDaReferencia: parcial.buscarPagamentoDaReferencia }
        : {}),
    } as never,
    repo: parcial.repo ?? repo(),
    cobrancas: parcial.cobrancas ?? cobrancasRepo(),
    veredito: (parcial.veredito ?? vi.fn().mockResolvedValue('viavel')) as never,
    devolucao: vi.fn().mockResolvedValue('capacidade') as never,
  };
}

describe('processarNotificacao', () => {
  beforeEach(() => vi.clearAllMocks());

  it('T6 — notificação verificada de pagamento aprovado confirma o pedido', async () => {
    const repositorio = repo();

    const resposta = await processarNotificacao('pag-1', deps({ repo: repositorio }));

    expect(repositorio.confirmarPagamento).toHaveBeenCalledWith({
      cobrancaId: COBRANCA_ID,
      mpPaymentId: 'pag-1',
      forma: 'pix',
      veredito: 'viavel',
    });
    expect(resposta).toEqual({ http: 200, resultado: 'confirmado' });
  });

  it('T7/RN16 — cobrança já aprovada não é reprocessada e responde 200', async () => {
    const repositorio = repo();

    const resposta = await processarNotificacao(
      'pag-1',
      deps({
        repo: repositorio,
        cobrancas: cobrancasRepo({
          ler: vi.fn().mockResolvedValue({ ...COBRANCA, situacao: 'aprovada' }),
        }),
      }),
    );

    expect(repositorio.confirmarPagamento).not.toHaveBeenCalled();
    expect(resposta).toEqual({ http: 200, resultado: 'duplicado' });
  });

  it('T8 — dia inviável nasce pago, com o veredito gravado', async () => {
    const repositorio = repo();

    const resposta = await processarNotificacao(
      'pag-1',
      deps({ repo: repositorio, veredito: vi.fn().mockResolvedValue('sem_vaga') }),
    );

    expect(repositorio.confirmarPagamento).toHaveBeenCalledWith(
      expect.objectContaining({ veredito: 'sem_vaga' }),
    );
    expect(repositorio.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({ resultado: 'confirmado', detalhe: 'sem_vaga' }),
    );
    expect(resposta.http).toBe(200);
  });

  it('T26 — valor divergente não confirma e fica registrado para alerta', async () => {
    const repositorio = repo();

    const resposta = await processarNotificacao(
      'pag-1',
      deps({
        repo: repositorio,
        consultarPagamento: vi.fn().mockResolvedValue({ ...APROVADO, valorCentavos: 100 }),
      }),
    );

    expect(repositorio.confirmarPagamento).not.toHaveBeenCalled();
    expect(repositorio.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        resultado: 'valor_divergente',
        detalhe: 'pago 100, devido 13570',
      }),
    );
    expect(resposta).toEqual({ http: 200, resultado: 'valor_divergente' });
  });

  it('T27 — o corpo da notificação nunca é fonte de status', async () => {
    const repositorio = repo();

    const resposta = await processarNotificacao(
      'pag-1',
      deps({
        repo: repositorio,
        consultarPagamento: vi.fn().mockResolvedValue({ ...APROVADO, status: 'recusado' }),
      }),
      // O corpo grita "aprovado"; a consulta diz "recusado", e é ela que vale.
      { data: { id: 'pag-1' }, status: 'approved', transaction_amount: 135.7 },
    );

    expect(repositorio.confirmarPagamento).not.toHaveBeenCalled();
    expect(resposta).toEqual({ http: 200, resultado: 'pagamento_nao_aprovado' });
  });

  it('T30 — pagamento que o gateway não conhece devolve 5xx para forçar reenvio', async () => {
    const resposta = await processarNotificacao(
      'pag-1',
      deps({ consultarPagamento: vi.fn().mockResolvedValue(null) }),
    );

    expect(resposta.http).toBeGreaterThanOrEqual(500);
  });

  it('notificação de pedido que não existe não vira reenvio infinito', async () => {
    const repositorio = repo({ lerPedido: vi.fn().mockResolvedValue(null) });

    const resposta = await processarNotificacao('pag-1', deps({ repo: repositorio }));

    expect(resposta).toEqual({ http: 200, resultado: 'pedido_desconhecido' });
    expect(repositorio.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({ resultado: 'pedido_desconhecido' }),
    );
  });

  it('T35 — a segunda confirmação simultânea não consome capacidade de novo', async () => {
    // A RPC devolve `false` quando o pedido já estava pago: é a idempotência da
    // RN9 vista pelo lado da aplicação.
    const repositorio = repo({ confirmarPagamento: vi.fn().mockResolvedValue(false) });

    const resposta = await processarNotificacao('pag-1', deps({ repo: repositorio }));

    expect(resposta).toEqual({ http: 200, resultado: 'duplicado' });
  });

  it('T39/RN19 — estorno encerra o pedido no eixo de entrega e devolve a vaga', async () => {
    const repositorio = repo();
    const cobrancas = cobrancasRepo({
      ler: vi.fn().mockResolvedValue({ ...COBRANCA, situacao: 'aprovada' }),
    });

    const resposta = await processarNotificacao(
      'pag-1',
      deps({
        repo: repositorio,
        cobrancas,
        consultarPagamento: vi.fn().mockResolvedValue({ ...APROVADO, status: 'estornado' }),
      }),
    );

    expect(cobrancas.mudarSituacao).toHaveBeenCalledWith({
      cobrancaId: COBRANCA_ID,
      situacao: 'estornada',
    });
    // No eixo de entrega, estorno é encerramento: a vaga volta para a fila.
    expect(repositorio.cancelarPedido).toHaveBeenCalledWith(PEDIDO_ID, 'capacidade');
    expect(repositorio.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({ detalhe: 'estorno: devolucao capacidade' }),
    );
    expect(resposta.http).toBe(200);
  });

  it('estorno que chega duas vezes não reprocessa', async () => {
    const repositorio = repo();

    await processarNotificacao(
      'pag-1',
      deps({
        repo: repositorio,
        cobrancas: cobrancasRepo({
          ler: vi.fn().mockResolvedValue({ ...COBRANCA, situacao: 'estornada' }),
        }),
        consultarPagamento: vi.fn().mockResolvedValue({ ...APROVADO, status: 'estornado' }),
      }),
    );

    expect(repositorio.cancelarPedido).not.toHaveBeenCalled();
  });
});

describe('reconciliarPedido', () => {
  beforeEach(() => vi.clearAllMocks());

  it('T38 — webhook perdido é recuperado pela busca por referência', async () => {
    const repositorio = repo();

    const resposta = await reconciliarPedido(PEDIDO, deps({ repo: repositorio }));

    expect(repositorio.confirmarPagamento).toHaveBeenCalledWith(
      expect.objectContaining({ cobrancaId: COBRANCA_ID, mpPaymentId: 'pag-1' }),
    );
    expect(resposta).toEqual({ http: 200, resultado: 'confirmado' });
  });

  it('T38 — pedido sem pagamento nenhum no gateway continua aguardando', async () => {
    const repositorio = repo();

    const resposta = await reconciliarPedido(
      PEDIDO,
      deps({
        repo: repositorio,
        buscarPagamentoDaReferencia: vi.fn().mockResolvedValue(null),
      }),
    );

    expect(repositorio.confirmarPagamento).not.toHaveBeenCalled();
    expect(resposta.resultado).toBe('pagamento_nao_aprovado');
  });
});
