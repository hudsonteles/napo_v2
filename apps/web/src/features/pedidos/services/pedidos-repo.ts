import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Acesso ao banco dos pedidos, isolado das rotas.
 *
 * **Sempre `service_role`.** O `0013` revoga `insert`/`update` de `authenticated`
 * de propósito: o pedido nasce e muda de estado por servidor, porque preço,
 * frete e veredito são decididos no servidor (RN3). Uma sessão de cliente aqui
 * seria isolamento correto e cobrança errada — o cliente escolheria o próprio
 * `total_centavos`. Por isso nenhuma função abaixo usa client de sessão.
 */

export interface ReservaCriada {
  id: string;
  produtoId: string;
  quantidade: number;
  /** Instante exato do vencimento, vindo do `now()` da transação da RPC (RN7). */
  expiraEm: string;
}

export interface ItemParaPedido {
  produtoId: string;
  nomeSnapshot: string;
  quantidade: number;
  precoUnitarioCentavos: number;
}

export interface DadosNovoPedido {
  profileId: string;
  diaEntrega: string;
  enderecoId: string;
  enderecoSnapshot: unknown;
  subtotalCentavos: number;
  freteCentavos: number;
  totalCentavos: number;
  reservaId: string;
  expiraEm: string;
  itens: ItemParaPedido[];
}

export interface PedidoCriado {
  id: string;
  numero: number;
}

/**
 * Reserva o carrinho inteiro sob um único lock do dia (RN7). Devolve `null`
 * quando a RPC recusa — que no caminho normal significa "não cabe mais na
 * fornada", e o chamador traduz em 409 sem cobrar nada (T36).
 */
export async function reservarCarrinho(params: {
  diaEntrega: string;
  itens: { produto_id: string; quantidade: number }[];
  profileId: string;
  limites: { produto_id: string; limite: number }[];
  minutos: number;
}): Promise<ReservaCriada[] | null> {
  const { data, error } = await createSupabaseAdminClient().rpc('reservar_carrinho', {
    p_dia: params.diaEntrega,
    p_itens: params.itens,
    p_profile: params.profileId,
    p_limites: params.limites,
    p_minutos: params.minutos,
  });

  if (error || !data) return null;

  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    produtoId: r.produto_id as string,
    quantidade: r.quantidade as number,
    expiraEm: r.expira_em as string,
  }));
}

/**
 * Grava o pedido e seus itens com os snapshots (RN4).
 *
 * `canal` e `atividade_fiscal` são passados explícitos, não deixados no default
 * do banco: o default protege quem inserir por SQL, o valor explícito documenta
 * a intenção do canal e torna a RN20 observável no teste (T12).
 *
 * Pedido e itens são dois `insert`. Se o segundo falha, o primeiro é apagado
 * (o cascade limpa itens já gravados): pedido sem item é pedido inválido, e
 * deixá-lo órfão faria a conta da fornada contar uma linha que ninguém pediu.
 */
export async function inserirPedido(dados: DadosNovoPedido): Promise<PedidoCriado | null> {
  const supabase = createSupabaseAdminClient();

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .insert({
      profile_id: dados.profileId,
      canal: 'site',
      atividade_fiscal: 'congelado_industrializado',
      dia_entrega: dados.diaEntrega,
      endereco_id: dados.enderecoId,
      endereco_snapshot: dados.enderecoSnapshot as never,
      subtotal_centavos: dados.subtotalCentavos,
      frete_centavos: dados.freteCentavos,
      total_centavos: dados.totalCentavos,
      reserva_id: dados.reservaId,
      expira_em: dados.expiraEm,
    })
    .select('id, numero')
    .single();

  if (error || !pedido) return null;

  const { error: erroItens } = await supabase.from('pedido_itens').insert(
    dados.itens.map((i) => ({
      pedido_id: pedido.id,
      produto_id: i.produtoId,
      nome_snapshot: i.nomeSnapshot,
      quantidade: i.quantidade,
      preco_unitario_snapshot: i.precoUnitarioCentavos,
    })),
  );

  if (erroItens) {
    await supabase.from('pedidos').delete().eq('id', pedido.id);
    return null;
  }

  return { id: pedido.id, numero: pedido.numero };
}

/** Anexa a preferência do Mercado Pago ao pedido já criado (último passo). */
export async function anexarPreferencia(pedidoId: string, preferenceId: string): Promise<void> {
  await createSupabaseAdminClient()
    .from('pedidos')
    .update({ mp_preference_id: preferenceId })
    .eq('id', pedidoId);
}

/**
 * Desfaz o pedido quando a cobrança não pôde ser criada (RN7, T37).
 *
 * Marca o pedido `expirado` e libera as reservas na MESMA requisição: sem isto,
 * indisponibilidade do Mercado Pago viraria vaga presa por 30 minutos — o
 * gargalo do negócio parado por erro de terceiro. Reserva `expirada` para de
 * contar em `vagas_ocupadas` de imediato, a vaga volta agora, não no vencimento.
 */
export async function compensarPedido(
  pedidoId: string | null,
  reservaIds: string[],
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  if (pedidoId) {
    await supabase.from('pedidos').update({ status: 'expirado' }).eq('id', pedidoId);
  }

  if (reservaIds.length > 0) {
    await supabase.from('reservas').update({ status: 'expirada' }).in('id', reservaIds);
  }
}

/** Prazo do pagamento em minutos (RN7). Coluna própria, não `reserva_minutos`. */
export async function lerPagamentoMinutos(): Promise<number> {
  const { data, error } = await createSupabaseAdminClient()
    .from('config_operacao')
    .select('pagamento_minutos')
    .single();

  if (error || !data) {
    throw new Error('Configuração de operação ausente — pagamento_minutos indisponível.');
  }

  return data.pagamento_minutos;
}
