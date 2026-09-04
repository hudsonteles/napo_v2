import 'server-only';

import { getPagamentoEnv } from '@/lib/env';

import type { NotificacaoAssinada } from './assinatura';
import { PagamentoFake } from './fake';
import { PagamentoMercadoPago } from './mercado-pago';

/**
 * O gateway atrás de uma interface de três métodos (design §5 decisão 6).
 *
 * A decisão Mercado Pago × Stripe já foi reaberta uma vez. Com a porta, trocar
 * é escrever um adaptador; sem ela, é reescrever o checkout.
 */

/** Como o pagamento está, traduzido do vocabulário do gateway. */
export type StatusPagamento = 'aprovado' | 'pendente' | 'recusado' | 'estornado';

export interface ItemCobranca {
  titulo: string;
  quantidade: number;
  precoUnitarioCentavos: number;
}

export interface EntradaCobranca {
  /** Id do pedido. Volta na consulta e é o que amarra pagamento a pedido. */
  referenciaExterna: string;
  /** Número exibido ao cliente (`#1042`). */
  numeroPedido: number;
  itens: ItemCobranca[];
  freteCentavos: number;
  /** Para onde o gateway devolve o cliente depois de pagar. */
  urlRetorno: string;
}

export interface Cobranca {
  preferenciaId: string;
  urlPagamento: string;
}

export interface PagamentoConsultado {
  id: string;
  status: StatusPagamento;
  /** Sempre em centavos: real com casa decimal não sobrevive a comparação. */
  valorCentavos: number;
  /** Como o gateway nomeia a forma (`pix`, `credit_card`, `debit_card`). */
  forma: string;
  referenciaExterna: string | null;
}

export interface PortaPagamento {
  criarCobranca(entrada: EntradaCobranca): Promise<Cobranca>;
  /** `null` quando o gateway não conhece o pagamento. */
  consultarPagamento(idPagamento: string): Promise<PagamentoConsultado | null>;
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
