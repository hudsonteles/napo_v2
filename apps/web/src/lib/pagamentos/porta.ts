import 'server-only';

import { getPagamentoEnv } from '@/lib/env';

import { PortaFake } from './fake';
import { PortaMercadoPago } from './mercado-pago';

/**
 * O gateway atrás de uma interface de três métodos. A decisão Mercado Pago ×
 * Stripe já foi reaberta uma vez (design §5, decisão 6): com a porta, trocar é
 * escrever um adaptador; sem ela, é reescrever o checkout. Nada acima daqui sabe
 * qual provedor respondeu.
 */

export type StatusPagamento = 'aprovado' | 'recusado' | 'pendente';

export interface CriarCobrancaInput {
  numeroPedido: string;
  descricao: string;
  totalCentavos: number;
  urlRetorno: string;
  urlWebhook: string;
}

export interface CobrancaCriada {
  preferenceId: string;
  urlPagamento: string;
}

export interface PagamentoConsultado {
  id: string;
  status: StatusPagamento;
  valorCentavos: number;
}

export interface DadosAssinatura {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
}

export interface PortaPagamento {
  criarCobranca(input: CriarCobrancaInput): Promise<CobrancaCriada>;
  consultarPagamento(id: string): Promise<PagamentoConsultado>;
  verificarAssinatura(dados: DadosAssinatura): boolean;
}

export function portaPagamento(): PortaPagamento {
  const env = getPagamentoEnv();

  if (env.PAGAMENTO_PROVIDER === 'mercado_pago') {
    return new PortaMercadoPago({
      accessToken: env.MP_ACCESS_TOKEN as string,
      webhookSecret: env.MP_WEBHOOK_SECRET as string,
    });
  }

  return new PortaFake();
}
