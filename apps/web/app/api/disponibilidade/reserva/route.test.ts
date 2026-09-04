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

/**
 * Quinta 06/08 olhando a sexta 14/08: antes do cutoff, o dia ainda promete
 * capacidade (CTP) em vez de depender de lote pronto.
 */
function snapshotComVaga(consumos: unknown[] = []) {
  return {
    ...snapshotSemDiaDeEntrega(),
    agora: new Date('2026-08-06T12:00:00Z'),
    diasEntrega: [{ diaSemana: 5, entrega: true, janelaInicio: '17:00', janelaFim: '21:00' }],
    diasProducao: [1, 2, 3, 4, 5].map((d) => ({ diaSemana: d, produz: true })),
    produtos: [{ id: CORPO_VALIDO.produtoId, ehMassa: false }],
    consumos,
  };
}

/** O `p_limites` que a rota mandou ao banco na última chamada. */
function limiteEnviado() {
  const [, args] = rpc.mock.calls.at(-1) as [string, { p_limites: { limite: number }[] }];
  const primeiro = args.p_limites[0];
  if (!primeiro) throw new Error('a RPC foi chamada sem limite');
  return primeiro.limite;
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

  it('RN7 — a reserva vai pela função do carrinho, com um item só', async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: 'u-1' } } });
    carregarSnapshot.mockResolvedValueOnce(snapshotComVaga());
    rpc.mockResolvedValueOnce({ data: [{ id: 'r-1' }], error: null });

    const resposta = await POST(requisicao({ ...CORPO_VALIDO, quantidade: 2 }));
    const corpo = await resposta.json();

    expect(rpc).toHaveBeenCalledWith(
      'reservar_carrinho',
      expect.objectContaining({
        p_dia: CORPO_VALIDO.diaEntrega,
        p_itens: [{ produto_id: CORPO_VALIDO.produtoId, quantidade: 2 }],
        p_profile: 'u-1',
        p_minutos: 15,
      }),
    );
    // A rota continua devolvendo uma reserva, não a lista do carrinho.
    expect(corpo).toEqual({ success: true, data: { id: 'r-1' } });
  });

  it('RN11 — o limite enviado é o teto do dia, não o que sobra', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    rpc.mockResolvedValue({ data: [{ id: 'r-1' }], error: null });

    carregarSnapshot.mockResolvedValueOnce(snapshotComVaga());
    await POST(requisicao(CORPO_VALIDO));
    const semOcupacao = limiteEnviado();

    carregarSnapshot.mockResolvedValueOnce(
      snapshotComVaga([
        { diaEntrega: CORPO_VALIDO.diaEntrega, produtoId: CORPO_VALIDO.produtoId, quantidade: 4 },
      ]),
    );
    await POST(requisicao(CORPO_VALIDO));

    // Quatro vagas ocupadas reduzem o disponível e são somadas de volta: o teto
    // que a função SQL compara com `vagas_ocupadas` não pode se mover.
    expect(limiteEnviado()).toBe(semOcupacao);
  });

  it('T17 — corpo inválido é recusado antes de qualquer consulta', async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: 'u-1' } } });

    const resposta = await POST(requisicao({ diaEntrega: 'ontem', produtoId: 'x', quantidade: 0 }));

    expect(resposta.status).toBe(400);
    expect(carregarSnapshot).not.toHaveBeenCalled();
  });
});
