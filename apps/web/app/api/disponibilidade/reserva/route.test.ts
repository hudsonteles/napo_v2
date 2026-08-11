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
});
