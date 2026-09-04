import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Acesso ao banco isolado das rotas.
 *
 * Escreve com a chave de serviço porque `INSERT`/`UPDATE` de `pedidos` foram
 * **revogados** de `authenticated` (0013): uma política que deixasse o cliente
 * inserir daria isolamento correto e cobrança errada — ele escolheria o próprio
 * `total_centavos`. Pedido nasce e muda por servidor.
 */

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
  reservaId: string;
  itens: ItemDoPedido[];
}

export interface PedidoGravado {
  id: string;
  numero: number;
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
  registrarPreferencia(pedidoId: string, preferenciaId: string): Promise<void>;
  /** Compensação da RN13: some com o pedido e devolve a vaga na mesma requisição. */
  desfazerPedido(pedidoId: string, reservaIds: string[]): Promise<void>;
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
          reserva_id: pedido.reservaId,
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

      return { id: data.id, numero: Number(data.numero) };
    },

    async registrarPreferencia(pedidoId, preferenciaId) {
      const { error } = await supabase
        .from('pedidos')
        .update({ mp_preference_id: preferenciaId })
        .eq('id', pedidoId);

      if (error) throw error;
    },

    async desfazerPedido(pedidoId, reservaIds) {
      // Todas as reservas do carrinho, não só a gravada em `pedidos.reserva_id`:
      // um carrinho de três sabores tem três linhas, e deixar duas vivas
      // prenderia vaga por trinta minutos por um erro do gateway (T37).
      await supabase.from('reservas').update({ status: 'expirada' }).in('id', reservaIds);
      await supabase.from('pedidos').update({ status: 'expirado' }).eq('id', pedidoId);
    },
  };
}
