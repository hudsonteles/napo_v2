import { beforeEach, describe, expect, it, vi } from 'vitest';

// Um builder por tabela que finge a cadeia do supabase-js: cada filtro grava o
// argumento e devolve a si mesmo; o terminal resolve a linha canned. É o único
// jeito de afirmar, no caminho da aplicação, que o snapshot conta as mesmas
// vagas que `vagas_ocupadas` conta no banco (RN12).
const chamadas: Record<string, { eq: unknown[][]; gt: unknown[][]; in: unknown[][] }> = {};

function builder(tabela: string, resultado: unknown) {
  const registro = { eq: [] as unknown[][], gt: [] as unknown[][], in: [] as unknown[][] };
  chamadas[tabela] = registro;
  const b: Record<string, unknown> = {
    select: () => b,
    limit: () => b,
    eq: (...a: unknown[]) => (registro.eq.push(a), b),
    gt: (...a: unknown[]) => (registro.gt.push(a), b),
    in: (...a: unknown[]) => (registro.in.push(a), b),
    single: () => Promise.resolve(resultado),
    then: (r: (v: unknown) => unknown, j: (e: unknown) => unknown) =>
      Promise.resolve(resultado).then(r, j),
  };
  return b;
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

const P1 = '00000000-0000-0000-0000-0000000000a1';

let dados: Record<string, unknown>;

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    from: (tabela: string) => builder(tabela, dados[tabela]),
  }),
}));

const { carregarSnapshot } = await import('./snapshot');

function base() {
  return {
    config_operacao: { data: CONFIG, error: null },
    dias_semana_entrega: { data: [] },
    dias_semana_producao: { data: [] },
    excecoes_calendario: { data: [] },
    lotes: { data: [] },
    producao_planejada: { data: [] },
    reservas: { data: [] },
    pedidos: { data: [] },
  } as Record<string, unknown>;
}

function filtros(tabela: string) {
  const c = chamadas[tabela];
  if (!c) throw new Error(`sem chamadas registradas para ${tabela}`);
  return c;
}

function somaConsumo(consumos: { diaEntrega: string; produtoId: string; quantidade: number }[]) {
  return consumos
    .filter((c) => c.diaEntrega === '2026-08-22' && c.produtoId === P1)
    .reduce((t, c) => t + c.quantidade, 0);
}

describe('carregarSnapshot — consumos (RN12)', () => {
  beforeEach(() => {
    dados = base();
  });

  it('T33 — soma reserva viva e pedido ativo do mesmo produto/dia', async () => {
    dados.reservas = { data: [{ dia_entrega: '2026-08-22', produto_id: P1, quantidade: 2 }] };
    dados.pedidos = {
      data: [
        { dia_entrega: '2026-08-22', status: 'pago', pedido_itens: [{ produto_id: P1, quantidade: 3 }] },
      ],
    };

    const snapshot = await carregarSnapshot([{ id: P1, ehMassa: false }]);

    expect(somaConsumo(snapshot.consumos)).toBe(5);
  });

  it('T9 — pedido ativo ocupa vaga mesmo sem reserva viva', async () => {
    dados.reservas = { data: [] };
    dados.pedidos = {
      data: [
        { dia_entrega: '2026-08-22', status: 'pago', pedido_itens: [{ produto_id: P1, quantidade: 3 }] },
      ],
    };

    const snapshot = await carregarSnapshot([{ id: P1, ehMassa: false }]);

    expect(somaConsumo(snapshot.consumos)).toBe(3);
  });

  it('T34 — a consulta filtra fora o que não ocupa (reserva viva + pedido que consome fornada)', async () => {
    await carregarSnapshot([{ id: P1, ehMassa: false }]);

    // Reserva: só ativa e não vencida.
    expect(filtros('reservas').eq).toContainEqual(['status', 'ativa']);
    expect(filtros('reservas').gt[0]?.[0]).toBe('expira_em');

    // Pedido: só os estados que consomem a fornada — exclui aguardando_pagamento,
    // expirado, cancelado e estornado (mesmo filtro de `vagas_ocupadas`).
    expect(filtros('pedidos').in).toContainEqual([
      'status',
      ['pago', 'em_producao', 'pronto', 'em_rota', 'entregue'],
    ]);
  });
});
