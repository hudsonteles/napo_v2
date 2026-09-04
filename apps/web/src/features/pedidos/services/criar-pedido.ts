import 'server-only';

import {
  aplicarTetos,
  conferirPrecos,
  montarTotais,
  normalizarItens,
  resolverDiaDoPedido,
  type CarrinhoAjustado,
  type DisponibilidadeDia,
  type DivergenciaPreco,
  type ItemPrecificado,
  type ResultadoFrete,
  type Snapshot,
} from '@napo/core';

import type { PortaPagamento } from '@/lib/pagamentos/porta';

import type { EntradaCriarPedido } from '../schema';
import type { RepositorioDePedidos } from './pedidos-repo';

/**
 * A ordem é a decisão (design §3.2): revalida → reserva → grava → cobra.
 *
 * A reserva vem antes da cobrança porque vaga vendida duas vezes é pior que
 * cobrança não criada (RN7); a preferência vem por último porque é o único
 * passo irreversível fora do nosso banco.
 *
 * As fontes chegam injetadas porque catálogo, disponibilidade e endereços são
 * outras features — feature não importa de feature (ARCHITECTURE §3.2). Quem
 * compõe é a rota, que pode.
 */

export interface PrecoDeProduto {
  produtoId: string;
  nome: string;
  precoUnitarioCentavos: number;
  ehMassa: boolean;
}

export interface EnderecoDoPedido {
  id: string;
  atendido: boolean;
  /** A linha inteira, copiada para o pedido (RN4). */
  snapshot: unknown;
}

export interface FontesDoPedido {
  precos(produtoIds: string[]): Promise<PrecoDeProduto[]>;
  disponibilidade(produtos: { id: string; ehMassa: boolean }[]): Promise<{
    dias: DisponibilidadeDia[];
    consumos: Snapshot['consumos'];
  }>;
  endereco(enderecoId: string): Promise<EnderecoDoPedido | null>;
  frete(enderecoId: string, subtotalCentavos: number): Promise<ResultadoFrete | null>;
}

export interface DependenciasDoPedido {
  fontes: FontesDoPedido;
  repo: RepositorioDePedidos;
  pagamento: PortaPagamento;
  /** Para onde o gateway devolve o cliente depois de pagar. */
  urlRetorno(numero: number): string;
}

export type FalhaDoPedido =
  | { motivo: 'produto_fora_do_catalogo'; status: 409; produtoIds: string[] }
  | { motivo: 'preco_mudou'; status: 409; divergencias: DivergenciaPreco[] }
  | { motivo: 'sem_vaga'; status: 409; ajustes?: CarrinhoAjustado['ajustes'] }
  | { motivo: 'endereco_desconhecido'; status: 404 }
  | { motivo: 'fora_de_area'; status: 422; detalhe: string | null }
  | { motivo: 'gateway_indisponivel'; status: 503 };

export interface PedidoCriado {
  pedidoId: string;
  numero: number;
  diaEntrega: string;
  totalCentavos: number;
  urlPagamento: string;
}

export type ResultadoCriacao =
  | { ok: true; pedido: PedidoCriado }
  | { ok: false; falha: FalhaDoPedido };

