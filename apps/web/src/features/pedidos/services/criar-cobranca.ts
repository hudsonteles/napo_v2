import 'server-only';

import { familiaDaRecusa, mensagemDaRecusa, type FamiliaRecusa } from '@napo/core';

import type { DadosPix, PortaPagamento } from '@/lib/pagamentos/porta';

import type { RepositorioDeCobrancas } from './cobrancas-repo';
import type { RepositorioDePedidos } from './pedidos-repo';

/**
 * Onde o token do Brick vira cobrança (RN10, RN12, RN13).
 *
 * A cobrança nasce **no nosso banco antes** de o gateway ser chamado: é o que
 * dá uma chave estável para a idempotência e o que faz a tentativa existir
 * mesmo quando a resposta se perde no caminho. Cobrança sem resposta é um fato
 * que precisa ser investigável, não um registro que nunca chegou a existir.
 *
 * **Aprovação síncrona não confirma o pedido.** Quem confirma é o webhook, nunca
 * a tela (RN6): aqui o que se grava é o rastro. Se a notificação não vier, a
 * consulta ativa da RN19 resolve.
 */

export interface EntradaPagamento {
  pedidoId: string;
  token?: string;
  metodo: string;
  parcelas: number;
  emailPagador: string;
}

export interface DependenciasDaCobranca {
  pagamento: PortaPagamento;
  cobrancas: RepositorioDeCobrancas;
  pedidos: RepositorioDePedidos;
}

export type FalhaDaCobranca =
  | { motivo: 'pedido_desconhecido'; status: 404 }
  | { motivo: 'pedido_nao_e_seu'; status: 404 }
  | { motivo: 'pedido_ja_pago'; status: 409 }
  | { motivo: 'pedido_vencido'; status: 409 }
  | { motivo: 'recusado'; status: 422; familia: FamiliaRecusa; mensagem: string }
  | { motivo: 'gateway_indisponivel'; status: 503 };

export interface CobrancaAberta {
  cobrancaId: string;
  /** `aguardando` cobre tanto o Pix por pagar quanto o cartão já aprovado no
   *  gateway: quem muda isso para `pago` é a notificação. */
  situacao: 'aguardando';
  pix: DadosPix | null;
}

export type ResultadoDaCobranca =
  | { ok: true; cobranca: CobrancaAberta }
  | { ok: false; falha: FalhaDaCobranca };

export async function criarCobranca(
  entrada: EntradaPagamento,
  profileId: string,
  { pagamento, cobrancas, pedidos }: DependenciasDaCobranca,
): Promise<ResultadoDaCobranca> {
  const pedido = await pedidos.lerPedido(entrada.pedidoId);

  if (!pedido) return falhar({ motivo: 'pedido_desconhecido', status: 404 });
  // Pedido de outra pessoa responde igual a pedido inexistente: a rota não é
  // oráculo de quantos pedidos a casa tem.
  if (pedido.profileId !== profileId) return falhar({ motivo: 'pedido_nao_e_seu', status: 404 });
  if (pedido.situacaoPagamento === 'pago') return falhar({ motivo: 'pedido_ja_pago', status: 409 });
  if (new Date(pedido.expiraEm) <= new Date()) {
    return falhar({ motivo: 'pedido_vencido', status: 409 });
  }

  // Índice único parcial no banco: o segundo clique cai aqui e recebe a mesma
  // cobrança, em vez de abrir uma segunda (RN10).
  const cobranca = await cobrancas.abrir({
    pedidoId: pedido.id,
    instrumento: 'online',
    valorCentavos: pedido.totalCentavos,
    // Um relógio só: a cobrança morre com a vaga (RN11).
    expiraEm: pedido.expiraEm,
    criadaPor: profileId,
  });

  let criada;

  try {
    criada = await pagamento.criarCobranca({
      cobrancaId: cobranca.id,
      numeroPedido: pedido.numero,
      valorCentavos: pedido.totalCentavos,
      descricao: `Napo — pedido #${pedido.numero}`,
      token: entrada.token,
      metodo: entrada.metodo,
      parcelas: entrada.parcelas,
      emailPagador: entrada.emailPagador,
      expiraEm: pedido.expiraEm,
    });
  } catch (erro) {
    // A vaga NÃO é devolvida: o cliente está na tela, com o cartão na mão, e vai
    // tentar de novo em segundos. Derrubar a reserva dele seria puni-lo pelo
    // erro do terceiro. A cobrança é encerrada para a próxima tentativa caber.
    //
    // O motivo fica gravado na própria cobrança: tentativa que falha sem deixar
    // rastro é tentativa que ninguém consegue investigar depois — o mesmo
    // princípio da RN15, aplicado ao lado de cá da chamada. O cliente não vê
    // nada disso (RN13).
    await cobrancas.mudarSituacao({
      cobrancaId: cobranca.id,
      situacao: 'expirada',
      detalhe: `falha ao criar no gateway: ${motivoDoErro(erro)}`.slice(0, 500),
    });
    return falhar({ motivo: 'gateway_indisponivel', status: 503 });
  }

  await cobrancas.registrarTentativa({
    cobrancaId: cobranca.id,
    mpPaymentId: criada.idPagamento,
    detalhe: criada.detalhe,
  });

  if (criada.status === 'recusado') {
    await cobrancas.mudarSituacao({
      cobrancaId: cobranca.id,
      situacao: 'recusada',
      detalhe: criada.detalhe,
    });

    const familia = familiaDaRecusa(criada.detalhe);
    return falhar({
      motivo: 'recusado',
      status: 422,
      familia,
      mensagem: mensagemDaRecusa(familia),
    });
  }

  return {
    ok: true,
    cobranca: { cobrancaId: cobranca.id, situacao: 'aguardando', pix: criada.pix },
  };
}

function falhar(falha: FalhaDaCobranca): ResultadoDaCobranca {
  return { ok: false, falha };
}

/** O SDK do gateway embala a causa em campos diferentes conforme o erro. */
function motivoDoErro(erro: unknown): string {
  if (typeof erro !== 'object' || erro === null) return String(erro);

  const e = erro as { message?: unknown; status?: unknown; cause?: unknown };
  const partes = [
    e.status === undefined ? null : `status ${String(e.status)}`,
    typeof e.message === 'string' ? e.message : null,
    e.cause === undefined ? null : JSON.stringify(e.cause),
  ].filter(Boolean);

  return partes.length > 0 ? partes.join(' — ') : 'sem detalhe';
}
