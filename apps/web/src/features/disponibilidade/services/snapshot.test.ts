import { beforeEach, describe, expect, it, vi } from 'vitest';

const PRODUTO = '00000000-0000-0000-0000-0000000000aa';
const DIA = '2026-08-22';
const AGORA = new Date('2026-08-20T12:00:00Z');

interface Consulta {
  tabela: string;
  colunas: string;
  filtros: Array<{ operador: string; coluna: string; valor: unknown }>;
}

interface Builder {
  select: (colunas: string) => Builder;
  eq: (coluna: string, valor: unknown) => Builder;
  gt: (coluna: string, valor: unknown) => Builder;
  in: (coluna: string, valor: unknown) => Builder;
  limit: (n: number) => Builder;
  single: () => Promise<unknown>;
  then: (resolver: (r: unknown) => unknown) => Promise<unknown>;
}

const CONFIG = {
  tempo_preparo_horas: 48,
  teto_forno_dia: 30,
  capacidade_freezer: 150,
  sub_teto_massa_dia: 6,
  limite_ocupacao_massa_pct: 80,
  buffer_cutoff_min: 15,
  reserva_minutos: 15,
  horizonte_semanas: 2,
};

let linhas: Record<string, unknown[]> = {};
let consultas: Consulta[] = [];

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    from(tabela: string) {
      const consulta: Consulta = { tabela, colunas: '', filtros: [] };
      consultas.push(consulta);

      const registrar = (operador: string) => (coluna: string, valor: unknown) => {
        consulta.filtros.push({ operador, coluna, valor });
        return builder;
      };

      const builder: Builder = {
        select: (colunas) => {
          consulta.colunas = colunas;
          return builder;
        },
        eq: registrar('eq'),
        gt: registrar('gt'),
        in: registrar('in'),
        limit: () => builder,
        single: async () => ({ data: CONFIG, error: null }),
        then: (resolver) =>
          Promise.resolve({ data: linhas[tabela] ?? [], error: null }).then(resolver),
      };

      return builder;
    },
  }),
}));

const { carregarSnapshot } = await import('./snapshot');

function consultaDe(tabela: string) {
  const encontrada = consultas.find((c) => c.tabela === tabela);
  if (!encontrada) throw new Error(`${tabela} não foi consultada`);
  return encontrada;
}

function somaConsumos(consumos: { diaEntrega: string; produtoId: string; quantidade: number }[]) {
  return consumos
    .filter((c) => c.diaEntrega === DIA && c.produtoId === PRODUTO)
    .reduce((total, c) => total + c.quantidade, 0);
}

describe('carregarSnapshot — consumos (RN12)', () => {
  beforeEach(() => {
    consultas = [];
    linhas = {};
  });

  it('T33 — reserva viva e pedido ativo somam na mesma vaga', async () => {
    linhas.reservas = [{ dia_entrega: DIA, produto_id: PRODUTO, quantidade: 2 }];
    linhas.pedidos = [
      { dia_entrega: DIA, pedido_itens: [{ produto_id: PRODUTO, quantidade: 3 }] },
    ];

    const snapshot = await carregarSnapshot([{ id: PRODUTO, ehMassa: false }], AGORA);

    expect(somaConsumos(snapshot.consumos)).toBe(5);
  });

  it('T34 — só os status que consomem a fornada são lidos do banco', async () => {
    await carregarSnapshot([{ id: PRODUTO, ehMassa: false }], AGORA);

    const status = consultaDe('pedidos').filtros.find((f) => f.coluna === 'status');

    // `aguardando_pagamento` fica de fora porque a reserva que o sustenta já
    // conta a vaga; expirado, cancelado e estornado devolvem.
    expect(status).toEqual({
      operador: 'in',
      coluna: 'status',
      valor: ['pago', 'em_producao', 'pronto', 'em_rota', 'entregue'],
    });
  });

  it('T9 — reserva consumida sai da conta, o pedido pago responde pela vaga', async () => {
    linhas.reservas = [];
    linhas.pedidos = [
      { dia_entrega: DIA, pedido_itens: [{ produto_id: PRODUTO, quantidade: 3 }] },
    ];

    const snapshot = await carregarSnapshot([{ id: PRODUTO, ehMassa: false }], AGORA);

    expect(somaConsumos(snapshot.consumos)).toBe(3);
    // A reserva consumida nem chega ao snapshot: a leitura pede `ativa` e ainda viva.
    expect(consultaDe('reservas').filtros).toEqual([
      { operador: 'eq', coluna: 'status', valor: 'ativa' },
      { operador: 'gt', coluna: 'expira_em', valor: AGORA.toISOString() },
    ]);
  });
});
