import { beforeEach, describe, expect, it, vi } from 'vitest';

const exigirClienteValidado = vi.fn();
const lerPedidoPorNumero = vi.fn();
const reconciliarPedido = vi.fn();

vi.mock('@/lib/guarda-api', () => ({
  exigirClienteValidado: () => exigirClienteValidado(),
}));
vi.mock('@/lib/pagamentos/porta', () => ({ portaDePagamento: () => ({}) }));
vi.mock('@/features/disponibilidade', () => ({ carregarSnapshot: vi.fn() }));
vi.mock('@/features/pedidos', () => ({
  repositorioDeCobrancas: () => ({}),
  reconciliarPedido: (...args: unknown[]) => reconciliarPedido(...args),
  dependenciasDaConfirmacao: () => ({}),
  repositorioDePedidos: () => ({ lerPedidoPorNumero }),
}));

const { GET } = await import('./route');

const AGUARDANDO = {
  id: 'pedido-1',
  numero: 1042,
  profileId: 'u-1',
  status: 'aguardando_pagamento',
  diaEntrega: '2026-08-22',
  totalCentavos: 13570,
  mpPaymentId: null,
  itens: [{ produtoId: 'p-1', quantidade: 2 }],
};

const PARAMS = { params: Promise.resolve({ numero: '1042' }) };

function requisicao() {
  return new Request('http://localhost/api/pedidos/1042');
}

describe('GET /api/pedidos/[numero]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigirClienteValidado.mockResolvedValue({ perfil: { id: 'u-1' } });
  });

  it('T38 — pedido aguardando pagamento é reconsultado na hora', async () => {
    lerPedidoPorNumero
      .mockResolvedValueOnce(AGUARDANDO)
      .mockResolvedValueOnce({ ...AGUARDANDO, status: 'pago' });
    reconciliarPedido.mockResolvedValue({ http: 200, resultado: 'confirmado' });

    const resposta = await GET(requisicao(), PARAMS);

    expect(reconciliarPedido).toHaveBeenCalled();
    await expect(resposta.json()).resolves.toEqual({
      success: true,
      data: { numero: 1042, status: 'pago', diaEntrega: '2026-08-22', totalCentavos: 13570 },
    });
  });

  it('pedido já resolvido não gasta uma consulta ao gateway', async () => {
    // O critério deixou de ser o status e passou a ser a situação derivada: um
    // pedido `entregue` continua sendo pedido pago, e perguntar ao gateway de
    // novo é aquecer servidor à toa.
    lerPedidoPorNumero.mockResolvedValue({ ...AGUARDANDO, situacaoPagamento: 'pago' });

    const resposta = await GET(requisicao(), PARAMS);

    expect(reconciliarPedido).not.toHaveBeenCalled();
    expect(resposta.status).toBe(200);
  });

  it('pedido de outra pessoa responde 404, não 403', async () => {
    // 403 confirmaria que o pedido existe: o endpoint não pode virar oráculo
    // de quantos pedidos a casa já fez.
    lerPedidoPorNumero.mockResolvedValue({ ...AGUARDANDO, profileId: 'outro' });

    const resposta = await GET(requisicao(), PARAMS);

    expect(resposta.status).toBe(404);
    expect(reconciliarPedido).not.toHaveBeenCalled();
  });

  it('sem sessão não se consulta pedido nenhum', async () => {
    exigirClienteValidado.mockResolvedValue({
      resposta: Response.json({ success: false }, { status: 401 }),
    });

    const resposta = await GET(requisicao(), PARAMS);

    expect(resposta.status).toBe(401);
    expect(lerPedidoPorNumero).not.toHaveBeenCalled();
  });
});
