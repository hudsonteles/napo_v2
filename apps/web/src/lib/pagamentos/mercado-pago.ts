import { MercadoPagoConfig, Payment } from 'mercadopago';

import { type NotificacaoAssinada, verificarAssinaturaMercadoPago } from './assinatura';
import type {
  CobrancaCriada,
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

interface RespostaPagamento {
  id?: number | string;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  payment_method_id?: string;
  payment_type_id?: string;
  external_reference?: string;
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string };
  };
}

/**
 * O 404 do SDK chega como exceção com `status`. Distinguir "não conhece este
 * pagamento" de "o gateway caiu" é o que separa devolver `null` (contrato da
 * porta) de deixar o erro subir — e é exatamente o defeito que a RN14 conserta.
 */
function ehNaoEncontrado(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) return false;
  const status = (erro as { status?: unknown; statusCode?: unknown }).status ??
    (erro as { statusCode?: unknown }).statusCode;
  return status === 404;
}

export class PagamentoMercadoPago implements PortaPagamento {
  private readonly cliente: MercadoPagoConfig;

  constructor(private readonly credenciais: CredenciaisMercadoPago) {
    this.cliente = new MercadoPagoConfig({ accessToken: credenciais.accessToken });
  }

  async criarCobranca(entrada: EntradaCobranca): Promise<CobrancaCriada> {
    const pagamento: RespostaPagamento = await new Payment(this.cliente).create({
      body: {
        transaction_amount: entrada.valorCentavos / 100,
        description: entrada.descricao,
        payment_method_id: entrada.metodo,
        installments: entrada.parcelas,
        token: entrada.token,
        // O QR do Pix morre junto com a vaga (RN11): um relógio só.
        date_of_expiration: entrada.expiraEm,
        // Amarra a notificação à TENTATIVA, não ao pedido: duas tentativas do
        // mesmo pedido chegariam indistinguíveis se a referência fosse o pedido.
        external_reference: entrada.cobrancaId,
        payer: { email: entrada.emailPagador },
        metadata: { numero_pedido: entrada.numeroPedido },
      },
      // Obrigatória na API de pagamentos e é o que impede o duplo clique de
      // virar duas cobranças no gateway (RN10).
      requestOptions: { idempotencyKey: entrada.cobrancaId },
    });

    if (!pagamento?.id) {
      throw new Error('Mercado Pago devolveu pagamento sem id.');
    }

    const qr = pagamento.point_of_interaction?.transaction_data;

    return {
      idPagamento: String(pagamento.id),
      status: STATUS[pagamento.status ?? ''] ?? 'pendente',
      detalhe: pagamento.status_detail ?? null,
      pix: qr?.qr_code
        ? { codigo: qr.qr_code, imagemBase64: qr.qr_code_base64 ?? null }
        : null,
    };
  }

  async consultarPagamento(idPagamento: string): Promise<PagamentoConsultado | null> {
    try {
      const pagamento: RespostaPagamento = await new Payment(this.cliente).get({ id: idPagamento });
      return pagamento?.id ? this.traduzir(pagamento) : null;
    } catch (erro) {
      if (ehNaoEncontrado(erro)) return null;
      throw erro;
    }
  }

  async buscarPagamentoDaReferencia(
    referenciaExterna: string,
  ): Promise<PagamentoConsultado | null> {
    try {
      const resposta = await new Payment(this.cliente).search({
        options: { external_reference: referenciaExterna },
      });

      const encontrado = resposta?.results?.[0] as RespostaPagamento | undefined;
      return encontrado?.id ? this.traduzir(encontrado) : null;
    } catch (erro) {
      if (ehNaoEncontrado(erro)) return null;
      throw erro;
    }
  }

  private traduzir(pagamento: RespostaPagamento): PagamentoConsultado {
    return {
      id: String(pagamento.id),
      status: STATUS[pagamento.status ?? ''] ?? 'pendente',
      // Reais com casa decimal não sobrevivem a comparação de igualdade; a
      // conferência da RN17 acontece em centavos.
      valorCentavos: Math.round((pagamento.transaction_amount ?? 0) * 100),
      forma: pagamento.payment_method_id ?? pagamento.payment_type_id ?? 'desconhecida',
      detalhe: pagamento.status_detail ?? null,
      referenciaExterna: pagamento.external_reference ?? null,
    };
  }

  verificarAssinatura(notificacao: NotificacaoAssinada): boolean {
    return verificarAssinaturaMercadoPago(notificacao, this.credenciais.webhookSecret);
  }
}
