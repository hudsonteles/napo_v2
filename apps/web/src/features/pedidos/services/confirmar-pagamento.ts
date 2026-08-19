import 'server-only';

import {
  avaliarViabilidade,
  devolucaoPorCancelamento,
  type Devolucao,
  type Veredito,
} from '@napo/core';

import { lerCatalogo } from '@/features/catalogo';
import { carregarSnapshot } from '@/features/disponibilidade';
import { portaPagamento, type PagamentoConsultado } from '@/lib/pagamentos/porta';

import {
  confirmarPagamentoRpc,
  estornarPedidoRpc,
  lerPedidoParaConfirmacao,
  registrarEventoPagamento,
  type PedidoParaConfirmacao,
} from './pedidos-repo';

/**
 * O ponto onde o dinheiro vira pedido — e a única superfície do sistema sem
 * sessão (RN8, RN10). Duas regras não se dobram aqui:
 *
 * 1. **O corpo da notificação nunca é fonte de valor** (RN10). A assinatura
 *    prova a origem, não o conteúdo; o status e o valor vêm SEMPRE da consulta à
 *    API do Mercado Pago, e o valor é conferido contra o total do pedido.
 * 2. **Dinheiro que entrou não é recusado** (RN11). Aprovação num dia que deixou
 *    de ser viável confirma o pedido com o veredito gravado — realocar é decisão
 *    humana, não do webhook.
 */

/** Resposta HTTP que o webhook deve devolver. 5xx é deliberado: força reenvio. */
export type ResultadoWebhook = 200 | 401 | 500;

/**
 * Processa a notificação do webhook. Verifica a assinatura, consulta o pagamento
 * na fonte e aplica o resultado. Deduplicação e idempotência vivem no
 * `confirmar_pagamento` (índice único + `for update`); aqui a consulta vem
 * primeiro de propósito, porque um estorno reusa o id do pagamento aprovado e
 * um dedup cego pelo id trataria o estorno como repetição.
 */
export async function processarNotificacao(dados: {
  dataId: string;
  xSignature: string | null;
  xRequestId: string | null;
  corpo: unknown;
}): Promise<ResultadoWebhook> {
  const porta = portaPagamento();

  if (
    !porta.verificarAssinatura({
      dataId: dados.dataId,
      xSignature: dados.xSignature,
      xRequestId: dados.xRequestId,
    })
  ) {
    // Registra a recusa para o alerta (RN10/T25). Superfície pública: é um risco
    // conhecido de escrita por requisição não autenticada, aceito na spec (§8).
    await registrarEventoPagamento({
      pedidoId: null,
      mpPaymentId: dados.dataId,
      resultado: 'assinatura_invalida',
      corpo: dados.corpo,
    });
    return 401;
  }

  try {
    const pagamento = await porta.consultarPagamento(dados.dataId);
    const numero = Number(pagamento.numeroPedido);

    if (!Number.isInteger(numero)) {
      await registrarEventoPagamento({
        pedidoId: null,
        mpPaymentId: pagamento.id,
        resultado: 'pedido_desconhecido',
        corpo: dados.corpo,
      });
      return 200;
    }

    await aplicarPagamento(numero, pagamento, dados.corpo);
    return 200;
  } catch {
    // Erro nosso (consulta ou RPC): 5xx para o Mercado Pago reenviar (T30).
    // Devolver 200 aqui transformaria falha temporária em pedido pago que nunca
    // confirma.
    return 500;
  }
}

/**
 * Recuperação pela tela de retorno (RN19, T38): webhook pode ter se perdido, mas
 * o cliente voltou com o id do pagamento na URL. Consulta a fonte e confirma na
 * hora. O número vem da rota (dono já conferido antes), não da consulta.
 */
export async function confirmarPeloRetorno(numero: number, paymentId: string): Promise<void> {
  const pagamento = await portaPagamento().consultarPagamento(paymentId);
  await aplicarPagamento(numero, pagamento, null);
}

