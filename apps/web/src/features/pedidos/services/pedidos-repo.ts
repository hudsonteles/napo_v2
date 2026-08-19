import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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

// ── Ciclo de vida: confirmação, estorno, cancelamento, expiração (bloco H) ──────

export type ResultadoEvento =
  | 'confirmado'
  | 'duplicado'
  | 'assinatura_invalida'
  | 'valor_divergente'
  | 'pagamento_nao_aprovado'
  | 'pedido_desconhecido'
  | 'erro';

/** Item de pedido reduzido ao que a confirmação precisa (veredito da RN11). */
export interface ItemDoPedido {
  produtoId: string;
  quantidade: number;
}

/** Pedido lido por `service_role` para o webhook — o webhook não tem sessão. */
export interface PedidoParaConfirmacao {
  id: string;
  numero: number;
  status: string;
  totalCentavos: number;
  diaEntrega: string;
  mpPaymentId: string | null;
  itens: ItemDoPedido[];
}

/**
 * Lê um pedido pelo número, com `service_role`, para o fluxo do webhook. Sem
 * sessão: quem chega aqui é notificação do Mercado Pago, não pessoa. O
 * isolamento por dono (RN17) é irrelevante nesta porta — ela nunca serve dado
 * ao navegador, só decide a confirmação.
 */
export async function lerPedidoParaConfirmacao(numero: number): Promise<PedidoParaConfirmacao | null> {
  const { data } = await createSupabaseAdminClient()
    .from('pedidos')
    .select('id, numero, status, total_centavos, dia_entrega, mp_payment_id, pedido_itens(produto_id, quantidade)')
    .eq('numero', numero)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    numero: data.numero,
    status: data.status,
    totalCentavos: data.total_centavos,
    diaEntrega: data.dia_entrega,
    mpPaymentId: data.mp_payment_id,
    itens: (data.pedido_itens ?? []).map((i) => ({ produtoId: i.produto_id, quantidade: i.quantidade })),
  };
}

/** Registra uma notificação no rastro de pagamento (RN10, RN19). */
export async function registrarEventoPagamento(evento: {
  pedidoId: string | null;
  mpPaymentId: string | null;
  resultado: ResultadoEvento;
  detalhe?: string;
  corpo?: unknown;
}): Promise<void> {
  await createSupabaseAdminClient()
    .from('pagamento_eventos')
    .insert({
      pedido_id: evento.pedidoId,
      mp_payment_id: evento.mpPaymentId,
      resultado: evento.resultado,
      detalhe: evento.detalhe ?? null,
      corpo: (evento.corpo ?? null) as never,
    });
}

/**
 * Confirma o pagamento pela RPC atômica (RN9). `false` = já estava pago
 * (idempotência); erro propaga para o webhook virar 5xx e o Mercado Pago
 * reenviar (RN8, T30).
 */
export async function confirmarPagamentoRpc(
  pedidoId: string,
  paymentId: string,
  forma: string,
  veredito: 'viavel' | 'cutoff_vencido' | 'sem_vaga',
): Promise<boolean> {
  const { data, error } = await createSupabaseAdminClient().rpc('confirmar_pagamento', {
    p_pedido: pedidoId,
    p_payment_id: paymentId,
    p_forma: forma,
    p_veredito: veredito,
  });

  if (error) throw error;
  return data === true;
}

/** Reflete estorno/chargeback notificado (RN14, T39). `false` = já estava terminal. */
export async function estornarPedidoRpc(pedidoId: string, devolucao: 'capacidade' | 'lote'): Promise<boolean> {
  const { data, error } = await createSupabaseAdminClient().rpc('estornar_pedido', {
    p_pedido: pedidoId,
    p_devolucao: devolucao,
  });

  if (error) throw error;
  return data === true;
}

/** Cancela pelo cliente antes do cutoff (RN14/RN15). `false` = já estava terminal. */
export async function cancelarPedidoRpc(pedidoId: string, devolucao: 'capacidade' | 'lote'): Promise<boolean> {
  const { data, error } = await createSupabaseAdminClient().rpc('cancelar_pedido', {
    p_pedido: pedidoId,
    p_devolucao: devolucao,
  });

  if (error) throw error;
  return data === true;
}

/** Varre e expira pedidos vencidos, liberando as reservas (RN13). Devolve o total expirado. */
export async function expirarPedidosRpc(): Promise<number> {
  const { data, error } = await createSupabaseAdminClient().rpc('expirar_pedidos');
  if (error) throw error;
  return data ?? 0;
}

/** Um pedido do próprio cliente (RN17), lido sob a RLS do dono — id alheio não existe. */
export interface PedidoDoDono {
  /** UUID interno — usado por rota de servidor (cancelamento); nunca exposto ao cliente. */
  id: string;
  numero: number;
  status: string;
  diaEntrega: string;
  subtotalCentavos: number;
  freteCentavos: number;
  totalCentavos: number;
  veredito: string | null;
  criadoEm: string;
  enderecoSnapshot: unknown;
  itens: Array<{ produtoId: string; nome: string; quantidade: number; precoUnitarioCentavos: number }>;
}

export async function lerPedidoDoDono(numero: number): Promise<PedidoDoDono | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('pedidos')
    .select(
      'id, numero, status, dia_entrega, subtotal_centavos, frete_centavos, total_centavos, veredito, created_at, endereco_snapshot, pedido_itens(produto_id, nome_snapshot, quantidade, preco_unitario_snapshot)',
    )
    .eq('numero', numero)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    numero: data.numero,
    status: data.status,
    diaEntrega: data.dia_entrega,
    subtotalCentavos: data.subtotal_centavos,
    freteCentavos: data.frete_centavos,
    totalCentavos: data.total_centavos,
    veredito: data.veredito,
    criadoEm: data.created_at,
    enderecoSnapshot: data.endereco_snapshot,
    itens: (data.pedido_itens ?? []).map((i) => ({
      produtoId: i.produto_id,
      nome: i.nome_snapshot,
      quantidade: i.quantidade,
      precoUnitarioCentavos: i.preco_unitario_snapshot,
    })),
  };
}
