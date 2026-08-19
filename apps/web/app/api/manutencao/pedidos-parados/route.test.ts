import { beforeEach, describe, expect, it, vi } from 'vitest';

const expirarPedidosRpc = vi.fn();
vi.mock('@/features/pedidos', async (importActual) => {
  const real = await importActual<typeof import('@/features/pedidos')>();
  return { ...real, expirarPedidosRpc: (...a: unknown[]) => expirarPedidosRpc(...a) };
});

vi.mock('@/lib/env', async (importActual) => {
  const real = await importActual<typeof import('@/lib/env')>();
  return { ...real, getPagamentoEnv: () => ({ PAGAMENTO_PROVIDER: 'fake', MANUTENCAO_SECRET: 'segredo' }) };
});

const { POST } = await import('./route');

function req(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/manutencao/pedidos-parados', { method: 'POST', headers });
}

describe('POST /api/manutencao/pedidos-parados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    expirarPedidosRpc.mockResolvedValue(2);
  });

  it('T29 — sem header de segredo: 401 e nenhum pedido é tocado', async () => {
    const r = await POST(req());
    expect(r.status).toBe(401);
    expect(expirarPedidosRpc).not.toHaveBeenCalled();
  });

  it('T29 — segredo errado: 401', async () => {
    const r = await POST(req({ 'x-manutencao-secret': 'errado' }));
    expect(r.status).toBe(401);
    expect(expirarPedidosRpc).not.toHaveBeenCalled();
  });

  it('segredo correto: varre e devolve o total expirado (RN13)', async () => {
    const r = await POST(req({ 'x-manutencao-secret': 'segredo' }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ success: true, data: { expirados: 2 } });
    expect(expirarPedidosRpc).toHaveBeenCalled();
  });
});
