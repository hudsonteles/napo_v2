import 'server-only';

import {
  calcularDisponibilidade,
  calcularSubtotal,
  conferirPrecos,
  normalizarItens,
  resolverDiaDoPedido,
  type DiaDoPedido,
  type DisponibilidadeDia,
  type DivergenciaPreco,
  type ItemCarrinho,
  type ItemPrecificado,
  type Snapshot,
} from '@napo/core';

import { lerCatalogo } from '@/features/catalogo';
import { carregarSnapshot } from '@/features/disponibilidade';
import { calcularFreteDoEndereco, listarEnderecos } from '@/features/enderecos';
import { publicEnv } from '@/lib/env';
import { portaPagamento } from '@/lib/pagamentos/porta';

import type { EntradaCriarPedido } from '../schema';
import {
  anexarPreferencia,
  compensarPedido,
  inserirPedido,
  lerPagamentoMinutos,
  reservarCarrinho,
} from './pedidos-repo';

/**
 * Orquestra a criação de pedido (design §3.2): revalida → reserva → grava
 * pedido → cria cobrança, com compensação em cada falha. A ordem não é
 * estética: a reserva vem antes da cobrança (RN7) e a preferência vem por
 * último porque é o único passo irreversível fora do nosso banco.
 */

/** Revalidação do carrinho contra catálogo e disponibilidade atuais (RN3). */
export interface Revalidacao {
  /** Itens com preço e nome do catálogo AGORA e o teto do dia resolvido. */
  itens: ItemPrecificado[];
  /** Dia único do pedido (RN2), ou `null` se algum item não cabe em fornada alguma. */
  dia: DiaDoPedido | null;
  /** Algum id enviado não existe ou está inativo no catálogo. */
  faltando: boolean;
  snapshot: Snapshot;
}

function disponibilidadeDoItem(
  produtoId: string,
  dias: DisponibilidadeDia[],
  diaAlvo: string | null,
): number {
  // Com dia unificado (o normal), o teto é o daquele dia — é para ele que a
  // reserva vai. Sem dia unificado, o pedido não fecha de qualquer forma; o
  // maior teto do horizonte só serve para a tela sinalizar o culpado sem marcar
  // como esgotado quem na verdade cabe em outra fornada.
  if (diaAlvo) {
    return dias.find((d) => d.data === diaAlvo)?.produtos.find((p) => p.produtoId === produtoId)
      ?.disponivel ?? 0;
  }
  return Math.max(
    0,
    ...dias.map((d) => d.produtos.find((p) => p.produtoId === produtoId)?.disponivel ?? 0),
  );
}

/**
 * Lê preço e disponibilidade atuais dos itens (RN3). Compartilhada pelo
 * `POST /api/carrinho/validar` (sem sessão) e pela criação de pedido — o mesmo
 * cálculo em dois consumidores, nunca duas verdades sobre o preço.
 */
export async function revalidarCarrinho(entrada: ItemCarrinho[]): Promise<Revalidacao> {
  const itens = normalizarItens(entrada);

  const catalogo = await lerCatalogo();
  const porId = new Map(catalogo.produtos.map((p) => [p.produto.id, p]));

  const faltando = itens.some((i) => !porId.has(i.produtoId));
  const conhecidos = itens.filter((i) => porId.has(i.produtoId));

  const snapshot = await carregarSnapshot(
    conhecidos.map((i) => ({ id: i.produtoId, ehMassa: porId.get(i.produtoId)!.categoria.ehMassa })),
  );
  const dias = calcularDisponibilidade(snapshot);
  const dia = resolverDiaDoPedido(conhecidos, dias);

  const precificados: ItemPrecificado[] = conhecidos.map((i) => {
    const vitrine = porId.get(i.produtoId)!;
    return {
      produtoId: i.produtoId,
      quantidade: i.quantidade,
      nome: vitrine.produto.nome,
      precoUnitarioCentavos: vitrine.precoEfetivoCentavos,
      disponivel: disponibilidadeDoItem(i.produtoId, dias, dia?.data ?? null),
    };
  });

  return { itens: precificados, dia, faltando, snapshot };
}

export type ResultadoCriarPedido =
  | { ok: true; numero: number; urlPagamento: string }
  | { ok: false; erro: 'carrinho_vazio' }
  | { ok: false; erro: 'item_indisponivel' }
  | { ok: false; erro: 'divergencia_preco'; divergencias: DivergenciaPreco[] }
  | { ok: false; erro: 'sem_vaga'; dia: string | null }
  | { ok: false; erro: 'endereco_invalido' }
  | { ok: false; erro: 'fora_de_area' }
  | { ok: false; erro: 'gateway_indisponivel' }
  | { ok: false; erro: 'falha_interna' };

