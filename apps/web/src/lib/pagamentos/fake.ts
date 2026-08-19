import type {
  CobrancaCriada,
  CriarCobrancaInput,
  PagamentoConsultado,
  PortaPagamento,
} from './porta';

/**
 * Adaptador de desenvolvimento (design §5, decisão 7). Sem túnel público não há
 * webhook em `localhost`, então o "pagamento" se resolve pelo redirecionamento
 * de retorno: a URL carrega o id `fake-<centavos>`, e a consulta decodifica o
 * mesmo número de volta — o valor precisa fechar para o teste de valor valer.
 *
 * Não é brecha: só é escolhido quando `PAGAMENTO_PROVIDER=fake`; produção exige
 * `mercado_pago`.
 */
export class PortaFake implements PortaPagamento {
  async criarCobranca(input: CriarCobrancaInput): Promise<CobrancaCriada> {
    const url = new URL(input.urlRetorno);
    // O id carrega o valor (para o teste da RN10) E o número do pedido, para ser
    // ÚNICO: dois pedidos de mesmo total não podem colidir no índice de
    // idempotência (`mp_payment_id`). `parseInt` para no primeiro hífen, então a
    // decodificação do valor em `consultarPagamento` continua valendo.
    url.searchParams.set('payment_id', `fake-${input.totalCentavos}-${input.numeroPedido}`);
    url.searchParams.set('status', 'approved');

    return {
      preferenceId: `fake-pref-${input.numeroPedido}`,
      urlPagamento: url.toString(),
    };
  }

  async consultarPagamento(id: string): Promise<PagamentoConsultado> {
    const centavos = Number.parseInt(id.replace(/^fake-/, ''), 10);
    return {
      id,
      status: 'aprovado',
      valorCentavos: Number.isNaN(centavos) ? 0 : centavos,
      // Sem webhook em localhost, quem confirma é a tela de retorno, que já traz
      // o número do pedido na URL — a referência não precisa vir daqui.
      numeroPedido: '',
      formaPagamento: 'pix',
    };
  }

  verificarAssinatura(): boolean {
    return true;
  }
}
