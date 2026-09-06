import type {
  CobrancaCriada,
  EntradaCobranca,
  PagamentoConsultado,
  PortaPagamento,
} from './porta';

/**
 * Adaptador de desenvolvimento.
 *
 * O webhook não funciona em `localhost` (`ARCHITECTURE.md` §6.1): sem este
 * adaptador, nenhum teste do fluxo roda sem túnel. Ambiente troca por variável,
 * nunca por edição de código. A RN20 exige o gateway real **uma vez, na
 * validação** — não a cada `pnpm dev`.
 *
 * O desfecho é escolhido pelo método, para o painel de simulação da tela poder
 * exercitar recusa e pendência sem credencial: `metodo` começando por `recusar`
 * recusa, por `pendente` fica pendente, qualquer outro aprova.
 */
interface CobrancaFalsa {
  valorCentavos: number;
  referencia: string;
  status: CobrancaCriada['status'];
  detalhe: string | null;
  metodo: string;
}

/**
 * O registro vive em `globalThis`, não no módulo.
 *
 * Cada Route Handler do Next é compilado no seu próprio bundle: a instância que
 * `POST /api/pagamentos` criou **não** é a mesma que `GET /api/pedidos/[numero]`
 * enxerga, e a cobrança gravada em memória de módulo some entre uma rota e
 * outra — o pedido ficava eternamente "confirmando". `globalThis` é do
 * processo, e o processo é o mesmo.
 */
const registro: Map<string, CobrancaFalsa> = ((
  globalThis as { __napoCobrancasFalsas?: Map<string, CobrancaFalsa> }
).__napoCobrancasFalsas ??= new Map());

function desfecho(metodo: string): { status: CobrancaCriada['status']; detalhe: string | null } {
  if (metodo.startsWith('recusar')) {
    // Um detalhe real do vocabulário do Mercado Pago, para o caminho de
    // tradução da RN13 ser exercitado de verdade em desenvolvimento.
    return { status: 'recusado', detalhe: 'cc_rejected_insufficient_amount' };
  }
  if (metodo.startsWith('pendente')) return { status: 'pendente', detalhe: 'pending_waiting_payment' };
  return { status: 'aprovado', detalhe: 'accredited' };
}

export class PagamentoFake implements PortaPagamento {
  /**
   * O valor cobrado é guardado porque a confirmação compara o valor pago com o
   * total do pedido (RN17) — um adaptador que devolvesse qualquer número faria
   * o caminho de divergência ser o único exercitável.
   */
  private readonly cobrancas = registro;

  async criarCobranca(entrada: EntradaCobranca): Promise<CobrancaCriada> {
    const idPagamento = `fake-pag-${entrada.cobrancaId}`;
    const { status, detalhe } = desfecho(entrada.metodo);

    this.cobrancas.set(idPagamento, {
      valorCentavos: entrada.valorCentavos,
      referencia: entrada.cobrancaId,
      status,
      detalhe,
      metodo: entrada.metodo,
    });

    return {
      idPagamento,
      status,
      detalhe,
      pix:
        entrada.metodo === 'pix'
          ? { codigo: `00020126fake-${entrada.cobrancaId}5204000053039865802BR`, imagemBase64: null }
          : null,
    };
  }

  async consultarPagamento(idPagamento: string): Promise<PagamentoConsultado | null> {
    const cobranca = this.cobrancas.get(idPagamento);
    if (!cobranca) return null;

    return {
      id: idPagamento,
      // O desfecho escolhido na criação é o que a consulta devolve. Traduzir
      // pendente para aprovado aqui faria o estado de espera — o caso do Pix
      // gerado e não pago — ser o único impossível de exercitar sem túnel.
      status: cobranca.status,
      valorCentavos: cobranca.valorCentavos,
      forma: cobranca.metodo,
      detalhe: cobranca.detalhe,
      referenciaExterna: cobranca.referencia,
    };
  }

  async buscarPagamentoDaReferencia(referenciaExterna: string): Promise<PagamentoConsultado | null> {
    const encontrado = [...this.cobrancas.entries()].find(
      ([, cobranca]) => cobranca.referencia === referenciaExterna,
    );

    return encontrado ? this.consultarPagamento(encontrado[0]) : null;
  }

  /**
   * Não há segredo para assinar em desenvolvimento. Quem impede isso de valer em
   * produção é `PAGAMENTO_PROVIDER`, validado no boot.
   */
  verificarAssinatura(): boolean {
    return true;
  }
}
