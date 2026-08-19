import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const exigir = vi.fn();
vi.mock('@/lib/guarda-api', () => ({ exigirClienteValidado: () => exigir() }));

const criarPedido = vi.fn();
vi.mock('@/features/pedidos', async (importActual) => {
  const real = await importActual<typeof import('@/features/pedidos')>();
  return { ...real, criarPedido: (...a: unknown[]) => criarPedido(...a) };
});

const { POST } = await import('./route');

const PID = '00000000-0000-0000-0000-0000000000aa';
const END = '11111111-0000-0000-0000-000000000001';

function requisicao(corpo: unknown) {
  return new Request('http://localhost/api/pedidos', {
    method: 'POST',
    body: JSON.stringify(corpo),
  });
}

const CORPO = { itens: [{ produtoId: PID, quantidade: 1, precoUnitarioCentavos: 3990 }], enderecoId: END };

describe('POST /api/pedidos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigir.mockResolvedValue({ perfil: { id: 'u-1', papel: 'cliente', telefoneValidado: true } });
  });

  it('T20 — visitante anônimo recebe 401 e nada é criado', async () => {
    exigir.mockResolvedValue({
      resposta: NextResponse.json({ success: false, error: 'Não autenticado.' }, { status: 401 }),
    });
    const r = await POST(requisicao(CORPO));
    expect(r.status).toBe(401);
    expect(criarPedido).not.toHaveBeenCalled();
  });

  it('T20 — logado sem telefone validado recebe 403 e nada é criado', async () => {
    exigir.mockResolvedValue({
      resposta: NextResponse.json({ success: false, error: 'Telefone ainda não validado.' }, { status: 403 }),
    });
    const r = await POST(requisicao(CORPO));
    expect(r.status).toBe(403);
    expect(criarPedido).not.toHaveBeenCalled();
  });

  it('corpo inválido é 400 antes de tocar o serviço', async () => {
    const r = await POST(requisicao({ itens: [], enderecoId: END }));
    expect(r.status).toBe(400);
    expect(criarPedido).not.toHaveBeenCalled();
  });

  it('sucesso devolve 200 com número e URL de pagamento', async () => {
    criarPedido.mockResolvedValue({ ok: true, numero: 1042, urlPagamento: 'https://mp/pay/1' });
    const r = await POST(requisicao(CORPO));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ success: true, data: { numero: 1042, urlPagamento: 'https://mp/pay/1' } });
  });

  it('T14 — divergência de preço vira 409 com o de/para', async () => {
    const divergencias = [{ produtoId: PID, deCentavos: 3790, paraCentavos: 3990 }];
    criarPedido.mockResolvedValue({ ok: false, erro: 'divergencia_preco', divergencias });
    const r = await POST(requisicao(CORPO));
    expect(r.status).toBe(409);
    expect((await r.json()).divergencias).toEqual(divergencias);
  });

  it('T36 — sem vaga vira 409', async () => {
    criarPedido.mockResolvedValue({ ok: false, erro: 'sem_vaga', dia: '2026-08-22' });
    expect((await POST(requisicao(CORPO))).status).toBe(409);
  });

  it('T18 — fora de área vira 422', async () => {
    criarPedido.mockResolvedValue({ ok: false, erro: 'fora_de_area' });
    expect((await POST(requisicao(CORPO))).status).toBe(422);
  });

  it('T37 — gateway indisponível vira 503', async () => {
    criarPedido.mockResolvedValue({ ok: false, erro: 'gateway_indisponivel' });
    expect((await POST(requisicao(CORPO))).status).toBe(503);
  });

  it('endereço inexistente vira 404', async () => {
    criarPedido.mockResolvedValue({ ok: false, erro: 'endereco_invalido' });
    expect((await POST(requisicao(CORPO))).status).toBe(404);
  });
});
