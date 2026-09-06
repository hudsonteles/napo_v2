import { beforeEach, describe, expect, it, vi } from 'vitest';

const criarCobranca = vi.fn();
const exigirClienteValidado = vi.fn();

vi.mock('@/features/pedidos', async () => {
  const { esquemaCriarPagamento } = await import('@/features/pedidos/schema');
  return {
    esquemaCriarPagamento,
    criarCobranca: (...args: unknown[]) => criarCobranca(...args),
    repositorioDeCobrancas: () => ({}),
    repositorioDePedidos: () => ({}),
  };
});
vi.mock('@/lib/guarda-api', () => ({
  exigirClienteValidado: () => exigirClienteValidado(),
}));
vi.mock('@/lib/pagamentos/porta', () => ({ portaDePagamento: () => ({}) }));

const { POST } = await import('./route');

const CORPO_VALIDO = {
  pedidoId: '3f1b7f8e-0000-4000-8000-000000000001',
  token: 'tok-do-brick',
  metodo: 'master',
  parcelas: 1,
  emailPagador: 'cliente@napo.test',
};

function requisicao(corpo: unknown) {
  return new Request('http://localhost/api/pagamentos', {
    method: 'POST',
    body: JSON.stringify(corpo),
  });
}

describe('POST /api/pagamentos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigirClienteValidado.mockResolvedValue({ perfil: { id: 'u-1' } });
    criarCobranca.mockResolvedValue({
      ok: true,
      cobranca: { cobrancaId: 'c-1', situacao: 'aguardando', pix: null },
    });
  });

  it('T18/RN9 — dado de cartão no corpo é recusado, não ignorado em silêncio', async () => {
    // Campo ignorado é campo que alguém tenta de novo. O `.strict()` faz o
    // número do cartão derrubar a requisição inteira.
    const resposta = await POST(
      requisicao({ ...CORPO_VALIDO, numeroCartao: '5031433215406351', cvv: '123' }),
    );

    expect(resposta.status).toBe(400);
    expect(criarCobranca).not.toHaveBeenCalled();
  });

  it('o token do Brick chega ao serviço com o dono da sessão', async () => {
    const resposta = await POST(requisicao(CORPO_VALIDO));

    expect(resposta.status).toBe(200);
    expect(criarCobranca).toHaveBeenCalledWith(CORPO_VALIDO, 'u-1', expect.anything());
  });

  it('a falha do serviço define o status, e o motivo volta sem o texto do gateway', async () => {
    criarCobranca.mockResolvedValue({
      ok: false,
      falha: { motivo: 'recusado', status: 422, familia: 'saldo', mensagem: 'Sem limite.' },
    });

    const resposta = await POST(requisicao(CORPO_VALIDO));
    const corpo = await resposta.json();

    expect(resposta.status).toBe(422);
    expect(corpo.error).toEqual({ motivo: 'recusado', familia: 'saldo', mensagem: 'Sem limite.' });
    expect(corpo.error.status).toBeUndefined();
  });

  it('sem sessão validada a rota nem chega ao serviço', async () => {
    exigirClienteValidado.mockResolvedValue({
      resposta: new Response(null, { status: 401 }),
    });

    const resposta = await POST(requisicao(CORPO_VALIDO));

    expect(resposta.status).toBe(401);
    expect(criarCobranca).not.toHaveBeenCalled();
  });
});
