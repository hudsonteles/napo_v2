import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPagamentoEnv = vi.fn();
const reconciliarPedido = vi.fn();
const pedidosVencidos = vi.fn();
const expirarPedidos = vi.fn();

vi.mock('@/lib/env', () => ({ getPagamentoEnv: () => getPagamentoEnv() }));
vi.mock('@/lib/pagamentos/porta', () => ({ portaDePagamento: () => ({}) }));
vi.mock('@/features/disponibilidade', () => ({ carregarSnapshot: vi.fn() }));
vi.mock('@/features/pedidos', () => ({
  reconciliarPedido: (...args: unknown[]) => reconciliarPedido(...args),
  dependenciasDaConfirmacao: () => ({}),
  repositorioDePedidos: () => ({ pedidosVencidos, expirarPedidos }),
}));

const { POST } = await import('./route');

function requisicao(segredo?: string) {
  return new Request('http://localhost/api/manutencao/pedidos-parados', {
    method: 'POST',
    headers: segredo ? { 'x-manutencao-secret': segredo } : {},
  });
}

describe('POST /api/manutencao/pedidos-parados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPagamentoEnv.mockReturnValue({ MANUTENCAO_SECRET: 'abre-te-sesamo' });
    pedidosVencidos.mockResolvedValue([]);
    expirarPedidos.mockResolvedValue(0);
  });

  it('T29 — sem o header de segredo a resposta é 401 e nenhum pedido é tocado', async () => {
    const resposta = await POST(requisicao());

    expect(resposta.status).toBe(401);
    expect(pedidosVencidos).not.toHaveBeenCalled();
    expect(expirarPedidos).not.toHaveBeenCalled();
  });

  it('T29 — segredo errado também é 401', async () => {
    const resposta = await POST(requisicao('chute'));

    expect(resposta.status).toBe(401);
    expect(expirarPedidos).not.toHaveBeenCalled();
  });

  it('T29 — sem segredo configurado a rota recusa em vez de liberar', async () => {
    getPagamentoEnv.mockReturnValue({ MANUTENCAO_SECRET: undefined });

    const resposta = await POST(requisicao('qualquer'));

    expect(resposta.status).toBe(401);
  });

  it('reconsulta antes de expirar: pedido pago com webhook perdido não perde a vaga', async () => {
    const ordem: string[] = [];
    pedidosVencidos.mockResolvedValue([{ id: 'p-1', itens: [] }]);
    reconciliarPedido.mockImplementation(async () => {
      ordem.push('reconsulta');
      return { http: 200, resultado: 'confirmado' };
    });
    expirarPedidos.mockImplementation(async () => {
      ordem.push('expiracao');
      return 2;
    });

    const resposta = await POST(requisicao('abre-te-sesamo'));

    expect(ordem).toEqual(['reconsulta', 'expiracao']);
    await expect(resposta.json()).resolves.toEqual({
      success: true,
      data: { reconsultados: 1, confirmados: 1, expirados: 2 },
    });
  });

  it('rodar duas vezes seguidas não muda nada além da primeira', async () => {
    await POST(requisicao('abre-te-sesamo'));
    await POST(requisicao('abre-te-sesamo'));

    // Idempotência é do banco: a função só toca em quem ainda está vencido.
    expect(expirarPedidos).toHaveBeenCalledTimes(2);
  });
});