async function aplicarPagamento(
  numero: number,
  pagamento: PagamentoConsultado,
  corpo: unknown,
): Promise<void> {
  const pedido = await lerPedidoParaConfirmacao(numero);

  if (!pedido) {
    await registrarEventoPagamento({
      pedidoId: null,
      mpPaymentId: pagamento.id,
      resultado: 'pedido_desconhecido',
      corpo,
    });
    return;
  }

  if (pagamento.status === 'estornado') {
    await aplicarEstorno(pedido, pagamento, corpo);
    return;
  }

  if (pagamento.status !== 'aprovado') {
    // Recusado ou pendente: não confirma (T27). O pedido segue aguardando, com a
    // reserva viva até o prazo — o cliente pode tentar de novo.
    if (pedido.status === 'pago') return;
    await registrarEventoPagamento({
      pedidoId: pedido.id,
      mpPaymentId: pagamento.id,
      resultado: 'pagamento_nao_aprovado',
      detalhe: `status ${pagamento.status}`,
      corpo,
    });
    return;
  }

  // Aprovado, mas já confirmado: notificação repetida não reprocessa nem escreve
  // (RN9, T7/T30).
  if (pedido.status === 'pago') return;

  if (pagamento.valorCentavos !== pedido.totalCentavos) {
    // Valor divergente não confirma; registra e alerta (RN10, T26). O corpo
    // podia declarar aprovado — não importa, a fonte é a consulta.
    await registrarEventoPagamento({
      pedidoId: pedido.id,
      mpPaymentId: pagamento.id,
      resultado: 'valor_divergente',
      detalhe: `pago ${pagamento.valorCentavos}, total ${pedido.totalCentavos}`,
      corpo,
    });
    return;
  }

  const veredito = await calcularVeredito(pedido);
  const confirmado = await confirmarPagamentoRpc(
    pedido.id,
    pagamento.id,
    pagamento.formaPagamento,
    veredito,
  );

  // `false` = corrida idempotente (outra notificação chegou primeiro): não
  // escreve nada, exatamente como T30 exige da duplicata.
  if (confirmado) {
    await registrarEventoPagamento({
      pedidoId: pedido.id,
      mpPaymentId: pagamento.id,
      resultado: 'confirmado',
      detalhe: veredito === 'viavel' ? undefined : `veredito ${veredito}`,
      corpo,
    });
  }
}

async function aplicarEstorno(
  pedido: PedidoParaConfirmacao,
  pagamento: PagamentoConsultado,
  corpo: unknown,
): Promise<void> {
  // Só reflete o estorno de um pedido que estava pago; estorno de algo já
  // terminal é ruído do Mercado Pago e a RPC devolve false sem reprocessar.
  const devolucao = await calcularDevolucao(pedido);
  const estornado = await estornarPedidoRpc(pedido.id, devolucao);

  if (estornado) {
    await registrarEventoPagamento({
      pedidoId: pedido.id,
      mpPaymentId: pagamento.id,
      resultado: 'confirmado',
      detalhe: `estorno, devolução ${devolucao}`,
      corpo,
    });
  }
}

/**
 * Veredito da viabilidade no instante da confirmação (RN11). Avalia item a item
 * e devolve o pior caso: se a reserva expirou e o dia encheu, o pedido nasce
 * pago com `sem_vaga` e sobe alerta — nunca é recusado.
 */
async function calcularVeredito(pedido: PedidoParaConfirmacao): Promise<Veredito> {
  const snapshot = await carregarSnapshotDoPedido(pedido);

  let pior: Veredito = 'viavel';
  for (const item of pedido.itens) {
    const v = avaliarViabilidade(pedido.diaEntrega, item.produtoId, item.quantidade, snapshot);
    if (v === 'cutoff_vencido') return 'cutoff_vencido';
    if (v === 'sem_vaga') pior = 'sem_vaga';
  }
  return pior;
}

/** Capacidade (antes do cutoff) ou lote (depois) devolvidos pelo estorno (RN14). */
async function calcularDevolucao(pedido: PedidoParaConfirmacao): Promise<Devolucao> {
  const snapshot = await carregarSnapshotDoPedido(pedido);
  return devolucaoPorCancelamento(pedido.diaEntrega, snapshot);
}

async function carregarSnapshotDoPedido(pedido: PedidoParaConfirmacao) {
  const catalogo = await lerCatalogo();
  const ehMassa = new Map(catalogo.produtos.map((p) => [p.produto.id, p.categoria.ehMassa]));
  return carregarSnapshot(
    pedido.itens.map((i) => ({ id: i.produtoId, ehMassa: ehMassa.get(i.produtoId) ?? false })),
  );
}
