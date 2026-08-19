import 'server-only';

import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

import { verificarAssinaturaMercadoPago } from './assinatura';
import type {
  CobrancaCriada,
  CriarCobrancaInput,
  DadosAssinatura,
  PagamentoConsultado,
  PortaPagamento,
  StatusPagamento,
} from './porta';

interface ConfigMercadoPago {
  accessToken: string;
  webhookSecret: string;
}

/**
 * Adaptador real do Checkout Pro. Toda a integração é servidor: criação de
 * preferência (redireciona o cliente) e consulta de pagamento (fonte de valor no
 * webhook, RN10). O SDK oficial isola o formato do manifesto de notificação, que
 * muda do lado deles — errar isso é confirmar pedido não pago (design §6.1).
 */
export class PortaMercadoPago implements PortaPagamento {
  private readonly client: MercadoPagoConfig;
  private readonly webhookSecret: string;

  constructor({ accessToken, webhookSecret }: ConfigMercadoPago) {
    this.client = new MercadoPagoConfig({ accessToken });
    this.webhookSecret = webhookSecret;
  }

  async criarCobranca(input: CriarCobrancaInput): Promise<CobrancaCriada> {
    const preferencia = await new Preference(this.client).create({
      body: {
        external_reference: input.numeroPedido,
        notification_url: input.urlWebhook,
        back_urls: {
          success: input.urlRetorno,
          failure: input.urlRetorno,
          pending: input.urlRetorno,
        },
        auto_return: 'approved',
        items: [
          {
            id: input.numeroPedido,
            title: input.descricao,
            quantity: 1,
            // A API fala reais; o resto do sistema fala centavos.
            unit_price: input.totalCentavos / 100,
            currency_id: 'BRL',
          },
        ],
      },
    });

    if (!preferencia.id || !preferencia.init_point) {
      throw new Error('Mercado Pago não devolveu uma preferência utilizável.');
    }

    return { preferenceId: preferencia.id, urlPagamento: preferencia.init_point };
  }

  async consultarPagamento(id: string): Promise<PagamentoConsultado> {
    const pagamento = await new Payment(this.client).get({ id });

    return {
      id: String(pagamento.id ?? id),
      status: traduzirStatus(pagamento.status),
      valorCentavos: Math.round((pagamento.transaction_amount ?? 0) * 100),
    };
  }

  verificarAssinatura(dados: DadosAssinatura): boolean {
    return verificarAssinaturaMercadoPago({ ...dados, segredo: this.webhookSecret });
  }
}

function traduzirStatus(status: string | undefined): StatusPagamento {
  if (status === 'approved') return 'aprovado';
  if (status === 'rejected' || status === 'cancelled') return 'recusado';
  return 'pendente';
}
