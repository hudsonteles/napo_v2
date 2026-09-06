import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Acesso ao banco isolado das rotas.
 *
 * Escreve com a chave de serviço porque `INSERT`/`UPDATE` de `pedidos` foram
 * **revogados** de `authenticated` (0013): uma política que deixasse o cliente
 * inserir daria isolamento correto e cobrança errada — ele escolheria o próprio
 * `total_centavos`. Pedido nasce e muda por servidor.
 *
 * A leitura passa por `pedidos_com_pagamento` porque a situação de pagamento é
 * derivada das cobranças (RN2) e não existe como coluna.
 */

export type SituacaoPagamento =
  | 'sem_pagamento'
  | 'aguardando'
  | 'parcial'
  | 'pago'
  | 'estornado';

export interface ItemReservado {
  id: string;
  produto_id: string;
  quantidade: number;
  expira_em: string;
}

export interface ItemDoPedido {
  produtoId: string;
  nome: string;
  quantidade: number;
  precoUnitarioCentavos: number;
}

export interface PedidoParaGravar {
  profileId: string;
  diaEntrega: string;
  enderecoId: string;
  enderecoSnapshot: unknown;
  subtotalCentavos: number;
  freteCentavos: number;
  totalCentavos: number;
  expiraEm: string;
  /**
   * TODAS as reservas do carrinho, não só a primeira. É o vínculo que impede a
   * contagem dupla em `vagas_ocupadas` (RN4): reserva amarrada a pedido deixa
   * de contar sozinha, e um carrinho de três sabores tem três linhas.
   */
  reservaIds: string[];
  itens: ItemDoPedido[];
}

export interface PedidoGravado {
  id: string;
  numero: number;
}

export interface PedidoLido {
  id: string;
  numero: number;
  profileId: string;
  /** Ciclo de entrega, não de dinheiro (RN3). */
  status: string;
  situacaoPagamento: SituacaoPagamento;
  diaEntrega: string;
  totalCentavos: number;
  expiraEm: string;
  itens: { produtoId: string; quantidade: number }[];
}

export interface EventoDePagamento {
  pedidoId: string | null;
  mpPaymentId: string | null;
  resultado:
    | 'confirmado'
    | 'duplicado'
    | 'assinatura_invalida'
    | 'valor_divergente'
    | 'pagamento_nao_aprovado'
    | 'pedido_desconhecido'
    | 'erro';
  detalhe?: string | null;
  corpo?: unknown;
}

export interface RepositorioDePedidos {
  pagamentoMinutos(): Promise<number>;
  reservarCarrinho(entrada: {
    dia: string;
    itens: { produto_id: string; quantidade: number }[];
    profileId: string;
    limites: { produto_id: string; limite: number }[];
    minutos: number;
  }): Promise<ItemReservado[] | null>;
  gravarPedido(pedido: PedidoParaGravar): Promise<PedidoGravado>;
  /** Compensação da RN13: some com o pedido e devolve a vaga na mesma requisição. */
  desfazerPedido(pedidoId: string, reservaIds: string[]): Promise<void>;
  lerPedido(pedidoId: string): Promise<PedidoLido | null>;
  lerPedidoPorNumero(numero: number): Promise<PedidoLido | null>;
  /** `false` = a cobrança já estava aprovada. É a resposta idempotente do webhook (RN16). */
  confirmarPagamento(entrada: {
    cobrancaId: string;
    mpPaymentId: string;
    forma: string;
    veredito: 'viavel' | 'cutoff_vencido' | 'sem_vaga';
  }): Promise<boolean>;
  /** `false` = já estava cancelado ou expirado. */
  cancelarPedido(pedidoId: string, devolucao: 'capacidade' | 'lote'): Promise<boolean>;
  registrarEvento(evento: EventoDePagamento): Promise<void>;
  /** Pedidos que passaram do prazo sem que o dinheiro chegasse (RN19). */
  pedidosVencidos(): Promise<PedidoLido[]>;
  expirarPedidos(): Promise<number>;
}

const CAMPOS_PEDIDO =
  'id, numero, profile_id, status, situacao_pagamento, dia_entrega, total_centavos, expira_em, pedido_itens(produto_id, quantidade)';

interface LinhaPedido {
  id: string;
  numero: number;
  profile_id: string;
  status: string;
  situacao_pagamento: SituacaoPagamento;
  dia_entrega: string;
  total_centavos: number;
  expira_em: string;
  pedido_itens: { produto_id: string; quantidade: number }[];
}

function paraPedido(linha: LinhaPedido): PedidoLido {
  return {
    id: linha.id,
    numero: Number(linha.numero),
    profileId: linha.profile_id,
    status: linha.status,
    situacaoPagamento: linha.situacao_pagamento,
    diaEntrega: linha.dia_entrega,
    totalCentavos: linha.total_centavos,
    expiraEm: linha.expira_em,
    itens: linha.pedido_itens.map((item) => ({
      produtoId: item.produto_id,
      quantidade: item.quantidade,
    })),
  };
}

