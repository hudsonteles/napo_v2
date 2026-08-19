import { beforeEach, describe, expect, it, vi } from 'vitest';

const verificarAssinatura = vi.fn();
const consultarPagamento = vi.fn();
vi.mock('@/lib/pagamentos/porta', () => ({
  portaPagamento: () => ({ verificarAssinatura, consultarPagamento }),
}));

const lerCatalogo = vi.fn();
vi.mock('@/features/catalogo', () => ({ lerCatalogo: (...a: unknown[]) => lerCatalogo(...a) }));

const carregarSnapshot = vi.fn();
vi.mock('@/features/disponibilidade', () => ({
  carregarSnapshot: (...a: unknown[]) => carregarSnapshot(...a),
}));

const repo = {
  lerPedidoParaConfirmacao: vi.fn(),
  registrarEventoPagamento: vi.fn(),
  confirmarPagamentoRpc: vi.fn(),
  estornarPedidoRpc: vi.fn(),
};
vi.mock('./pedidos-repo', () => repo);

const avaliarViabilidade = vi.fn();
const devolucaoPorCancelamento = vi.fn();
vi.mock('@napo/core', async (importActual) => {
  const real = await importActual<typeof import('@napo/core')>();
  return {
    ...real,
    avaliarViabilidade: (...a: unknown[]) => avaliarViabilidade(...a),
    devolucaoPorCancelamento: (...a: unknown[]) => devolucaoPorCancelamento(...a),
  };
});

const { processarNotificacao, confirmarPeloRetorno } = await import('./confirmar-pagamento');

const PID = 'dddddddd-0000-0000-0000-000000000002';

function pedido(extra: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    numero: 1042,
    status: 'aguardando_pagamento',
    totalCentavos: 8580,
    diaEntrega: '2026-10-16',
    mpPaymentId: null,
    itens: [{ produtoId: PID, quantidade: 2 }],
    ...extra,
  };
}

function pagamento(extra: Record<string, unknown> = {}) {
  return { id: 'mp-1', status: 'aprovado', valorCentavos: 8580, numeroPedido: '1042', formaPagamento: 'pix', ...extra };
}

const NOTIF = { dataId: 'mp-1', xSignature: 'ts=1,v1=abc', xRequestId: 'req-1', corpo: { data: { id: 'mp-1' } } };

