import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const exigir = vi.fn();
vi.mock('@/lib/guarda-api', () => ({ exigirClienteValidado: () => exigir() }));

const lerPedidoDoDono = vi.fn();
const confirmarPeloRetorno = vi.fn();
vi.mock('@/features/pedidos', async (importActual) => {
  const real = await importActual<typeof import('@/features/pedidos')>();
  return {
    ...real,
    lerPedidoDoDono: (...a: unknown[]) => lerPedidoDoDono(...a),
    confirmarPeloRetorno: (...a: unknown[]) => confirmarPeloRetorno(...a),
  };
});

const { GET } = await import('./route');

function req(url: string) {
  return new Request(url);
}
const params = (numero: string) => ({ params: Promise.resolve({ numero }) });

function pedido(extra: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    numero: 1042,
    status: 'pago',
    diaEntrega: '2026-10-16',
    subtotalCentavos: 7980,
    freteCentavos: 600,
    totalCentavos: 8580,
    veredito: 'viavel',
    criadoEm: '2026-10-14T12:00:00Z',
    enderecoSnapshot: { logradouro: 'SQN 210 C' },
    itens: [],
    ...extra,
  };
}

describe('GET /api/pedidos/[numero]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigir.mockResolvedValue({ perfil: { id: 'u-1', papel: 'cliente', telefoneValidado: true } });
  });

  it('sem sessão válida, propaga a resposta do guarda', async () => {
    exigir.mockResolvedValue({ resposta: NextResponse.json({}, { status: 401 }) });
    expect((await GET(req('http://localhost/api/pedidos/1042'), params('1042'))).status).toBe(401);
    expect(lerPedidoDoDono).not.toHaveBeenCalled();
  });

  it('número de outro dono (ou inexistente) é 404 pela RLS', async () => {
    lerPedidoDoDono.mockResolvedValue(null);
    expect((await GET(req('http://localhost/api/pedidos/9999'), params('9999'))).status).toBe(404);
  });

  it('devolve o pedido sem o UUID interno', async () => {
    lerPedidoDoDono.mockResolvedValue(pedido());
    const corpo = await (await GET(req('http://localhost/api/pedidos/1042'), params('1042'))).json();
    expect(corpo.data.numero).toBe(1042);
    expect(corpo.data.id).toBeUndefined();
    expect(confirmarPeloRetorno).not.toHaveBeenCalled();
  });

  it('T38 — aguardando + payment_id na URL: consulta a fonte e relê o estado', async () => {
    lerPedidoDoDono
      .mockResolvedValueOnce(pedido({ status: 'aguardando_pagamento' }))
      .mockResolvedValueOnce(pedido({ status: 'pago' }));

    const corpo = await (
      await GET(req('http://localhost/api/pedidos/1042?payment_id=mp-1'), params('1042'))
    ).json();

    expect(confirmarPeloRetorno).toHaveBeenCalledWith(1042, 'mp-1');
    expect(corpo.data.status).toBe('pago');
  });

  it('aguardando sem payment_id não dispara consulta', async () => {
    lerPedidoDoDono.mockResolvedValue(pedido({ status: 'aguardando_pagamento' }));
    await GET(req('http://localhost/api/pedidos/1042'), params('1042'));
    expect(confirmarPeloRetorno).not.toHaveBeenCalled();
  });
});