export function repositorioDePedidos(): RepositorioDePedidos {
  const supabase = createSupabaseAdminClient();

  return {
    async pagamentoMinutos() {
      const { data, error } = await supabase
        .from('config_operacao')
        .select('pagamento_minutos')
        .limit(1)
        .single();

      if (error) throw error;
      return data.pagamento_minutos;
    },

    async reservarCarrinho({ dia, itens, profileId, limites, minutos }) {
      const { data, error } = await supabase.rpc('reservar_carrinho', {
        p_dia: dia,
        p_itens: itens,
        p_profile: profileId,
        p_limites: limites,
        p_minutos: minutos,
      });

      // A recusa por falta de vaga é `raise exception` na função: erro aqui é
      // "não coube", não "quebrou" — quem chama traduz para 409 (T36).
      if (error) return null;
      return (data ?? []) as unknown as ItemReservado[];
    },

    async gravarPedido(pedido) {
      const { data, error } = await supabase
        .from('pedidos')
        .insert({
          profile_id: pedido.profileId,
          dia_entrega: pedido.diaEntrega,
          endereco_id: pedido.enderecoId,
          endereco_snapshot: pedido.enderecoSnapshot as never,
          subtotal_centavos: pedido.subtotalCentavos,
          frete_centavos: pedido.freteCentavos,
          total_centavos: pedido.totalCentavos,
          expira_em: pedido.expiraEm,
          reserva_id: pedido.reservaIds[0],
        })
        .select('id, numero')
        .single();

      if (error) throw error;

      const itens = await supabase.from('pedido_itens').insert(
        pedido.itens.map((item) => ({
          pedido_id: data.id,
          produto_id: item.produtoId,
          nome_snapshot: item.nome,
          quantidade: item.quantidade,
          preco_unitario_snapshot: item.precoUnitarioCentavos,
        })),
      );

      if (itens.error) throw itens.error;

      // O vínculo precisa existir antes de a próxima consulta de
      // disponibilidade acontecer: entre o insert do pedido e este update, a
      // vaga conta duas vezes.
      const vinculo = await supabase
        .from('reservas')
        .update({ pedido_id: data.id })
        .in('id', pedido.reservaIds);

      if (vinculo.error) throw vinculo.error;

      return { id: data.id, numero: Number(data.numero) };
    },

    async desfazerPedido(pedidoId, reservaIds) {
      // Todas as reservas do carrinho, não só a gravada em `pedidos.reserva_id`:
      // um carrinho de três sabores tem três linhas, e deixar duas vivas
      // prenderia vaga por trinta minutos por um erro do gateway (T37).
      await supabase.from('reservas').update({ status: 'expirada' }).in('id', reservaIds);
      await supabase.from('pedidos').update({ status: 'expirado' }).eq('id', pedidoId);
    },

    async lerPedido(pedidoId) {
      const { data } = await supabase
        .from('pedidos_com_pagamento')
        .select(CAMPOS_PEDIDO)
        .eq('id', pedidoId)
        .maybeSingle();

      return data ? paraPedido(data as unknown as LinhaPedido) : null;
    },

    async lerPedidoPorNumero(numero) {
      const { data } = await supabase
        .from('pedidos_com_pagamento')
        .select(CAMPOS_PEDIDO)
        .eq('numero', numero)
        .maybeSingle();

      return data ? paraPedido(data as unknown as LinhaPedido) : null;
    },

    async confirmarPagamento({ cobrancaId, mpPaymentId, forma, veredito }) {
      const { data, error } = await supabase.rpc('confirmar_pagamento', {
        p_cobranca: cobrancaId,
        p_payment_id: mpPaymentId,
        p_forma: forma,
        p_veredito: veredito,
      });

      if (error) throw error;
      return data === true;
    },

    async cancelarPedido(pedidoId, devolucao) {
      const { data, error } = await supabase.rpc('cancelar_pedido', {
        p_pedido: pedidoId,
        p_devolucao: devolucao,
      });

      if (error) throw error;
      return data === true;
    },

    async registrarEvento(evento) {
      // Erro ao registrar não pode derrubar a resposta ao gateway: o registro é
      // trilha, e perder a trilha é pior do que provocar um reenvio inútil.
      await supabase.from('pagamento_eventos').insert({
        pedido_id: evento.pedidoId,
        mp_payment_id: evento.mpPaymentId,
        resultado: evento.resultado,
        detalhe: evento.detalhe ?? null,
        corpo: (evento.corpo ?? null) as never,
      });
    },

    async pedidosVencidos() {
      const { data } = await supabase
        .from('pedidos_com_pagamento')
        .select(CAMPOS_PEDIDO)
        .eq('status', 'novo')
        .lte('expira_em', new Date().toISOString());

      // O filtro da situação fica aqui e não na consulta porque `aguardando`
      // também é pedido a investigar: é o caso da RN19, em que a cobrança
      // existe no gateway e a notificação nunca chegou.
      return ((data ?? []) as unknown as LinhaPedido[])
        .map(paraPedido)
        .filter((pedido) => pedido.situacaoPagamento !== 'pago');
    },

    async expirarPedidos() {
      const { data, error } = await supabase.rpc('expirar_pedidos');
      if (error) throw error;
      return data ?? 0;
    },
  };
}
