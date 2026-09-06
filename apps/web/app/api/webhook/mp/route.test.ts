import { beforeEach, describe, expect, it, vi } from 'vitest';

const verificarAssinatura = vi.fn();
const processarNotificacao = vi.fn();
const registrarEvento = vi.fn();

vi.mock('@/lib/pagamentos/porta', () => ({
  portaDePagamento: () => ({
    verificarAssinatura: (...args: unknown[]) => verificarAssinatura(...args),
    consultarPagamento: vi.fn(),
    buscarPagamentoDaReferencia: vi.fn(),
    criarCobranca: vi.fn(),
  }),
}));

vi.mock('@/features/disponibilidade', () => ({ carregarSnapshot: vi.fn() }));

vi.mock('@/features/pedidos', () => ({
  repositorioDeCobrancas: () => ({}),
  processarNotificacao: (...args: unknown[]) => processarNotificacao(...args),
  dependenciasDaConfirmacao: () => ({}),
  repositorioDePedidos: () => ({ registrarEvento }),
}));

const { POST } = await import('./route');

function notificacao(query = '?data.id=pag-1', corpo: unknown = { data: { id: 'pag-1' } }) {
  return new Request(`http://localhost/api/webhook/mp${query}`, {
    method: 'POST',
    headers: { 'x-signature': 'ts=1,v1=abc', 'x-request-id': 'req-1' },
    body: JSON.stringify(corpo),
  });
}

describe('POST /api/webhook/mp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('T25 — assinatura forjada recebe 401, nada é processado e o evento fica registrado', async () => {
    verificarAssinatura.mockReturnValue(false);

    const resposta = await POST(notificacao());

    expect(resposta.status).toBe(401);
    expect(processarNotificacao).not.toHaveBeenCalled();
    expect(registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({ resultado: 'assinatura_invalida', mpPaymentId: 'pag-1' }),
    );
  });

  it('T25 — a assinatura é conferida antes de qualquer leitura do banco', async () => {
    verificarAssinatura.mockReturnValue(true);
    processarNotificacao.mockResolvedValue({ http: 200, resultado: 'confirmado' });

    await POST(notificacao());

    expect(verificarAssinatura).toHaveBeenCalledWith({
      assinatura: 'ts=1,v1=abc',
      requestId: 'req-1',
      dataId: 'pag-1',
    });
  });

  it('o id vem da querystring, e o corpo é só o segundo caminho', async () => {
    verificarAssinatura.mockReturnValue(true);
    processarNotificacao.mockResolvedValue({ http: 200, resultado: 'confirmado' });

    await POST(notificacao('', { data: { id: 'pag-do-corpo' } }));

    expect(verificarAssinatura).toHaveBeenCalledWith(
      expect.objectContaining({ dataId: 'pag-do-corpo' }),
    );
  });

  it('T30 — erro interno devolve 5xx para o gateway reenviar', async () => {
    verificarAssinatura.mockReturnValue(true);
    processarNotificacao.mockRejectedValue(new Error('banco fora do ar'));

    const resposta = await POST(notificacao());

    expect(resposta.status).toBe(500);
  });

  it('T30 — notificação duplicada sai 200', async () => {
    verificarAssinatura.mockReturnValue(true);
    processarNotificacao.mockResolvedValue({ http: 200, resultado: 'duplicado' });

    const resposta = await POST(notificacao());

    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toMatchObject({ resultado: 'duplicado' });
  });

  it('o status decidido pela confirmação é o status devolvido', async () => {
    verificarAssinatura.mockReturnValue(true);
    processarNotificacao.mockResolvedValue({ http: 502, resultado: 'erro' });

    const resposta = await POST(notificacao());

    expect(resposta.status).toBe(502);
  });
});
