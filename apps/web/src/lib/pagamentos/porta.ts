import 'server-only';

import { getPagamentoEnv } from '@/lib/env';

import type { NotificacaoAssinada } from './assinatura';
import { PagamentoFake } from './fake';
import { PagamentoMercadoPago } from './mercado-pago';

/**
 * O gateway atrás de uma interface de quatro métodos.
 *
 * A troca de Checkout Pro por Checkout Bricks (ADR-0001) é a prova de que a
 * porta valeu: o sentido do fluxo inverteu — antes o servidor criava uma
 * preferência e mandava o cliente embora, agora o navegador tokeniza e o
 * servidor cria o pagamento — e o que mudou foi um adaptador.
 */

/** Como o pagamento está, traduzido do vocabulário do gateway. */
export type StatusPagamento = 'aprovado' | 'pendente' | 'recusado' | 'estornado';

export interface EntradaCobranca {
  /**
   * Id da cobrança no nosso banco. Viaja como referência externa **e** como
   * chave de idempotência: repetir a chamada não cria um segundo pagamento
   * (RN10). A referência é da cobrança, não do pedido, porque a notificação
   * precisa dizer qual *tentativa* foi paga.
   */
  cobrancaId: string;
  numeroPedido: number;
  valorCentavos: number;
  /** Descrição que aparece na fatura do cliente. */
  descricao: string;
  /** Token do cartão gerado pelo SDK no navegador. Ausente no Pix. */
  token?: string;
  /** `payment_method_id` do Mercado Pago (`pix`, `master`, `visa`, …). */
  metodo: string;
  parcelas: number;
  emailPagador: string;
  /** Instante em que a cobrança morre — o mesmo da reserva do pedido (RN11). */
  expiraEm: string;
}

export interface DadosPix {
  /** Copia-e-cola. */
  codigo: string;
  /** PNG em base64, para a nossa tela desenhar sem pedir imagem a terceiro. */
  imagemBase64: string | null;
}

export interface CobrancaCriada {
  idPagamento: string;
  status: StatusPagamento;
  /**
   * `status_detail` cru do gateway. Vai para a cobrança, para auditoria e
   * conciliação — **nunca** para a tela (RN13).
   */
  detalhe: string | null;
  /** Presente quando o meio escolhido foi Pix. */
  pix: DadosPix | null;
}

export interface PagamentoConsultado {
  id: string;
  status: StatusPagamento;
  /** Sempre em centavos: real com casa decimal não sobrevive a comparação. */
  valorCentavos: number;
  /** Como o gateway nomeia a forma (`pix`, `credit_card`, `debit_card`). */
  forma: string;
  detalhe: string | null;
  referenciaExterna: string | null;
}

export interface PortaPagamento {
  /** Cria o pagamento no gateway a partir do que o Brick coletou. */
  criarCobranca(entrada: EntradaCobranca): Promise<CobrancaCriada>;
  /**
   * `null` quando o gateway não conhece o pagamento — **nunca exceção** (RN14).
   * Notificação que chega antes de o pagamento ficar consultável é corrida real
   * em produção: quem quebra esse contrato faz o rastro de auditoria sumir.
   */
  consultarPagamento(idPagamento: string): Promise<PagamentoConsultado | null>;
  /**
   * O pagamento de uma cobrança, procurado pela referência externa. É o caminho
   * da RN19: quando a notificação nunca chega, o id do pagamento não existe do
   * nosso lado — só o da cobrança.
   */
  buscarPagamentoDaReferencia(referenciaExterna: string): Promise<PagamentoConsultado | null>;
  verificarAssinatura(notificacao: NotificacaoAssinada): boolean;
}

/**
 * O adaptador falso guarda em memória o que cobrou, então precisa ser o mesmo
 * objeto entre a criação da cobrança e a consulta. Uma instância por chamada
 * faria todo pagamento local ser "não encontrado".
 */
let porta: PortaPagamento | null = null;

export function portaDePagamento(): PortaPagamento {
  if (porta) return porta;

  const env = getPagamentoEnv();

  porta =
    env.PAGAMENTO_PROVIDER === 'mercado_pago'
      ? new PagamentoMercadoPago({
          accessToken: env.MP_ACCESS_TOKEN as string,
          webhookSecret: env.MP_WEBHOOK_SECRET as string,
        })
      : new PagamentoFake();

  return porta;
}
