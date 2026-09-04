import 'server-only';

import type { Devolucao, Veredito } from '@napo/core';

import type { PagamentoConsultado, PortaPagamento } from '@/lib/pagamentos/porta';

import type { EventoDePagamento, PedidoLido, RepositorioDePedidos } from './pedidos-repo';

/**
 * O ponto onde o dinheiro vira pedido (RN8, RN9, RN10, RN11).
 *
 * Nada aqui confia no corpo da notificação além do id: o status e o valor vêm
 * de consulta ao gateway, e o valor é conferido contra o total do pedido. Uma
 * notificação forjada com valor alto não confirma nada.
 */

export interface DependenciasDaConfirmacao {
  pagamento: PortaPagamento;
  repo: RepositorioDePedidos;
  /**
   * O veredito da RN11, decidido em `packages/core` e passado pronto ao banco.
   * Chega injetado porque depende do motor de disponibilidade, que é outra
   * feature (ARCHITECTURE §3.2).
   */
  veredito(pedido: PedidoLido): Promise<Veredito>;
  /** O que volta ao motor num estorno: vaga de forno antes do cutoff, lote depois (RN14). */
  devolucao(pedido: PedidoLido): Promise<Devolucao>;
}

export type ResultadoDaConfirmacao = EventoDePagamento['resultado'];

export interface RespostaDaConfirmacao {
  /** O status HTTP que o webhook deve devolver ao gateway. */
  http: number;
  resultado: ResultadoDaConfirmacao;
}

/** Caminho do webhook: o gateway diz qual pagamento mudou. */
export async function processarNotificacao(
  idPagamento: string,
  deps: DependenciasDaConfirmacao,
  corpo?: unknown,
): Promise<RespostaDaConfirmacao> {
  const pagamento = await deps.pagamento.consultarPagamento(idPagamento);

  if (!pagamento) {
    await deps.repo.registrarEvento({
      pedidoId: null,
      mpPaymentId: idPagamento,
      resultado: 'erro',
      detalhe: 'pagamento não encontrado no gateway',
      corpo,
    });
    // 5xx de propósito: o gateway reenvia, e é exatamente o caso em que
    // reenviar resolve — a notificação chegou antes do próprio pagamento.
    return { http: 502, resultado: 'erro' };
  }

  if (!pagamento.referenciaExterna) {
    await deps.repo.registrarEvento({
      pedidoId: null,
      mpPaymentId: pagamento.id,
      resultado: 'pedido_desconhecido',
      detalhe: 'pagamento sem referência externa',
      corpo,
    });
    return { http: 200, resultado: 'pedido_desconhecido' };
  }

  const pedido = await deps.repo.lerPedido(pagamento.referenciaExterna);

  if (!pedido) {
    await deps.repo.registrarEvento({
      pedidoId: null,
      mpPaymentId: pagamento.id,
      resultado: 'pedido_desconhecido',
      detalhe: pagamento.referenciaExterna,
      corpo,
    });
    // 200: reenviar não faz o pedido existir.
    return { http: 200, resultado: 'pedido_desconhecido' };
  }

  return aplicarPagamento(pedido, pagamento, deps, corpo);
}

/**
 * Caminho da RN19: a notificação nunca chegou, e quem pergunta é a tela do
 * pedido ou a varredura. O pagamento é procurado pela referência, porque do
 * nosso lado só existe o id do pedido.
 */
export async function reconciliarPedido(
  pedido: PedidoLido,
  deps: DependenciasDaConfirmacao,
): Promise<RespostaDaConfirmacao> {
  const pagamento = await deps.pagamento.buscarPagamentoDaReferencia(pedido.id);

  if (!pagamento) return { http: 200, resultado: 'pagamento_nao_aprovado' };

  return aplicarPagamento(pedido, pagamento, deps);
}

async function aplicarPagamento(
  pedido: PedidoLido,
  pagamento: PagamentoConsultado,
  deps: DependenciasDaConfirmacao,
  corpo?: unknown,
): Promise<RespostaDaConfirmacao> {
  if (pagamento.status === 'estornado') return estornar(pedido, pagamento, deps, corpo);

  if (pedido.status === 'pago') {
    // O pedido já está resolvido: registra a passagem e não toca em nada. É a
    // idempotência da RN9 pelo caminho limpo — o índice único é a garantia dura.
    await deps.repo.registrarEvento({
      pedidoId: pedido.id,
      mpPaymentId: pagamento.id,
      resultado: 'duplicado',
      corpo,
    });
    return { http: 200, resultado: 'duplicado' };
  }

  if (pagamento.status !== 'aprovado') {
    // O corpo da notificação pode dizer o que quiser: quem manda é a consulta.
    await deps.repo.registrarEvento({
      pedidoId: pedido.id,
      mpPaymentId: pagamento.id,
      resultado: 'pagamento_nao_aprovado',
      detalhe: pagamento.status,
      corpo,
    });
    return { http: 200, resultado: 'pagamento_nao_aprovado' };
  }

  if (pagamento.valorCentavos !== pedido.totalCentavos) {
    await deps.repo.registrarEvento({
      pedidoId: pedido.id,
      mpPaymentId: pagamento.id,
      resultado: 'valor_divergente',
      detalhe: `pago ${pagamento.valorCentavos}, devido ${pedido.totalCentavos}`,
      corpo,
    });
    return { http: 200, resultado: 'valor_divergente' };
  }

  // Dinheiro que entrou nunca é recusado (RN11): dia inviável nasce pago, com o
  // veredito gravado e alerta para o admin resolver com uma ligação.
  const veredito = await deps.veredito(pedido);

  const confirmou = await deps.repo.confirmarPagamento({
    pedidoId: pedido.id,
    mpPaymentId: pagamento.id,
    forma: pagamento.forma,
    veredito,
  });

  await deps.repo.registrarEvento({
    pedidoId: pedido.id,
    mpPaymentId: pagamento.id,
    resultado: confirmou ? 'confirmado' : 'duplicado',
    detalhe: veredito === 'viavel' ? null : veredito,
    corpo,
  });

  return { http: 200, resultado: confirmou ? 'confirmado' : 'duplicado' };
}

async function estornar(
  pedido: PedidoLido,
  pagamento: PagamentoConsultado,
  deps: DependenciasDaConfirmacao,
  corpo?: unknown,
): Promise<RespostaDaConfirmacao> {
  if (pedido.status === 'estornado') {
    await deps.repo.registrarEvento({
      pedidoId: pedido.id,
      mpPaymentId: pagamento.id,
      resultado: 'duplicado',
      corpo,
    });
    return { http: 200, resultado: 'duplicado' };
  }

  const devolucao = await deps.devolucao(pedido);

  await deps.repo.marcarEstornado(pedido.id);

  // O que volta é vaga de forno ou lote pronto, e quem recoloca o lote em
  // estoque é o NAPO-008 (RN14). Aqui fica o registro de qual dos dois é.
  await deps.repo.registrarEvento({
    pedidoId: pedido.id,
    mpPaymentId: pagamento.id,
    resultado: 'confirmado',
    detalhe: `estorno: devolucao ${devolucao}`,
    corpo,
  });

  return { http: 200, resultado: 'confirmado' };
}
