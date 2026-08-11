import { createClient } from '@supabase/supabase-js';

import type { Database } from '@napo/db';
import type { DiaSemana, Produto, Snapshot } from '@napo/core';

import { publicEnv, getServerEnv } from '@/lib/env';

/**
 * Client com `service_role` — **exclusivo de código de servidor** (RN3).
 *
 * A disponibilidade precisa somar lotes e reservas, que a RLS esconde de
 * qualquer sessão de cliente. O agregado sai daqui; as linhas nunca saem.
 */
function createSupabaseAdminClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    getServerEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Monta o snapshot que alimenta o núcleo puro.
 *
 * O catálogo ainda não existe (`produtos` chega em NAPO-003), então a lista de
 * produtos vem do chamador. Enquanto isso, a vitrine informa quais ids
 * consultar e quais deles são massa — a flag que dispara o sub-teto (RN8).
 */
export async function carregarSnapshot(produtos: Produto[], agora = new Date()): Promise<Snapshot> {
  const supabase = createSupabaseAdminClient();

  const [config, diasEntrega, diasProducao, excecoes, lotes, producao, reservas] =
    await Promise.all([
      supabase.from('config_operacao').select('*').limit(1).single(),
      supabase.from('dias_semana_entrega').select('*'),
      supabase.from('dias_semana_producao').select('*'),
      supabase.from('excecoes_calendario').select('data, tipo'),
      supabase.from('lotes').select('produto_id, quantidade, validade, dia_entrega_alocado').eq('ativo', true),
      supabase.from('producao_planejada').select('data, produto_id, quantidade'),
      supabase
        .from('reservas')
        .select('dia_entrega, produto_id, quantidade')
        .eq('status', 'ativa')
        .gt('expira_em', agora.toISOString()),
    ]);

  if (config.error) throw config.error;

  return {
    agora,
    config: {
      tempoPreparoHoras: config.data.tempo_preparo_horas,
      tetoFornoDia: config.data.teto_forno_dia,
      capacidadeFreezer: config.data.capacidade_freezer,
      subTetoMassaDia: config.data.sub_teto_massa_dia,
      limiteOcupacaoMassaPct: config.data.limite_ocupacao_massa_pct,
      bufferCutoffMin: config.data.buffer_cutoff_min,
      reservaMinutos: config.data.reserva_minutos,
      horizonteSemanas: config.data.horizonte_semanas,
    },
    diasEntrega: (diasEntrega.data ?? []).map((d) => ({
      diaSemana: d.dia_semana as DiaSemana,
      entrega: d.entrega,
      // `time` do Postgres chega como `HH:MM:SS`; o núcleo espera `HH:MM`.
      janelaInicio: d.janela_inicio.slice(0, 5),
      janelaFim: d.janela_fim.slice(0, 5),
    })),
    diasProducao: (diasProducao.data ?? []).map((d) => ({
      diaSemana: d.dia_semana as DiaSemana,
      produz: d.produz,
    })),
    excecoes: (excecoes.data ?? []).map((e) => ({ data: e.data, tipo: e.tipo })),
    produtos,
    lotes: (lotes.data ?? []).map((l) => ({
      produtoId: l.produto_id,
      quantidade: l.quantidade,
      validade: l.validade,
      diaEntregaAlocado: l.dia_entrega_alocado,
    })),
    producaoPlanejada: (producao.data ?? []).map((p) => ({
      data: p.data,
      produtoId: p.produto_id,
      quantidade: p.quantidade,
    })),
    consumos: (reservas.data ?? []).map((r) => ({
      diaEntrega: r.dia_entrega,
      produtoId: r.produto_id,
      quantidade: r.quantidade,
    })),
  };
}

export { createSupabaseAdminClient };
