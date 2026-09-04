import 'server-only';

import type { Devolucao, Snapshot, Veredito } from '@napo/core';

import type { PortaPagamento } from '@/lib/pagamentos/porta';

import type { DependenciasDaConfirmacao } from './confirmar-pagamento';
import type { PedidoLido, RepositorioDePedidos } from './pedidos-repo';

/**
 * Fiação da confirmação: quatro rotas montariam a mesma coisa de quatro jeitos.
 *
 * O motor de disponibilidade é outra feature, então snapshot e decisões puras
 * chegam de fora (ARCHITECTURE §3.2). O que mora aqui é como o pedido pergunta.
 */
export interface FerramentasDeViabilidade {
  carregarSnapshot(produtos: { id: string; ehMassa: boolean }[]): Promise<Snapshot>;
  avaliarViabilidade(
    dia: string,
    produtoId: string,
    quantidade: number,
    snapshot: Snapshot,
  ): Veredito;
  devolucaoPorCancelamento(dia: string, snapshot: Snapshot): Devolucao;
}

export function dependenciasDaConfirmacao(
  repo: RepositorioDePedidos,
  pagamento: PortaPagamento,
  ferramentas: FerramentasDeViabilidade,
): DependenciasDaConfirmacao {
  const snapshotDoPedido = (pedido: PedidoLido) =>
    ferramentas.carregarSnapshot(
      pedido.itens.map((item) => ({ id: item.produtoId, ehMassa: false })),
    );

  return {
    pagamento,
    repo,

    async veredito(pedido) {
      const snapshot = await snapshotDoPedido(pedido);

      const vereditos = pedido.itens.map((item) =>
        ferramentas.avaliarViabilidade(
          pedido.diaEntrega,
          item.produtoId,
          item.quantidade,
          // Sem descontar a reserva que sustenta este pedido, o cliente
          // disputaria a vaga contra si mesmo: a reserva dele ocupa o dia, e a
          // avaliação diria `sem_vaga` para todo pedido que pagou no prazo.
          semAPropriaReserva(snapshot, pedido.diaEntrega, item.produtoId, item.quantidade),
        ),
      );

      // Um item inviável torna o pedido inteiro inviável: entregar parte da
      // sacola no dia combinado não é honrar o combinado.
      return vereditos.find((veredito) => veredito !== 'viavel') ?? 'viavel';
    },

    async devolucao(pedido) {
      const snapshot = await snapshotDoPedido(pedido);
      return ferramentas.devolucaoPorCancelamento(pedido.diaEntrega, snapshot);
    },
  };
}

/**
 * Devolve o snapshot com a reserva deste pedido abatida dos consumos.
 *
 * Se a reserva já venceu, ela nem está no snapshot (o motor filtra por
 * `expira_em`) e nada é abatido — que é exatamente o caso da RN11: o dia encheu
 * enquanto o cliente pagava.
 */
function semAPropriaReserva(
  snapshot: Snapshot,
  dia: string,
  produtoId: string,
  quantidade: number,
): Snapshot {
  let restante = quantidade;

  const consumos = snapshot.consumos.flatMap((consumo) => {
    if (restante <= 0 || consumo.diaEntrega !== dia || consumo.produtoId !== produtoId) {
      return [consumo];
    }

    const abatido = Math.min(restante, consumo.quantidade);
    restante -= abatido;

    const sobra = consumo.quantidade - abatido;
    return sobra > 0 ? [{ ...consumo, quantidade: sobra }] : [];
  });

  return { ...snapshot, consumos };
}