describe('processarNotificacao', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verificarAssinatura.mockReturnValue(true);
    lerCatalogo.mockResolvedValue({ produtos: [{ produto: { id: PID }, categoria: { ehMassa: false } }] });
    carregarSnapshot.mockResolvedValue({});
    avaliarViabilidade.mockReturnValue('viavel');
    devolucaoPorCancelamento.mockReturnValue('capacidade');
    repo.confirmarPagamentoRpc.mockResolvedValue(true);
    repo.estornarPedidoRpc.mockResolvedValue(true);
  });

  it('T25 — assinatura inválida: 401, evento registrado, sem consultar a fonte', async () => {
    verificarAssinatura.mockReturnValue(false);
    const status = await processarNotificacao(NOTIF);
    expect(status).toBe(401);
    expect(consultarPagamento).not.toHaveBeenCalled();
    expect(repo.registrarEventoPagamento).toHaveBeenCalledWith(
      expect.objectContaining({ resultado: 'assinatura_invalida', mpPaymentId: 'mp-1' }),
    );
  });

  it('T6 — notificação verificada e aprovada confirma o pedido', async () => {
    consultarPagamento.mockResolvedValue(pagamento());
    repo.lerPedidoParaConfirmacao.mockResolvedValue(pedido());

    const status = await processarNotificacao(NOTIF);

    expect(status).toBe(200);
    expect(repo.confirmarPagamentoRpc).toHaveBeenCalledWith('p-1', 'mp-1', 'pix', 'viavel');
    expect(repo.registrarEventoPagamento).toHaveBeenCalledWith(
      expect.objectContaining({ resultado: 'confirmado', pedidoId: 'p-1' }),
    );
  });

  it('T7/T30 — notificação repetida (já pago): 200 sem escrita nem RPC', async () => {
    consultarPagamento.mockResolvedValue(pagamento());
    repo.lerPedidoParaConfirmacao.mockResolvedValue(pedido({ status: 'pago', mpPaymentId: 'mp-1' }));

    const status = await processarNotificacao(NOTIF);

    expect(status).toBe(200);
    expect(repo.confirmarPagamentoRpc).not.toHaveBeenCalled();
    expect(repo.registrarEventoPagamento).not.toHaveBeenCalled();
  });

  it('T27 — corpo diz aprovado, mas a fonte diz recusado: não confirma', async () => {
    consultarPagamento.mockResolvedValue(pagamento({ status: 'recusado' }));
    repo.lerPedidoParaConfirmacao.mockResolvedValue(pedido());

    const status = await processarNotificacao(NOTIF);

    expect(status).toBe(200);
    expect(repo.confirmarPagamentoRpc).not.toHaveBeenCalled();
    expect(repo.registrarEventoPagamento).toHaveBeenCalledWith(
      expect.objectContaining({ resultado: 'pagamento_nao_aprovado' }),
    );
  });

  it('T26 — valor divergente não confirma e registra alerta', async () => {
    consultarPagamento.mockResolvedValue(pagamento({ valorCentavos: 100 }));
    repo.lerPedidoParaConfirmacao.mockResolvedValue(pedido());

    const status = await processarNotificacao(NOTIF);

    expect(status).toBe(200);
    expect(repo.confirmarPagamentoRpc).not.toHaveBeenCalled();
    expect(repo.registrarEventoPagamento).toHaveBeenCalledWith(
      expect.objectContaining({ resultado: 'valor_divergente', detalhe: 'pago 100, total 8580' }),
    );
  });

  it('T8 — aprovado com dia inviável nasce pago com veredito sem_vaga', async () => {
    consultarPagamento.mockResolvedValue(pagamento());
    repo.lerPedidoParaConfirmacao.mockResolvedValue(pedido());
    avaliarViabilidade.mockReturnValue('sem_vaga');

    await processarNotificacao(NOTIF);

    expect(repo.confirmarPagamentoRpc).toHaveBeenCalledWith('p-1', 'mp-1', 'pix', 'sem_vaga');
    expect(repo.registrarEventoPagamento).toHaveBeenCalledWith(
      expect.objectContaining({ resultado: 'confirmado', detalhe: 'veredito sem_vaga' }),
    );
  });

  it('T35 — corrida idempotente (RPC devolve false): 200 sem registrar confirmação', async () => {
    consultarPagamento.mockResolvedValue(pagamento());
    repo.lerPedidoParaConfirmacao.mockResolvedValue(pedido());
    repo.confirmarPagamentoRpc.mockResolvedValue(false);

    const status = await processarNotificacao(NOTIF);

    expect(status).toBe(200);
    expect(repo.registrarEventoPagamento).not.toHaveBeenCalled();
  });

  it('T30 — erro interno na confirmação vira 5xx para o Mercado Pago reenviar', async () => {
    consultarPagamento.mockResolvedValue(pagamento());
    repo.lerPedidoParaConfirmacao.mockResolvedValue(pedido());
    repo.confirmarPagamentoRpc.mockRejectedValue(new Error('banco fora'));

    expect(await processarNotificacao(NOTIF)).toBe(500);
  });

  it('T39 — estorno notificado reflete no pedido com a devolução', async () => {
    consultarPagamento.mockResolvedValue(pagamento({ status: 'estornado' }));
    repo.lerPedidoParaConfirmacao.mockResolvedValue(pedido({ status: 'pago', mpPaymentId: 'mp-1' }));
    devolucaoPorCancelamento.mockReturnValue('lote');

    const status = await processarNotificacao(NOTIF);

    expect(status).toBe(200);
    expect(repo.estornarPedidoRpc).toHaveBeenCalledWith('p-1', 'lote');
    expect(repo.registrarEventoPagamento).toHaveBeenCalledWith(
      expect.objectContaining({ resultado: 'confirmado', detalhe: 'estorno, devolução lote' }),
    );
  });

  it('pedido desconhecido (external_reference sem pedido) registra e devolve 200', async () => {
    consultarPagamento.mockResolvedValue(pagamento());
    repo.lerPedidoParaConfirmacao.mockResolvedValue(null);

    const status = await processarNotificacao(NOTIF);

    expect(status).toBe(200);
    expect(repo.registrarEventoPagamento).toHaveBeenCalledWith(
      expect.objectContaining({ resultado: 'pedido_desconhecido' }),
    );
    expect(repo.confirmarPagamentoRpc).not.toHaveBeenCalled();
  });
});

describe('confirmarPeloRetorno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lerCatalogo.mockResolvedValue({ produtos: [{ produto: { id: PID }, categoria: { ehMassa: false } }] });
    carregarSnapshot.mockResolvedValue({});
    avaliarViabilidade.mockReturnValue('viavel');
    repo.confirmarPagamentoRpc.mockResolvedValue(true);
  });

  it('T38 — consulta a fonte pelo id da URL e confirma, sem exigir assinatura', async () => {
    consultarPagamento.mockResolvedValue(pagamento());
    repo.lerPedidoParaConfirmacao.mockResolvedValue(pedido());

    await confirmarPeloRetorno(1042, 'mp-1');

    expect(verificarAssinatura).not.toHaveBeenCalled();
    expect(consultarPagamento).toHaveBeenCalledWith('mp-1');
    expect(repo.confirmarPagamentoRpc).toHaveBeenCalledWith('p-1', 'mp-1', 'pix', 'viavel');
  });
});
