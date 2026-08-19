import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const exigir = vi.fn();
vi.mock('@/lib/guarda-api', () => ({ exigirClienteValidado: () => exigir() }));

const lerPedidoDoDono = vi.fn();
const cancelarPedidoRpc = vi.fn();
vi.mock('@/features/pedidos', async (importActual) => {
  const real = await importActual<typeof import('@/features/pedidos')>();
  return {
    ...real,
    lerPedidoDoDono: (...a: unknown[]) => lerPedidoDoDono(...a),
    cancelarPedidoRpc: (...a: unknown[]) => cancelarPedidoRpc(...a),
  };
});

const carregarSnapshot = vi.fn();
vi.mock('@/features/disponibilidade', () => ({
  carregarSnapshot: (...a: unknown[]) => carregarSnapshot(...a),
}));

const devolucaoPorCancelamento = vi.fn();
vi.mock('@napo/core', async (importActual) => {
  const real = await importActual<typeof import('@napo/core')>();
  return { ...real, devolucaoPorCancelamento: (...a: unknown[]) => devolucaoPorCancelamento(...a) };
});

const { POST } = await import('./route');

const params = (numero: string) => ({ params: Promise.resolve({ numero }) });
function req() {
  return new Request('http://localhost/api/pedidos/1042/cancelar', { method: 'POST' });
}

function pedido(extra: Record<string, unknown> = {}) {
  return { id: 'p-1', numero: 1042, status: 'pago', diaEntrega: '2026-10-16', itens: [], ...extra };
}

describe('POST /api/pedidos/[numero]/cancelar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigir.mockResolvedValue({ perfil: { id: 'u-1', papel: 'cliente', telefoneValidado: true } });
    carregarSnapshot.mockResolvedValue({});
    devolucaoPorCancelamento.mockReturnValue('capacidade');
    cancelarPedidoRpc.mockResolvedValue(true);
  });

  it('sem sessão válida, propaga a resposta do guarda', async () => {
    exigir.mockResolvedValue({ resposta: NextResponse.json({}, { status: 403 }) });
    expect((await POST(req(), params('1042'))).status).toBe(403);
    expect(lerPedidoDoDono).not.toHaveBeenCalled();
  });

  it('pedido de outro dono (ou inexistente) é 404', async () => {
    lerPedidoDoDono.mockResolvedValue(null);
    expect((await POST(req(), params('1042'))).status).toBe(404);
  });

  it('cancela antes do cutoff e devolve capacidade (T10)', async () => {
    lerPedidoDoDono.mockResolvedValue(pedido());
    const r = await POST(req(), params('1042'));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ success: true, data: { devolucao: 'capacidade' } });
    expect(cancelarPedidoRpc).toHaveBeenCalledWith('p-1', 'capacidade');
  });

  it('T16 — depois do cutoff (devolução lote): 409 e o pedido não é cancelado', async () => {
    lerPedidoDoDono.mockResolvedValue(pedido());
    devolucaoPorCancelamento.mockReturnValue('lote');
    const r = await POST(req(), params('1042'));
    expect(r.status).toBe(409);
    expect(cancelarPedidoRpc).not.toHaveBeenCalled();
  });

  it('pedido que não está pago não é cancelável pelo cliente', async () => {
    lerPedidoDoDono.mockResolvedValue(pedido({ status: 'expirado' }));
    expect((await POST(req(), params('1042'))).status).toBe(409);
    expect(cancelarPedidoRpc).not.toHaveBeenCalled();
  });
});
