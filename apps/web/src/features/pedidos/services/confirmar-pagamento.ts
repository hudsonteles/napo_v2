import 'server-only';

import type { Devolucao, Veredito } from '@napo/core';

import type { PagamentoConsultado, PortaPagamento } from '@/lib/pagamentos/porta';

import type { CobrancaLida, RepositorioDeCobrancas } from './cobrancas-repo';
import type { EventoDePagamento, PedidoLido, RepositorioDePedidos } from './pedidos-repo';

/**
 * O ponto onde o dinheiro vira pedido (RN6, RN15, RN16, RN17, RN18).
 *
 * Nada aqui confia no corpo da notificação além do id: o status e o valor vêm
 * de consulta ao gateway, e o valor é conferido contra o total do pedido. Uma
 * notificação forjada com valor alto não confirma nada.
 *
 * O que mudou no NAPO-025: a referência externa é da **cobrança**, não do
 * pedido. A notificação diz qual tentativa foi paga — com a referência
 * apontando para o pedido, duas tentativas chegariam indistinguíveis.
 */

export interface DependenciasDaConfirmacao {
  pagamento: PortaPagamento;
  repo: RepositorioDePedidos;
  cobrancas: RepositorioDeCobrancas;
  /**
   * O veredito da RN18, decidido em `packages/core` e passado pronto ao banco.
   * Chega injetado porque depende do motor de disponibilidade, que é outra
   * feature (ARCHITECTURE §3.2).
   */
  veredito(pedido: PedidoLido): Promise<Veredito>;
  /** O que volta ao motor num estorno: vaga de forno antes do cutoff, lote depois (RN19). */
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

  const cobranca = await deps.cobrancas.ler(pagamento.referenciaExterna);
  const pedido = cobranca ? await deps.repo.lerPedido(cobranca.pedidoId) : null;

  if (!cobranca || !pedido) {
    await deps.repo.registrarEvento({
      pedidoId: null,
      mpPaymentId: pagamento.id,
      resultado: 'pedido_desconhecido',
      detalhe: pagamento.referenciaExterna,
      corpo,
    });
    // 200: reenviar não faz a cobrança existir.
    return { http: 200, resultado: 'pedido_desconhecido' };
  }

  return aplicarPagamento(pedido, cobranca, pagamento, deps, corpo);
}

/**
 * Caminho da RN19: a notificação nunca chegou, e quem pergunta é a tela do
 * pedido ou a varredura. O pagamento é procurado pela referência da cobrança,
 * porque do nosso lado só existe o id dela.
 */
export async function reconciliarPedido(
  pedido: PedidoLido,
  deps: DependenciasDaConfirmacao,
): Promise<RespostaDaConfirmacao> {
  const cobranca = await deps.cobrancas.pendenteDoPedido(pedido.id);
  if (!cobranca) return { http: 200, resultado: 'pagamento_nao_aprovado' };

  const pagamento = await deps.pagamento.buscarPagamentoDaReferencia(cobranca.id);
  if (!pagamento) return { http: 200, resultado: 'pagamento_nao_aprovado' };

  return aplicarPagamento(pedido, cobranca, pagamento, deps);
}

async function aplicarPagamento(
  pedido: PedidoLido,
  cobranca: CobrancaLida,
  pagamento: PagamentoConsultado,
  deps: DependenciasDaConfirmacao,
  corpo?: unknown,
): Promise<RespostaDaConfirmacao> {
  if (pagamento.status === 'estornado') return estornar(pedido, cobranca, pagamento, deps, corpo);

  if (cobranca.situacao === 'aprovada') {
    // A cobrança já está resolvida: registra a passagem e não toca em nada. É a
    // idempotência da RN16 pelo caminho limpo — o índice único é a garantia dura.
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

  // Dinheiro que entrou nunca é recusado (RN18): dia inviável nasce pago, com o
  // veredito gravado e alerta para o admin resolver com uma ligação.
  const veredito = await deps.veredito(pedido);

  const confirmou = await deps.repo.confirmarPagamento({
    cobrancaId: cobranca.id,
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
  cobranca: CobrancaLida,
  pagamento: PagamentoConsultado,
  deps: DependenciasDaConfirmacao,
  corpo?: unknown,
): Promise<RespostaDaConfirmacao> {
  if (cobranca.situacao === 'estornada') {
    await deps.repo.registrarEvento({
      pedidoId: pedido.id,
      mpPaymentId: pagamento.id,
      resultado: 'duplicado',
      corpo,
    });
    return { http: 200, resultado: 'duplicado' };
  }

  const devolucao = await deps.devolucao(pedido);

  await deps.cobrancas.mudarSituacao({ cobrancaId: cobranca.id, situacao: 'estornada' });
  // No eixo de entrega, estorno é encerramento: o pedido some da fornada e a
  // vaga volta (RN3, RN19).
  await deps.repo.cancelarPedido(pedido.id, devolucao);

  // O que volta é vaga de forno ou lote pronto, e quem recoloca o lote em
  // estoque é o NAPO-008 (RN19). Aqui fica o registro de qual dos dois é.
  await deps.repo.registrarEvento({
    pedidoId: pedido.id,
    mpPaymentId: pagamento.id,
    resultado: 'confirmado',
    detalhe: `estorno: devolucao ${devolucao}`,
    corpo,
  });

  return { http: 200, resultado: 'confirmado' };
}
