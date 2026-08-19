import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
}));

// O snapshot real exigiria banco; o que se testa aqui é o portão de entrada.
const carregarSnapshot = vi.fn();
const rpc = vi.fn();

vi.mock('@/features/disponibilidade', () => ({
  carregarSnapshot: (...args: unknown[]) => carregarSnapshot(...args),
  createSupabaseAdminClient: () => ({ rpc }),
}));

// O cálculo de disponibilidade é do núcleo puro; aqui só precisamos que o dia
// exista e devolva um limite, para exercitar o contrato da RPC.
const calcularDisponibilidade = vi.fn();
vi.mock('@napo/core', () => ({
  calcularDisponibilidade: (...args: unknown[]) => calcularDisponibilidade(...args),
}));

const { POST } = await import('./route');

function requisicao(corpo: unknown) {
  return new Request('http://localhost/api/disponibilidade/reserva', {
    method: 'POST',
    body: JSON.stringify(corpo),
  });
}

const CORPO_VALIDO = {
  diaEntrega: '2026-08-14',
  produtoId: '00000000-0000-0000-0000-0000000000aa',
  quantidade: 1,
};

/** Snapshot íntegro, porém sem dia de entrega configurado: horizonte vazio. */
function snapshotSemDiaDeEntrega() {
  return {
    agora: new Date('2026-08-10T12:00:00Z'),
    config: {
      tempoPreparoHoras: 48,
      tetoFornoDia: 30,
      capacidadeFreezer: 150,
      subTetoMassaDia: 6,
      limiteOcupacaoMassaPct: 80,
      bufferCutoffMin: 15,
      reservaMinutos: 15,
      horizonteSemanas: 2,
    },
    diasEntrega: [],
    diasProducao: [],
    excecoes: [],
    produtos: [],
    lotes: [],
    producaoPlanejada: [],
    consumos: [],
  };
}

describe('POST /api/disponibilidade/reserva', () => {
  // Sem isto, `not.toHaveBeenCalled()` enxerga as chamadas do teste anterior.
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: horizonte vazio. Os testes de sucesso sobrescrevem.
    calcularDisponibilidade.mockReturnValue([]);
  });

  it('T17 — sem sessão responde 401 e nada é consultado nem persistido', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });

    const resposta = await POST(requisicao(CORPO_VALIDO));

    expect(resposta.status).toBe(401);
    expect(carregarSnapshot).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('T17 — um limite enviado no corpo nunca chega ao banco', async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: 'u-1' } } });
    carregarSnapshot.mockResolvedValueOnce(snapshotSemDiaDeEntrega());

    // Limite absurdo no corpo: se fosse aceito, viraria vaga infinita.
    await POST(requisicao({ ...CORPO_VALIDO, limite: 99999, p_limite: 99999 }));

    expect(rpc).not.toHaveBeenCalled();
  });

  it('T23 — data sem disponibilidade não libera reserva', async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: 'u-1' } } });
    carregarSnapshot.mockResolvedValueOnce(snapshotSemDiaDeEntrega());

    const resposta = await POST(requisicao(CORPO_VALIDO));

    expect(resposta.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('T17 — corpo inválido é recusado antes de qualquer consulta', async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: 'u-1' } } });

    const resposta = await POST(requisicao({ diaEntrega: 'ontem', produtoId: 'x', quantidade: 0 }));

    expect(resposta.status).toBe(400);
    expect(carregarSnapshot).not.toHaveBeenCalled();
  });

  it('reserva bem-sucedida chama reservar_carrinho com limite = disponível + ocupadas', async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: 'u-1' } } });
    // 1 já ocupada no dia/produto + 9 ainda disponíveis → limite tolerado = 10.
    carregarSnapshot.mockResolvedValueOnce({
      ...snapshotSemDiaDeEntrega(),
      consumos: [{ diaEntrega: CORPO_VALIDO.diaEntrega, produtoId: CORPO_VALIDO.produtoId, quantidade: 1 }],
    });
    calcularDisponibilidade.mockReturnValue([
      { data: CORPO_VALIDO.diaEntrega, produtos: [{ produtoId: CORPO_VALIDO.produtoId, disponivel: 9 }] },
    ]);
    rpc.mockResolvedValueOnce({ data: [{ id: 'r-1' }], error: null });

    const resposta = await POST(requisicao({ ...CORPO_VALIDO, quantidade: 2 }));

    expect(resposta.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('reservar_carrinho', {
      p_dia: CORPO_VALIDO.diaEntrega,
      p_itens: [{ produto_id: CORPO_VALIDO.produtoId, quantidade: 2 }],
      p_profile: 'u-1',
      p_limites: [{ produto_id: CORPO_VALIDO.produtoId, limite: 10 }],
      p_minutos: 15,
    });
  });

  it('sem vaga (RPC recusa) responde 409 antes de qualquer cobrança', async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: 'u-1' } } });
    carregarSnapshot.mockResolvedValueOnce(snapshotSemDiaDeEntrega());
    calcularDisponibilidade.mockReturnValue([
      { data: CORPO_VALIDO.diaEntrega, produtos: [{ produtoId: CORPO_VALIDO.produtoId, disponivel: 0 }] },
    ]);
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'sem vaga' } });

    const resposta = await POST(requisicao(CORPO_VALIDO));

    expect(resposta.status).toBe(409);
  });
});
