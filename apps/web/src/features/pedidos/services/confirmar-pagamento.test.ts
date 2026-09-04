import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processarNotificacao, reconciliarPedido } from './confirmar-pagamento';
import type { DependenciasDaConfirmacao } from './confirmar-pagamento';
import type { PedidoLido, RepositorioDePedidos } from './pedidos-repo';

const PEDIDO_ID = 'pedido-1';
const PRODUTO = 'produto-1';

const PEDIDO: PedidoLido = {
  id: PEDIDO_ID,
  numero: 1042,
  profileId: 'u-1',
  status: 'aguardando_pagamento',
  diaEntrega: '2026-08-22',
  totalCentavos: 13570,
  mpPaymentId: null,
  itens: [{ produtoId: PRODUTO, quantidade: 3 }],
};

const APROVADO = {
  id: 'pag-1',
  status: 'aprovado' as const,
  valorCentavos: 13570,
  forma: 'pix',
  referenciaExterna: PEDIDO_ID,
};

function repo(parcial: Partial<RepositorioDePedidos> = {}) {
  return {
    lerPedido: vi.fn().mockResolvedValue(PEDIDO),
    lerPedidoPorNumero: vi.fn(),
    confirmarPagamento: vi.fn().mockResolvedValue(true),
    marcarEstornado: vi.fn().mockResolvedValue(undefined),
    cancelarPedido: vi.fn(),
    registrarEvento: vi.fn().mockResolvedValue(undefined),
    pedidosVencidos: vi.fn(),
    expirarPedidos: vi.fn(),
    pagamentoMinutos: vi.fn(),
    reservarCarrinho: vi.fn(),
    gravarPedido: vi.fn(),
    registrarPreferencia: vi.fn(),
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
      pedidoId: PEDIDO_ID,
      mpPaymentId: 'pag-1',
      forma: 'pix',
      veredito: 'viavel',
    });
    expect(resposta).toEqual({ http: 200, resultado: 'confirmado' });
  });

  it('T7 — pedido já pago não é reprocessado e responde 200', async () => {
    const repositorio = repo({
      lerPedido: vi.fn().mockResolvedValue({ ...PEDIDO, status: 'pago', mpPaymentId: 'pag-1' }),
    });

    const resposta = await processarNotificacao('pag-1', deps({ repo: repositorio }));

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

  it('T39 — estorno notificado leva o pedido a estornado, com a devolução registrada', async () => {
    const repositorio = repo({
      lerPedido: vi.fn().mockResolvedValue({ ...PEDIDO, status: 'pago' }),
    });

    const resposta = await processarNotificacao(
      'pag-1',
      deps({
        repo: repositorio,
        consultarPagamento: vi.fn().mockResolvedValue({ ...APROVADO, status: 'estornado' }),
      }),
    );

    expect(repositorio.marcarEstornado).toHaveBeenCalledWith(PEDIDO_ID);
    expect(repositorio.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({ detalhe: 'estorno: devolucao capacidade' }),
    );
    expect(resposta.http).toBe(200);
  });

  it('estorno que chega duas vezes não reprocessa', async () => {
    const repositorio = repo({
      lerPedido: vi.fn().mockResolvedValue({ ...PEDIDO, status: 'estornado' }),
    });

    await processarNotificacao(
      'pag-1',
      deps({
        repo: repositorio,
        consultarPagamento: vi.fn().mockResolvedValue({ ...APROVADO, status: 'estornado' }),
      }),
    );

    expect(repositorio.marcarEstornado).not.toHaveBeenCalled();
  });
});

describe('reconciliarPedido', () => {
  beforeEach(() => vi.clearAllMocks());

  it('T38 — webhook perdido é recuperado pela busca por referência', async () => {
    const repositorio = repo();

    const resposta = await reconciliarPedido(PEDIDO, deps({ repo: repositorio }));

    expect(repositorio.confirmarPagamento).toHaveBeenCalledWith(
      expect.objectContaining({ pedidoId: PEDIDO_ID, mpPaymentId: 'pag-1' }),
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
