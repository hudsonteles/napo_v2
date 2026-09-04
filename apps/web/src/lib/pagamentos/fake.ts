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
export class PagamentoFake implements PortaPagamento {
  /**
   * O valor cobrado fica em memória do processo porque a confirmação compara o
   * valor pago com o total do pedido (RN10) — um adaptador que devolvesse
   * qualquer número faria o caminho de divergência ser o único exercitável.
   */
  private readonly cobrancas = new Map<string, { valorCentavos: number; referencia: string }>();

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

  /**
   * Não há segredo para assinar em desenvolvimento. Quem impede isso de valer em
   * produção é `PAGAMENTO_PROVIDER`, validado no boot.
   */
  verificarAssinatura(): boolean {
    return true;
  }
}
