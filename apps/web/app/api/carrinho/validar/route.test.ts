import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidarCarrinho = vi.fn();
vi.mock('@/features/pedidos', async (importActual) => {
  const real = await importActual<typeof import('@/features/pedidos')>();
  return { ...real, revalidarCarrinho: (...a: unknown[]) => revalidarCarrinho(...a) };
});

const { POST } = await import('./route');

const PID = '00000000-0000-0000-0000-0000000000aa';

function requisicao(corpo: unknown) {
  return new Request('http://localhost/api/carrinho/validar', {
    method: 'POST',
    body: JSON.stringify(corpo),
  });
}

describe('POST /api/carrinho/validar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem sessão, devolve preço e disponibilidade atuais e o dia (RN1)', async () => {
    revalidarCarrinho.mockResolvedValue({
      itens: [{ produtoId: PID, nome: 'Calabresa', quantidade: 2, precoUnitarioCentavos: 3990, disponivel: 9 }],
      dia: { data: '2026-08-22', determinadoPor: PID },
      faltando: false,
      snapshot: {},
    });

    const r = await POST(requisicao({ itens: [{ produtoId: PID, quantidade: 2 }] }));
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo.data.dia).toEqual({ data: '2026-08-22', determinadoPor: PID });
    expect(corpo.data.itens[0]).toMatchObject({ precoUnitarioCentavos: 3990, disponivel: 9, esgotado: false });
  });

  it('marca esgotado quando a disponibilidade zerou', async () => {
    revalidarCarrinho.mockResolvedValue({
      itens: [{ produtoId: PID, nome: 'Calabresa', quantidade: 1, precoUnitarioCentavos: 3990, disponivel: 0 }],
      dia: null,
      faltando: false,
      snapshot: {},
    });
    const corpo = await (await POST(requisicao({ itens: [{ produtoId: PID, quantidade: 1 }] }))).json();
    expect(corpo.data.itens[0].esgotado).toBe(true);
  });

  it('corpo inválido (com preço, ou vazio) é 400', async () => {
    expect((await POST(requisicao({ itens: [] }))).status).toBe(400);
    expect((await POST(requisicao({ itens: [{ produtoId: PID, quantidade: 1, precoUnitarioCentavos: 1 }] }))).status).toBe(400);
    expect(revalidarCarrinho).not.toHaveBeenCalled();
  });
});
