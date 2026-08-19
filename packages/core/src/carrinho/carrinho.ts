/**
 * As regras do carrinho (RN1, RN3, RN18).
 *
 * O cliente manda produto e quantidade; tudo que vale dinheiro é decidido aqui,
 * com os números que o servidor leu do banco. É a função que desautoriza o
 * total vindo do navegador.
 */

import type {
  CarrinhoAjustado,
  DivergenciaPreco,
  EntradaTotais,
  ItemCarrinho,
  ItemPrecificado,
  PrecoConhecido,
  Totais,
} from './tipos';

/**
 * Funde linhas do mesmo produto e descarta quantidade que não existe.
 *
 * Fracionária cai junto com zero e negativa: não há meia pizza, e aceitar 1.5
 * faria a reserva pedir uma vaga que o forno não sabe produzir.
 */
export function normalizarItens(itens: ItemCarrinho[]): ItemCarrinho[] {
  const somados = new Map<string, number>();

  for (const { produtoId, quantidade } of itens) {
    if (!Number.isInteger(quantidade) || quantidade <= 0) continue;
    somados.set(produtoId, (somados.get(produtoId) ?? 0) + quantidade);
  }

  return [...somados].map(([produtoId, quantidade]) => ({ produtoId, quantidade }));
}

export function calcularSubtotal(itens: ItemPrecificado[]): number {
  return itens.reduce((total, i) => total + i.precoUnitarioCentavos * i.quantidade, 0);
}

/**
 * Limita cada item ao que a fornada comporta e relata o que mudou.
 *
 * Reduzir calado é pior que recusar: o cliente pagaria por três e receberia
 * duas sem ter escolhido. Por isso todo ajuste bloqueia o avanço até a
 * confirmação (spec §4).
 */
export function aplicarTetos(itens: ItemPrecificado[]): CarrinhoAjustado {
  const ajustes: CarrinhoAjustado['ajustes'] = [];
  const dentroDoTeto: ItemPrecificado[] = [];

  for (const item of itens) {
    if (item.disponivel <= 0) {
      ajustes.push({ produtoId: item.produtoId, tipo: 'esgotado' });
      continue;
    }

    if (item.quantidade > item.disponivel) {
      ajustes.push({
        produtoId: item.produtoId,
        tipo: 'reduzido',
        de: item.quantidade,
        para: item.disponivel,
      });
      dentroDoTeto.push({ ...item, quantidade: item.disponivel });
      continue;
    }

    dentroDoTeto.push(item);
  }

  return { itens: dentroDoTeto, ajustes, bloqueado: ajustes.length > 0 };
}

/**
 * Compara o preço que o cliente viu com o que vale agora (RN3).
 *
 * Queda também é divergência: o cliente confirma para baixo igual, e o pedido
 * precisa registrar que o valor mudou entre a vitrine e a cobrança.
 */
export function conferirPrecos(
  conhecidos: PrecoConhecido[],
  atuais: ItemPrecificado[],
): DivergenciaPreco[] {
  const porProduto = new Map(conhecidos.map((p) => [p.produtoId, p.precoUnitarioCentavos]));

  return atuais.flatMap((item) => {
    const antes = porProduto.get(item.produtoId);
    if (antes === undefined || antes === item.precoUnitarioCentavos) return [];
    return [
      { produtoId: item.produtoId, deCentavos: antes, paraCentavos: item.precoUnitarioCentavos },
    ];
  });
}

export function montarTotais({ itens, freteCentavos, freteGratisCentavos }: EntradaTotais): Totais {
  const subtotalCentavos = calcularSubtotal(itens);
  const faltam = freteGratisCentavos - subtotalCentavos;

  return {
    subtotalCentavos,
    freteCentavos,
    totalCentavos: freteCentavos === null ? null : subtotalCentavos + freteCentavos,
    faltamParaFreteGratisCentavos: faltam > 0 ? faltam : null,
  };
}
