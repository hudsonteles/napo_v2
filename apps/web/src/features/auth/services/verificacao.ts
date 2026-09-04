import 'server-only';

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import {
  avaliarConferencia,
  avaliarReenvio,
  avaliarTetoDeEnvio,
  expiracaoDe,
  gerarCodigo,
  normalizarTelefoneBR,
  tentativasRestantes,
  type MotivoRecusaTelefone,
} from '@napo/core';

import { getServerEnv } from '@/lib/env';
import { remetenteDeCodigo } from '@/lib/otp/remetente';

import { destinoAposLogin, type PerfilSessao } from '../destino';
import * as repo from './verificacao-repo';

const JANELA_TETO_HORAS = 24;

/**
 * Com o canal falso, o código é fixo (`123456`).
 *
 * A mesma variável que decide o canal decide o código: `WHATSAPP_PROVIDER=meta`
 * sorteia, `fake` não. Isso mantém o par ambiente/comportamento em **uma**
 * chave, em vez de criar um segundo interruptor que alguém pode ligar em
 * produção por engano. Continua passando pelo HMAC, pelo teto e pela expiração
 * — o que muda é só o sorteio.
 */
const CODIGO_DE_DESENVOLVIMENTO = 123456;

function sorteioDoAmbiente(): (limite: number) => number {
  return getServerEnv().WHATSAPP_PROVIDER === 'fake'
    ? () => CODIGO_DE_DESENVOLVIMENTO
    : (limite) => randomInt(limite);
}

/**
 * HMAC-SHA256 com pepper fora do banco (design §5). O telefone entra no material
 * para que o mesmo código emitido a duas pessoas não produza o mesmo hash — um
 * dump não vira tabela de equivalência entre linhas.
 */
function hashDoCodigo(telefone: string, codigo: string): string {
  return createHmac('sha256', getServerEnv().OTP_PEPPER)
    .update(`${telefone}:${codigo}`)
    .digest('hex');
}

