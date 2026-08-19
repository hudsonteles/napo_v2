import { describe, expect, it, vi } from 'vitest';

/**
 * Client Supabase de mentira. Registra os `insert`/`update`/`delete`/`rpc` e
 * devolve o resultado configurado por tabela, sem tocar banco. O que importa
 * aqui é o PAYLOAD gravado — é onde a RN20 (canal, T12) e a RN4 (snapshot, T3)
 * viram observáveis.
 */
function clienteFake(resultados: {
  insert?: Record<string, { data?: unknown; error?: unknown }>;
  select?: Record<string, { data?: unknown; error?: unknown }>;
  rpc?: { data?: unknown; error?: unknown };
}) {
  const calls = {
    insert: [] as Array<{ table: string; payload: unknown }>,
    update: [] as Array<{ table: string; payload: unknown }>,
    delete: [] as string[],
    rpc: [] as Array<{ fn: string; args: unknown }>,
  };

  const client = {
    from(table: string) {
      return {
        insert(payload: unknown) {
          calls.insert.push({ table, payload });
          const result = resultados.insert?.[table] ?? { data: null, error: null };
          return {
            select: () => ({ single: async () => result }),
            then: (onOk: (v: unknown) => unknown) => Promise.resolve(result).then(onOk),
          };
        },
        update(payload: unknown) {
          calls.update.push({ table, payload });
          return { eq: async () => ({ error: null }), in: async () => ({ error: null }) };
        },
        delete() {
          return {
            eq: async () => {
              calls.delete.push(table);
              return { error: null };
            },
          };
        },
        select() {
          return { single: async () => resultados.select?.[table] ?? { data: null, error: null } };
        },
      };
    },
    async rpc(fn: string, args: unknown) {
      calls.rpc.push({ fn, args });
      return resultados.rpc ?? { data: null, error: null };
    },
  };

  return { client, calls };
}

let proximo: ReturnType<typeof clienteFake>;
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => proximo.client }));

const { anexarPreferencia, compensarPedido, inserirPedido, lerPagamentoMinutos, reservarCarrinho } =
  await import('./pedidos-repo');

const PID = '00000000-0000-0000-0000-0000000000aa';
const END = '11111111-0000-0000-0000-000000000001';

const DADOS = {
  profileId: 'u-1',
  diaEntrega: '2026-08-22',
  enderecoId: END,
  enderecoSnapshot: { id: END, logradouro: 'SQN 210 Bloco C' },
  subtotalCentavos: 7980,
  freteCentavos: 600,
  totalCentavos: 8580,
  reservaId: 'r-1',
  expiraEm: '2026-08-19T12:30:00Z',
  itens: [{ produtoId: PID, nomeSnapshot: 'Calabresa', quantidade: 2, precoUnitarioCentavos: 3990 }],
};

describe('inserirPedido', () => {
  it('T12/T3 — grava canal, atividade fiscal e os snapshots de nome, preço e endereço', async () => {
    proximo = clienteFake({
      insert: { pedidos: { data: { id: 'p-1', numero: 1042 } }, pedido_itens: { error: null } },
    });

    const r = await inserirPedido(DADOS);

    expect(r).toEqual({ id: 'p-1', numero: 1042 });

    const pedido = proximo.calls.insert.find((c) => c.table === 'pedidos')!.payload as Record<string, unknown>;
    expect(pedido).toMatchObject({
      canal: 'site',
      atividade_fiscal: 'congelado_industrializado',
      dia_entrega: '2026-08-22',
      endereco_snapshot: { id: END, logradouro: 'SQN 210 Bloco C' },
      subtotal_centavos: 7980,
      frete_centavos: 600,
      total_centavos: 8580,
      reserva_id: 'r-1',
      expira_em: '2026-08-19T12:30:00Z',
    });

    const itens = proximo.calls.insert.find((c) => c.table === 'pedido_itens')!.payload as unknown[];
    expect(itens).toEqual([
      { pedido_id: 'p-1', produto_id: PID, nome_snapshot: 'Calabresa', quantidade: 2, preco_unitario_snapshot: 3990 },
    ]);
  });

  it('itens que falham apagam o pedido órfão e devolvem null', async () => {
    proximo = clienteFake({
      insert: { pedidos: { data: { id: 'p-1', numero: 1042 } }, pedido_itens: { error: { message: 'boom' } } },
    });

    const r = await inserirPedido(DADOS);

    expect(r).toBeNull();
    expect(proximo.calls.delete).toContain('pedidos');
  });

  it('pedido que falha na inserção devolve null sem tentar itens', async () => {
    proximo = clienteFake({ insert: { pedidos: { error: { message: 'boom' } } } });
    const r = await inserirPedido(DADOS);
    expect(r).toBeNull();
    expect(proximo.calls.insert.some((c) => c.table === 'pedido_itens')).toBe(false);
  });
});

