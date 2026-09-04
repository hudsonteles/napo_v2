import type {
  Cobranca,
  EntradaCobranca,
  PagamentoConsultado,
  PortaPagamento,
} from './porta';

function totalDaCobranca({ itens, freteCentavos }: EntradaCobranca): number {
  return (
    itens.reduce((total, item) => total + item.precoUnitarioCentavos * item.quantidade, 0) +
    freteCentavos
  );
}

/**
 * Adaptador de desenvolvimento (design §5 decisão 7).
 *
 * O webhook não funciona em `localhost` (`ARCHITECTURE.md` §6.1): sem este
 * adaptador, nenhum teste do fluxo roda sem túnel. Ambiente troca por variável,
 * nunca por edição de código.
 */
interface CobrancaFalsa {
  valorCentavos: number;
  referencia: string;
}

/**
 * O registro vive em `globalThis`, não no módulo.
 *
 * Cada Route Handler do Next é compilado no seu próprio bundle: a instância que
 * `POST /api/pedidos` criou **não** é a mesma que `GET /api/pedidos/[numero]`
 * enxerga, e a cobrança gravada em memória de módulo some entre uma rota e
 * outra — o pedido ficava eternamente "confirmando". `globalThis` é do
 * processo, e o processo é o mesmo.
 */
const registro: Map<string, CobrancaFalsa> = ((
  globalThis as { __napoCobrancasFalsas?: Map<string, CobrancaFalsa> }
).__napoCobrancasFalsas ??= new Map());

export class PagamentoFake implements PortaPagamento {
  /**
   * O valor cobrado é guardado porque a confirmação compara o valor pago com o
   * total do pedido (RN10) — um adaptador que devolvesse qualquer número faria
   * o caminho de divergência ser o único exercitável.
   */
  private readonly cobrancas = registro;

  async criarCobranca(entrada: EntradaCobranca): Promise<Cobranca> {
    const preferenciaId = `fake-pref-${entrada.referenciaExterna}`;
    const idPagamento = `fake-pag-${entrada.referenciaExterna}`;

    this.cobrancas.set(idPagamento, {
      valorCentavos: totalDaCobranca(entrada),
      referencia: entrada.referenciaExterna,
    });

    const url = new URL(entrada.urlRetorno);
    url.searchParams.set('pagamento_falso', idPagamento);

    return { preferenciaId, urlPagamento: url.toString() };
  }

  async consultarPagamento(idPagamento: string): Promise<PagamentoConsultado | null> {
    const cobranca = this.cobrancas.get(idPagamento);
    if (!cobranca) return null;

    return {
      id: idPagamento,
      status: 'aprovado',
      valorCentavos: cobranca.valorCentavos,
      forma: 'pix',
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