function hashesConferem(esperado: string, informado: string): boolean {
  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(informado, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export type ResultadoEmissao =
  | { tipo: 'enviado'; expiraEm: Date; podeReenviarEm: number }
  | { tipo: 'telefone_invalido'; motivo: MotivoRecusaTelefone }
  | { tipo: 'teto'; motivo: 'teto_numero' | 'teto_ip' }
  | { tipo: 'aguarde'; segundosRestantes: number }
  | { tipo: 'falha_envio' };

/**
 * Emissão do código (RN6-RN9, RN11, RN16).
 *
 * A ordem é deliberada: formato, tetos e espera de reenvio vêm **antes** de
 * qualquer gravação ou envio — cada mensagem é dinheiro pago à Meta, e recusar
 * depois de enviar não devolve o custo.
 */
export async function emitirCodigo({
  perfilId,
  telefone,
  nome,
  ip,
  agora = new Date(),
}: {
  perfilId: string;
  telefone: string;
  nome: string;
  ip: string | null;
  agora?: Date;
}): Promise<ResultadoEmissao> {
  const normalizado = normalizarTelefoneBR(telefone);
  if (!normalizado.valido) {
    return { tipo: 'telefone_invalido', motivo: normalizado.motivo };
  }

  const e164 = normalizado.e164;
  const desde = new Date(agora.getTime() - JANELA_TETO_HORAS * 3_600_000);

  const [enviosNoNumero, enviosNoIp, ultimo] = await Promise.all([
    repo.contarEnviosPorNumero(e164, desde),
    repo.contarEnviosPorIp(ip, desde),
    repo.ultimoDesafioDoPerfil(perfilId),
  ]);

  const teto = avaliarTetoDeEnvio(enviosNoNumero, enviosNoIp);
  if (!teto.permitido) return { tipo: 'teto', motivo: teto.motivo };

  const reenvio = avaliarReenvio(ultimo?.criadoEm ?? null, agora);
  if (!reenvio.permitido) {
    return { tipo: 'aguarde', segundosRestantes: reenvio.segundosRestantes };
  }

  // O nome é gravado agora, independentemente do desfecho: a pessoa preencheu
  // nome e telefone na mesma tela e não deve redigitar por causa de um erro
  // que não é dela.
  await repo.atualizarNome(perfilId, nome);

  const codigo = gerarCodigo(sorteioDoAmbiente());
  const expiraEm = expiracaoDe(agora);

  const desafio = await repo.gravarDesafio({
    perfilId,
    telefone: e164,
    codigoHash: hashDoCodigo(e164, codigo),
    expiraEm,
    ip,
  });

  // RN11: número já validado por outra conta. O desafio fica gravado — conta no
  // teto e registra a tentativa — mas nada é enviado, e a resposta é a mesma do
  // caminho de sucesso. Distinguir aqui transformaria o endpoint em oráculo de
  // enumeração de clientes.
  if (await repo.telefoneValidadoPorOutraConta(e164, perfilId)) {
    return { tipo: 'enviado', expiraEm: desafio.expiraEm, podeReenviarEm: 60 };
  }

  try {
    await remetenteDeCodigo().enviarCodigo(e164, codigo);
  } catch (erro) {
    // O motivo real fica no log; a tela recebe frase genérica (spec §4).
    console.error('[otp] falha ao enviar código', {
      desafio: desafio.id,
      erro: erro instanceof Error ? erro.message : 'desconhecido',
    });
    // T43: falha nossa não consome o teto diário de quem tentou.
    await repo.invalidarDesafio(desafio.id);
    return { tipo: 'falha_envio' };
  }

  return { tipo: 'enviado', expiraEm: desafio.expiraEm, podeReenviarEm: 60 };
}

export type ResultadoConferencia =
  | { tipo: 'validado'; destino: string }
  | { tipo: 'codigo_incorreto'; restantes: number }
  | { tipo: 'expirado' }
  | { tipo: 'esgotado' }
  | { tipo: 'ja_validado' }
  | { tipo: 'sem_desafio' }
  | { tipo: 'conflito' };

/**
 * Conferência do código e conclusão do cadastro (RN6, RN9, RN10, RN15).
 *
 * O consentimento é gravado **antes** da conclusão: sem transação de múltiplos
 * comandos pelo PostgREST, a ordem é o que garante a invariante que importa —
 * nunca existir cadastro concluído sem consentimento registrado.
 */
export async function conferirCodigo({
  perfil,
  codigo,
  ip,
  aceiteMarketing,
  registrarConsentimentos,
  agora = new Date(),
}: {
  perfil: PerfilSessao;
  codigo: string;
  ip: string | null;
  aceiteMarketing: boolean;
  registrarConsentimentos: (entrada: {
    perfilId: string;
    ip: string | null;
    marketing: boolean;
  }) => Promise<void>;
  agora?: Date;
}): Promise<ResultadoConferencia> {
  const desafio = await repo.ultimoDesafioDoPerfil(perfil.id);
  if (!desafio) return { tipo: 'sem_desafio' };

  const decisao = avaliarConferencia(
    { tentativas: desafio.tentativas, expiraEm: desafio.expiraEm, validadoEm: desafio.validadoEm },
    agora,
  );

  if (decisao === 'ja_validado') return { tipo: 'ja_validado' };
  if (decisao === 'tentativas_esgotadas') return { tipo: 'esgotado' };
  if (decisao === 'expirado') return { tipo: 'expirado' };

  // Incrementa antes de comparar: requisição abortada no meio não pode render
  // uma tentativa grátis (design §3.1).
  const tentativas = desafio.tentativas + 1;
  await repo.registrarTentativa(desafio.id, tentativas);

  if (!hashesConferem(desafio.codigoHash, hashDoCodigo(desafio.telefone, codigo))) {
    return { tipo: 'codigo_incorreto', restantes: tentativasRestantes(tentativas) };
  }

  await registrarConsentimentos({ perfilId: perfil.id, ip, marketing: aceiteMarketing });

  const { conflito } = await repo.marcarTelefoneValidado(perfil.id, desafio.telefone);
  if (conflito) return { tipo: 'conflito' };

  await repo.concluirDesafio(desafio.id);

  return {
    tipo: 'validado',
    destino: destinoAposLogin({ ...perfil, telefoneValidado: true }, null),
  };
}
