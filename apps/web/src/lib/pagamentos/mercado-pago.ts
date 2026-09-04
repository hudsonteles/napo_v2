import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

import { type NotificacaoAssinada, verificarAssinaturaMercadoPago } from './assinatura';
import type {
  Cobranca,
  EntradaCobranca,
  PagamentoConsultado,
  PortaPagamento,
  StatusPagamento,
} from './porta';

/**
 * Vocabulário deles → o nosso. O que não estiver mapeado vira `pendente` de
 * propósito: status novo do gateway não pode confirmar pedido por omissão.
 */
const STATUS: Record<string, StatusPagamento> = {
  approved: 'aprovado',
  pending: 'pendente',
  in_process: 'pendente',
  in_mediation: 'pendente',
  authorized: 'pendente',
  rejected: 'recusado',
  cancelled: 'recusado',
  refunded: 'estornado',
  charged_back: 'estornado',
};

export interface CredenciaisMercadoPago {
  accessToken: string;
  webhookSecret: string;
}

export class PagamentoMercadoPago implements PortaPagamento {
  private readonly cliente: MercadoPagoConfig;

  constructor(private readonly credenciais: CredenciaisMercadoPago) {
    this.cliente = new MercadoPagoConfig({ accessToken: credenciais.accessToken });
  }

  async criarCobranca(entrada: EntradaCobranca): Promise<Cobranca> {
    const preferencia = await new Preference(this.cliente).create({
      body: {
        // `external_reference` é o que amarra a notificação ao pedido: sem ele,
        // a confirmação teria de adivinhar de quem é o dinheiro.
        external_reference: entrada.referenciaExterna,
        items: entrada.itens.map((item, indice) => ({
          id: `${entrada.referenciaExterna}-${indice}`,
          title: item.titulo,
          quantity: item.quantidade,
          unit_price: item.precoUnitarioCentavos / 100,
          currency_id: 'BRL',
        })),
        shipments: { cost: entrada.freteCentavos / 100, mode: 'not_specified' },
        back_urls: { success: entrada.urlRetorno, pending: entrada.urlRetorno, failure: entrada.urlRetorno },
        metadata: { numero_pedido: entrada.numeroPedido },
      },
    });

    if (!preferencia.id || !preferencia.init_point) {
      throw new Error('Mercado Pago devolveu preferência sem id ou sem URL de pagamento.');
    }

    return { preferenciaId: preferencia.id, urlPagamento: preferencia.init_point };
  }

  async consultarPagamento(idPagamento: string): Promise<PagamentoConsultado | null> {
    const pagamento = await new Payment(this.cliente).get({ id: idPagamento });
    if (!pagamento?.id) return null;

    return {
      id: String(pagamento.id),
      status: STATUS[pagamento.status ?? ''] ?? 'pendente',
      // Reais com casa decimal não sobrevivem a comparação de igualdade; a
      // conferência da RN10 acontece em centavos.
      valorCentavos: Math.round((pagamento.transaction_amount ?? 0) * 100),
      forma: pagamento.payment_method_id ?? pagamento.payment_type_id ?? 'desconhecida',
      referenciaExterna: pagamento.external_reference ?? null,
    };
  }

  verificarAssinatura(notificacao: NotificacaoAssinada): boolean {
    return verificarAssinaturaMercadoPago(notificacao, this.credenciais.webhookSecret);
  }
}