describe('reservarCarrinho', () => {
  it('mapeia o retorno da RPC para camelCase', async () => {
    proximo = clienteFake({
      rpc: { data: [{ id: 'r-1', produto_id: PID, quantidade: 2, expira_em: '2026-08-19T12:30:00Z' }], error: null },
    });

    const r = await reservarCarrinho({
      diaEntrega: '2026-08-22',
      itens: [{ produto_id: PID, quantidade: 2 }],
      profileId: 'u-1',
      limites: [{ produto_id: PID, limite: 10 }],
      minutos: 30,
    });

    expect(r).toEqual([{ id: 'r-1', produtoId: PID, quantidade: 2, expiraEm: '2026-08-19T12:30:00Z' }]);
    expect(proximo.calls.rpc[0]).toEqual({
      fn: 'reservar_carrinho',
      args: {
        p_dia: '2026-08-22',
        p_itens: [{ produto_id: PID, quantidade: 2 }],
        p_profile: 'u-1',
        p_limites: [{ produto_id: PID, limite: 10 }],
        p_minutos: 30,
      },
    });
  });

  it('RPC que recusa (sem vaga) devolve null', async () => {
    proximo = clienteFake({ rpc: { data: null, error: { message: 'sem vaga' } } });
    const r = await reservarCarrinho({ diaEntrega: '2026-08-22', itens: [], profileId: 'u-1', limites: [], minutos: 30 });
    expect(r).toBeNull();
  });
});

describe('compensarPedido', () => {
  it('expira o pedido e libera as reservas', async () => {
    proximo = clienteFake({});
    await compensarPedido('p-1', ['r-1', 'r-2']);
    expect(proximo.calls.update).toContainEqual({ table: 'pedidos', payload: { status: 'expirado' } });
    expect(proximo.calls.update).toContainEqual({ table: 'reservas', payload: { status: 'expirada' } });
  });

  it('sem pedido, ainda libera as reservas', async () => {
    proximo = clienteFake({});
    await compensarPedido(null, ['r-1']);
    expect(proximo.calls.update.some((c) => c.table === 'pedidos')).toBe(false);
    expect(proximo.calls.update).toContainEqual({ table: 'reservas', payload: { status: 'expirada' } });
  });
});

describe('lerPagamentoMinutos', () => {
  it('devolve o prazo configurado', async () => {
    proximo = clienteFake({ select: { config_operacao: { data: { pagamento_minutos: 30 } } } });
    expect(await lerPagamentoMinutos()).toBe(30);
  });

  it('lança quando a config não existe', async () => {
    proximo = clienteFake({ select: { config_operacao: { error: { message: 'no row' } } } });
    await expect(lerPagamentoMinutos()).rejects.toThrow(/Configuração de operação ausente/);
  });
});

describe('anexarPreferencia', () => {
  it('atualiza o pedido com a preferência', async () => {
    proximo = clienteFake({});
    await anexarPreferencia('p-1', 'pref-1');
    expect(proximo.calls.update).toContainEqual({ table: 'pedidos', payload: { mp_preference_id: 'pref-1' } });
  });
});