export async function criarPedido(
  entrada: EntradaCriarPedido,
  profileId: string,
  { fontes, repo, pagamento, urlRetorno }: DependenciasDoPedido,
): Promise<ResultadoCriacao> {
  const itens = normalizarItens(entrada.itens);
  const precos = await fontes.precos(itens.map((item) => item.produtoId));
  const precoPorProduto = new Map(precos.map((preco) => [preco.produtoId, preco]));

  const desconhecidos = itens
    .filter((item) => !precoPorProduto.has(item.produtoId))
    .map((item) => item.produtoId);

  if (desconhecidos.length > 0) {
    return falhar({ motivo: 'produto_fora_do_catalogo', status: 409, produtoIds: desconhecidos });
  }

  const { dias, consumos } = await fontes.disponibilidade(
    itens.map((item) => ({
      id: item.produtoId,
      ehMassa: precoPorProduto.get(item.produtoId)?.ehMassa ?? false,
    })),
  );

  const dia = resolverDiaDoPedido(itens, dias);
  if (!dia) return falhar({ motivo: 'sem_vaga', status: 409 });

  const doDiaEscolhido = dias.find((d) => d.data === dia.data)?.produtos ?? [];

  const precificados: ItemPrecificado[] = itens.map((item) => {
    const preco = precoPorProduto.get(item.produtoId) as PrecoDeProduto;
    return {
      produtoId: item.produtoId,
      quantidade: item.quantidade,
      nome: preco.nome,
      precoUnitarioCentavos: preco.precoUnitarioCentavos,
      disponivel: doDiaEscolhido.find((p) => p.produtoId === item.produtoId)?.disponivel ?? 0,
    };
  });

  // O preço cobrado é sempre o do banco; o que veio do navegador só serve para
  // saber se mudou desde a vitrine (RN3).
  const divergencias = conferirPrecos(
    entrada.itens.map((item) => ({
      produtoId: item.produtoId,
      precoUnitarioCentavos: item.precoVistoCentavos,
    })),
    precificados,
  );

  if (divergencias.length > 0) {
    return falhar({ motivo: 'preco_mudou', status: 409, divergencias });
  }

  const ajustado = aplicarTetos(precificados);
  if (ajustado.bloqueado) {
    return falhar({ motivo: 'sem_vaga', status: 409, ajustes: ajustado.ajustes });
  }

  const endereco = await fontes.endereco(entrada.enderecoId);
  if (!endereco) return falhar({ motivo: 'endereco_desconhecido', status: 404 });
  if (!endereco.atendido) return falhar({ motivo: 'fora_de_area', status: 422, detalhe: null });

  const subtotalCentavos = precificados.reduce(
    (total, item) => total + item.precoUnitarioCentavos * item.quantidade,
    0,
  );

  const frete = await fontes.frete(entrada.enderecoId, subtotalCentavos);

  // Frete `null` é fora de área, nunca zero: frete grátis silencioso é prejuízo
  // que não aparece no painel (RN18).
  if (!frete || frete.freteCentavos === null) {
    return falhar({ motivo: 'fora_de_area', status: 422, detalhe: frete?.motivo ?? null });
  }

  // A regra de frete grátis já foi aplicada por `calcularFrete`, com o piso que
  // veio da config: aqui só resta somar, e `faltamParaFreteGratis` é da tela.
  const totais = montarTotais({
    itens: precificados,
    freteCentavos: frete.freteCentavos,
    freteGratisCentavos: 0,
  });

  const minutos = await repo.pagamentoMinutos();

  const reservas = await repo.reservarCarrinho({
    dia: dia.data,
    itens: precificados.map((item) => ({
      produto_id: item.produtoId,
      quantidade: item.quantidade,
    })),
    profileId,
    limites: precificados.map((item) => ({
      produto_id: item.produtoId,
      // Total tolerado para o dia, não o que sobra: a função SQL reconta as
      // ocupadas sob lock e compara com este teto.
      limite: item.disponivel + ocupadas(consumos, dia.data, item.produtoId),
    })),
    minutos,
  });

  const primeira = reservas?.[0];
  if (!primeira) return falhar({ motivo: 'sem_vaga', status: 409 });

  const pedido = await repo.gravarPedido({
    profileId,
    diaEntrega: dia.data,
    enderecoId: endereco.id,
    enderecoSnapshot: endereco.snapshot,
    subtotalCentavos: totais.subtotalCentavos,
    freteCentavos: frete.freteCentavos,
    totalCentavos: totais.totalCentavos ?? 0,
    // O mesmo instante da reserva: cobrança e vaga vencem juntas (RN7).
    expiraEm: primeira.expira_em,
    reservaId: primeira.id,
    itens: precificados.map((item) => ({
      produtoId: item.produtoId,
      nome: item.nome,
      quantidade: item.quantidade,
      precoUnitarioCentavos: item.precoUnitarioCentavos,
    })),
  });

  try {
    const cobranca = await pagamento.criarCobranca({
      referenciaExterna: pedido.id,
      numeroPedido: pedido.numero,
      itens: precificados.map((item) => ({
        titulo: item.nome,
        quantidade: item.quantidade,
        precoUnitarioCentavos: item.precoUnitarioCentavos,
      })),
      freteCentavos: frete.freteCentavos,
      urlRetorno: urlRetorno(pedido.numero),
    });

    await repo.registrarPreferencia(pedido.id, cobranca.preferenciaId);

    return {
      ok: true,
      pedido: {
        pedidoId: pedido.id,
        numero: pedido.numero,
        diaEntrega: dia.data,
        totalCentavos: totais.totalCentavos ?? 0,
        urlPagamento: cobranca.urlPagamento,
      },
    };
  } catch {
    // Gateway fora do ar não pode prender a fornada por trinta minutos: a vaga
    // volta na mesma requisição (T37).
    await repo.desfazerPedido(
      pedido.id,
      reservas.map((reserva) => reserva.id),
    );
    return falhar({ motivo: 'gateway_indisponivel', status: 503 });
  }
}

function ocupadas(consumos: Snapshot['consumos'], dia: string, produtoId: string): number {
  return consumos
    .filter((consumo) => consumo.diaEntrega === dia && consumo.produtoId === produtoId)
    .reduce((total, consumo) => total + consumo.quantidade, 0);
}

function falhar(falha: FalhaDoPedido): ResultadoCriacao {
  return { ok: false, falha };
}
