import type { DiaSemana, Produto, Snapshot } from '@napo/core';

// A disponibilidade precisa somar lotes e reservas, que a RLS esconde de
// qualquer sessão de cliente. O agregado sai daqui; as linhas nunca saem.
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Espelha `vagas_ocupadas` (migration 0017). Divergir daqui faz a vitrine
 * oferecer a vaga que o checkout recusa — ou o contrário.
 *
 * O critério deixou de ser uma lista de estados que ocupam e passou a ser o
 * complemento: ocupa quem não foi encerrado, independente de pagamento (RN4).
 * O desempate contra a reserva que sustenta o pedido é o vínculo
 * `reservas.pedido_id`, não mais o status.
 */
const STATUS_ENCERRADOS = ['cancelado', 'expirado'] as const;

/**
 * Monta o snapshot que alimenta o núcleo puro.
 *
 * O catálogo ainda não existe (`produtos` chega em NAPO-003), então a lista de
 * produtos vem do chamador. Enquanto isso, a vitrine informa quais ids
 * consultar e quais deles são massa — a flag que dispara o sub-teto (RN8).
 */
export async function carregarSnapshot(produtos: Produto[], agora = new Date()): Promise<Snapshot> {
  const supabase = createSupabaseAdminClient();

  const [config, diasEntrega, diasProducao, excecoes, lotes, producao, reservas, pedidos] =
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
        // Reserva amarrada a pedido não conta sozinha: quem ocupa a vaga dela
        // é o pedido. Sem este filtro, a mesma vaga entraria duas vezes.
        .is('pedido_id', null)
        .gt('expira_em', agora.toISOString()),
      // O filtro fica na raiz porque `status` é coluna de `pedidos`: os itens
      // vêm pendurados, sem `!inner` e sem uma segunda ida ao banco.
      supabase
        .from('pedidos')
        .select('dia_entrega, pedido_itens(produto_id, quantidade)')
        .not('status', 'in', `(${STATUS_ENCERRADOS.join(',')})`),
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
    // Carrinho no ar e pedido não encerrado ocupam a mesma vaga (RN4). O núcleo soma a
    // lista inteira; o que decide o que entra aqui é a consulta.
    consumos: [
      ...(reservas.data ?? []).map((r) => ({
        diaEntrega: r.dia_entrega,
        produtoId: r.produto_id,
        quantidade: r.quantidade,
      })),
      ...(pedidos.data ?? []).flatMap((p) =>
        p.pedido_itens.map((i) => ({
          diaEntrega: p.dia_entrega,
          produtoId: i.produto_id,
          quantidade: i.quantidade,
        })),
      ),
    ],
  };
}

export { createSupabaseAdminClient };
