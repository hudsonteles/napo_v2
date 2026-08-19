import { beforeEach, describe, expect, it, vi } from 'vitest';

const processarNotificacao = vi.fn();
vi.mock('@/features/pedidos', async (importActual) => {
  const real = await importActual<typeof import('@/features/pedidos')>();
  return { ...real, processarNotificacao: (...a: unknown[]) => processarNotificacao(...a) };
});

const { POST } = await import('./route');

function requisicao(corpo: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/webhook/mp', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers,
  });
}

describe('POST /api/webhook/mp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('corpo sem data.id é ignorado com 200, sem processar (ping/tópico não tratado)', async () => {
    const r = await POST(requisicao({ type: 'payment' }));
    expect(r.status).toBe(200);
    expect((await r.json()).ignorado).toBe(true);
    expect(processarNotificacao).not.toHaveBeenCalled();
  });

  it('encaminha id e cabeçalhos de assinatura ao serviço e devolve seu status', async () => {
    processarNotificacao.mockResolvedValue(200);
    const r = await POST(
      requisicao({ type: 'payment', data: { id: 12345 } }, { 'x-signature': 'ts=1,v1=abc', 'x-request-id': 'req-1' }),
    );
    expect(r.status).toBe(200);
    expect(processarNotificacao).toHaveBeenCalledWith(
      expect.objectContaining({ dataId: '12345', xSignature: 'ts=1,v1=abc', xRequestId: 'req-1' }),
    );
  });

  it('T25 — assinatura inválida propaga 401', async () => {
    processarNotificacao.mockResolvedValue(401);
    expect((await POST(requisicao({ data: { id: 'mp-1' } }))).status).toBe(401);
  });

  it('T30 — erro interno propaga 5xx para o Mercado Pago reenviar', async () => {
    processarNotificacao.mockResolvedValue(500);
    expect((await POST(requisicao({ data: { id: 'mp-1' } }))).status).toBe(500);
  });
});
