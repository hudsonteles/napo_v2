/**
 * Regras do código de verificação (RN6, RN7).
 *
 * Puro de propósito: a fonte de aleatoriedade é injetada em vez de importada.
 * `packages/core` não pode depender de `node:crypto`, e o teste precisa de
 * sorteio determinístico — os dois problemas se resolvem com o mesmo parâmetro.
 */

export const TAMANHO_CODIGO = 6;
export const VALIDADE_CODIGO_MINUTOS = 10;
export const MAX_TENTATIVAS = 5;
export const ESPERA_REENVIO_SEGUNDOS = 60;

/** Tetos em janela deslizante de 24h. Protegem a conta a pagar, não só o cadastro. */
export const MAX_ENVIOS_POR_NUMERO_24H = 5;
/** Dobro do teto por número: NAT de escritório e operadora móvel compartilham IP. */
export const MAX_ENVIOS_POR_IP_24H = 10;

const ESPACO_DE_CODIGOS = 10 ** TAMANHO_CODIGO;

/**
 * Sorteia um inteiro em `[0, limite)`. Em produção é `crypto.randomInt`;
 * `Math.random` não serve — é previsível o bastante para adivinhar códigos.
 */
export type Sorteio = (limite: number) => number;

export function gerarCodigo(sorteio: Sorteio): string {
  return String(sorteio(ESPACO_DE_CODIGOS)).padStart(TAMANHO_CODIGO, '0');
}

export function expiracaoDe(emitidoEm: Date): Date {
  return new Date(emitidoEm.getTime() + VALIDADE_CODIGO_MINUTOS * 60_000);
}

export type EstadoDoDesafio = {
  tentativas: number;
  expiraEm: Date;
  validadoEm: Date | null;
};

export type DecisaoDeConferencia =
  | 'pode_conferir'
  | 'expirado'
  | 'tentativas_esgotadas'
  | 'ja_validado';

/**
 * A ordem das checagens é o contrato: um código já validado responde
 * `ja_validado` mesmo depois de expirar, porque reusar código gasto e usar
 * código vencido são erros diferentes para quem está do outro lado da tela.
 */
export function avaliarConferencia(
  estado: EstadoDoDesafio,
  agora: Date,
): DecisaoDeConferencia {
  if (estado.validadoEm !== null) return 'ja_validado';
  if (estado.tentativas >= MAX_TENTATIVAS) return 'tentativas_esgotadas';
  if (agora >= estado.expiraEm) return 'expirado';
  return 'pode_conferir';
}

export function tentativasRestantes(tentativas: number): number {
  return Math.max(0, MAX_TENTATIVAS - tentativas);
}

export type DecisaoDeReenvio = { permitido: boolean; segundosRestantes: number };

export function avaliarReenvio(ultimoEnvioEm: Date | null, agora: Date): DecisaoDeReenvio {
  if (ultimoEnvioEm === null) return { permitido: true, segundosRestantes: 0 };

  const decorridos = (agora.getTime() - ultimoEnvioEm.getTime()) / 1000;
  const restantes = Math.ceil(ESPERA_REENVIO_SEGUNDOS - decorridos);

  return restantes > 0
    ? { permitido: false, segundosRestantes: restantes }
    : { permitido: true, segundosRestantes: 0 };
}

export type DecisaoDeTeto =
  | { permitido: true }
  | { permitido: false; motivo: 'teto_numero' | 'teto_ip' };

export function avaliarTetoDeEnvio(enviosNoNumero: number, enviosNoIp: number): DecisaoDeTeto {
  if (enviosNoNumero >= MAX_ENVIOS_POR_NUMERO_24H) {
    return { permitido: false, motivo: 'teto_numero' };
  }
  if (enviosNoIp >= MAX_ENVIOS_POR_IP_24H) {
    return { permitido: false, motivo: 'teto_ip' };
  }
  return { permitido: true };
}
