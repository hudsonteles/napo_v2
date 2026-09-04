import { beforeEach, describe, expect, it, vi } from 'vitest';

const exigirClienteValidado = vi.fn();
const criarPedido = vi.fn();

vi.mock('@/lib/guarda-api', () => ({
  exigirClienteValidado: () => exigirClienteValidado(),
}));

vi.mock('@/features/pedidos', async (original) => ({
  ...(await original<typeof import('@/features/pedidos')>()),
  criarPedido: (...args: unknown[]) => criarPedido(...args),
  repositorioDePedidos: () => ({}),
}));

// Nenhuma destas é alcançada nos casos barrados; ficam mudas para o import da
// rota não abrir conexão com o banco.
vi.mock('@/features/catalogo', () => ({ lerCatalogo: vi.fn() }));
vi.mock('@/features/disponibilidade', () => ({ carregarSnapshot: vi.fn() }));
vi.mock('@/features/enderecos', () => ({
  calcularFreteDoEndereco: vi.fn(),
  listarEnderecos: vi.fn(),
}));

const { POST } = await import('./route');

const PRODUTO = '00000000-0000-0000-0000-00000000000a';
const ENDERECO = '00000000-0000-0000-0000-0000000000ee';

const CORPO_VALIDO = {
  itens: [{ produtoId: PRODUTO, quantidade: 2, precoVistoCentavos: 3990 }],
  enderecoId: ENDERECO,
};

function requisicao(corpo: unknown) {
  return new Request('http://localhost/api/pedidos', {
    method: 'POST',
    body: JSON.stringify(corpo),
  });
}

function respostaDeGuarda(status: number) {
  return { resposta: Response.json({ success: false }, { status }) };
}

describe('POST /api/pedidos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('T20 — visitante anônimo recebe 401 e nada é criado', async () => {
    exigirClienteValidado.mockResolvedValueOnce(respostaDeGuarda(401));

    const resposta = await POST(requisicao(CORPO_VALIDO));

    expect(resposta.status).toBe(401);
    expect(criarPedido).not.toHaveBeenCalled();
  });

  it('T20 — cliente sem telefone validado recebe 403', async () => {
    exigirClienteValidado.mockResolvedValueOnce(respostaDeGuarda(403));

    const resposta = await POST(requisicao(CORPO_VALIDO));

    expect(resposta.status).toBe(403);
    expect(criarPedido).not.toHaveBeenCalled();
  });

  it('T13 — total, frete e distância vindos do navegador são recusados', async () => {
    exigirClienteValidado.mockResolvedValue({ perfil: { id: 'u-1' } });

    for (const extra of [
      { totalCentavos: 1 },
      { freteCentavos: 0 },
      { distanciaKm: 0.1 },
      { diaEntrega: '2026-08-22' },
    ]) {
      const resposta = await POST(requisicao({ ...CORPO_VALIDO, ...extra }));
      expect(resposta.status).toBe(400);
    }

    expect(criarPedido).not.toHaveBeenCalled();
  });

  it('T13 — preço no item também não passa: só o preço visto, para conferência', async () => {
    exigirClienteValidado.mockResolvedValue({ perfil: { id: 'u-1' } });

    const resposta = await POST(
      requisicao({
        ...CORPO_VALIDO,
        itens: [
          { produtoId: PRODUTO, quantidade: 2, precoVistoCentavos: 3990, precoUnitarioCentavos: 1 },
        ],
      }),
    );

    expect(resposta.status).toBe(400);
    expect(criarPedido).not.toHaveBeenCalled();
  });

  it('T21 — declarar forma de pagamento na entrega não cria pedido', async () => {
    exigirClienteValidado.mockResolvedValue({ perfil: { id: 'u-1' } });

    const resposta = await POST(
      requisicao({ ...CORPO_VALIDO, formaPagamento: 'na_entrega' }),
    );

    expect(resposta.status).toBe(400);
    expect(criarPedido).not.toHaveBeenCalled();
  });

  it('a falha do serviço vira o status que ela declara', async () => {
    exigirClienteValidado.mockResolvedValue({ perfil: { id: 'u-1' } });
    criarPedido.mockResolvedValueOnce({
      ok: false,
      falha: { motivo: 'gateway_indisponivel', status: 503 },
    });

    const resposta = await POST(requisicao(CORPO_VALIDO));

    expect(resposta.status).toBe(503);
    // O status não vai no corpo do erro: quem lê o corpo já tem o HTTP.
    await expect(resposta.json()).resolves.toEqual({
      success: false,
      error: { motivo: 'gateway_indisponivel' },
    });
  });

  it('o perfil da sessão é quem assina o pedido, não o corpo', async () => {
    exigirClienteValidado.mockResolvedValue({ perfil: { id: 'u-1' } });
    criarPedido.mockResolvedValueOnce({
      ok: true,
      pedido: {
        pedidoId: 'p-1',
        numero: 1042,
        diaEntrega: '2026-08-22',
        totalCentavos: 8580,
        urlPagamento: 'https://mp/pagar',
      },
    });

    await POST(requisicao({ ...CORPO_VALIDO }));

    expect(criarPedido).toHaveBeenCalledWith(
      expect.objectContaining({ enderecoId: ENDERECO }),
      'u-1',
      expect.anything(),
    );
  });
});
