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
  is: (coluna: string, valor: unknown) => Builder;
  not: (coluna: string, operador: string, valor: unknown) => Builder;
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
        is: registrar('is'),
        not: (coluna: string, operador: string, valor: unknown) => {
          consulta.filtros.push({ operador: `not.${operador}`, coluna, valor });
          return builder;
        },
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

  it('T34/RN4 — o filtro é o complemento: ocupa quem não foi encerrado', async () => {
    await carregarSnapshot([{ id: PRODUTO, ehMassa: false }], AGORA);

    const status = consultaDe('pedidos').filtros.find((f) => f.coluna === 'status');

    // Espelha `vagas_ocupadas` (0017): pagamento saiu do critério, e só
    // cancelado e expirado devolvem a vaga.
    expect(status).toEqual({
      operador: 'not.in',
      coluna: 'status',
      valor: '(cancelado,expirado)',
    });
  });

  it('RN4 — reserva amarrada a pedido não é lida: quem ocupa a vaga é o pedido', async () => {
    await carregarSnapshot([{ id: PRODUTO, ehMassa: false }], AGORA);

    const vinculo = consultaDe('reservas').filtros.find((f) => f.coluna === 'pedido_id');

    expect(vinculo).toEqual({ operador: 'is', coluna: 'pedido_id', valor: null });
  });

  it('T9 — reserva consumida sai da conta, o pedido responde pela vaga', async () => {
    linhas.reservas = [];
    linhas.pedidos = [
      { dia_entrega: DIA, pedido_itens: [{ produto_id: PRODUTO, quantidade: 3 }] },
    ];

    const snapshot = await carregarSnapshot([{ id: PRODUTO, ehMassa: false }], AGORA);

    expect(somaConsumos(snapshot.consumos)).toBe(3);
    // A reserva consumida nem chega ao snapshot: a leitura pede `ativa` e ainda viva.
    expect(consultaDe('reservas').filtros).toEqual([
      { operador: 'eq', coluna: 'status', valor: 'ativa' },
      { operador: 'is', coluna: 'pedido_id', valor: null },
      { operador: 'gt', coluna: 'expira_em', valor: AGORA.toISOString() },
    ]);
  });
});