export async function criarPedido(
  entrada: EntradaCriarPedido,
  profileId: string,
): Promise<ResultadoCriarPedido> {
  const pedidos = normalizarItens(entrada.itens);
  if (pedidos.length === 0) return { ok: false, erro: 'carrinho_vazio' };

  const { itens, dia, faltando, snapshot } = await revalidarCarrinho(entrada.itens);
  if (faltando) return { ok: false, erro: 'item_indisponivel' };
  if (!dia) return { ok: false, erro: 'sem_vaga', dia: null };

  // Conferência de preço (RN3): o que o cliente viu × o que vale agora. Antes de
  // tocar endereço, reserva ou cobrança — divergência barra tudo.
  const vistos = entrada.itens.map((i) => ({
    produtoId: i.produtoId,
    precoUnitarioCentavos: i.precoUnitarioCentavos,
  }));
  const divergencias = conferirPrecos(vistos, itens);
  if (divergencias.length > 0) return { ok: false, erro: 'divergencia_preco', divergencias };

  // Endereço e frete (RN18): tudo do banco, nada do cliente. `listarEnderecos`
  // roda sob a RLS do dono — id alheio simplesmente não aparece.
  const endereco = (await listarEnderecos()).find((e) => e.id === entrada.enderecoId);
  if (!endereco) return { ok: false, erro: 'endereco_invalido' };
  if (!endereco.atendido) return { ok: false, erro: 'fora_de_area' };

  const subtotalCentavos = calcularSubtotal(itens);
  const frete = await calcularFreteDoEndereco(entrada.enderecoId, subtotalCentavos);
  // Frete `null` é fora de área (NAPO-005 RN9), nunca zero por omissão.
  if (!frete || frete.freteCentavos === null) return { ok: false, erro: 'fora_de_area' };

  const totalCentavos = subtotalCentavos + frete.freteCentavos;

  // Reserva (RN7): tudo ou nada, sob um único lock do dia. O limite tolerado é
  // "disponível + ocupadas" — o total do dia, não o que sobra, porque a RPC
  // reconta as ocupadas por dentro. Prazo em `pagamento_minutos`, não
  // `reserva_minutos`: quem está pagando tem 30 min, não os 15 da vitrine.
  const minutos = await lerPagamentoMinutos();
  const limites = itens.map((i) => {
    const ocupadas = snapshot.consumos
      .filter((c) => c.diaEntrega === dia.data && c.produtoId === i.produtoId)
      .reduce((total, c) => total + c.quantidade, 0);
    return { produto_id: i.produtoId, limite: i.disponivel + ocupadas };
  });

  const reservas = await reservarCarrinho({
    diaEntrega: dia.data,
    itens: itens.map((i) => ({ produto_id: i.produtoId, quantidade: i.quantidade })),
    profileId,
    limites,
    minutos,
  });
  if (!reservas || reservas.length === 0) return { ok: false, erro: 'sem_vaga', dia: dia.data };

  const reservaIds = reservas.map((r) => r.id);
  // Todas nasceram no mesmo `now()` da transação: um instante só, e é ele que a
  // RN7 exige igual entre reserva e cobrança.
  const primeiraReserva = reservas[0]!;
  const expiraEm = primeiraReserva.expiraEm;

  const pedido = await inserirPedido({
    profileId,
    diaEntrega: dia.data,
    enderecoId: entrada.enderecoId,
    enderecoSnapshot: endereco,
    subtotalCentavos,
    freteCentavos: frete.freteCentavos,
    totalCentavos,
    reservaId: primeiraReserva.id,
    expiraEm,
    itens: itens.map((i) => ({
      produtoId: i.produtoId,
      nomeSnapshot: i.nome,
      quantidade: i.quantidade,
      precoUnitarioCentavos: i.precoUnitarioCentavos,
    })),
  });

  if (!pedido) {
    await compensarPedido(null, reservaIds);
    return { ok: false, erro: 'falha_interna' };
  }

  // Cobrança por último: único passo irreversível fora do banco. Falha aqui
  // libera a reserva e expira o pedido na mesma requisição (RN7, T37).
  let cobranca;
  try {
    cobranca = await portaPagamento().criarCobranca({
      numeroPedido: String(pedido.numero),
      descricao: `Pedido #${pedido.numero} — Napo`,
      totalCentavos,
      urlRetorno: `${publicEnv.NEXT_PUBLIC_SITE_URL}/pedido/${pedido.numero}`,
      urlWebhook: `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/webhook/mp`,
    });
  } catch {
    await compensarPedido(pedido.id, reservaIds);
    return { ok: false, erro: 'gateway_indisponivel' };
  }

  await anexarPreferencia(pedido.id, cobranca.preferenceId);

  return { ok: true, numero: pedido.numero, urlPagamento: cobranca.urlPagamento };
}
