/**
 * Normalização e validação de celular brasileiro (RN8).
 *
 * Existe como regra pura porque o mesmo número precisa produzir exatamente a
 * mesma string em três lugares — no que é enviado à Meta, no que é gravado em
 * `profiles.telefone` e no que a unicidade compara. Divergência entre eles
 * significa a mesma pessoa validando duas vezes, ou o teto diário contando
 * errado por causa de um traço a mais.
 */

/** Motivo da recusa. Só `formato` é seguro de mostrar de forma específica. */
export type MotivoRecusaTelefone = 'formato' | 'ddd_inexistente' | 'nao_celular';

export type TelefoneNormalizado =
  | { valido: true; e164: string }
  | { valido: false; motivo: MotivoRecusaTelefone };

/**
 * DDDs em uso no Brasil. Lista fechada em vez de faixa numérica: 20, 23, 25,
 * 26, 29, 30, 36, 39, 40, 50, 52, 56-60, 70, 72, 76, 78, 80, 90 nunca foram
 * atribuídos, e aceitar um deles significa mandar mensagem paga para o vazio.
 */
const DDDS_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

const DIGITOS_NACIONAIS = 11;

export function normalizarTelefoneBR(entrada: string): TelefoneNormalizado {
  const nacional = removerPrefixoInternacional(entrada.replace(/\D/g, ''));

  // 10 dígitos é o formato de fixo — recusa apontando a causa real, não "formato".
  if (nacional.length === 10) return { valido: false, motivo: 'nao_celular' };
  if (nacional.length !== DIGITOS_NACIONAIS) return { valido: false, motivo: 'formato' };

  if (!DDDS_VALIDOS.has(Number(nacional.slice(0, 2)))) {
    return { valido: false, motivo: 'ddd_inexistente' };
  }

  // Celular brasileiro começa em 9 desde 2016. Sem esse dígito é fixo portado
  // ou número inventado — nos dois casos o WhatsApp não entrega.
  if (nacional[2] !== '9') return { valido: false, motivo: 'nao_celular' };

  return { valido: true, e164: `+55${nacional}` };
}

/**
 * Descasca o código do país. A ordem importa: `0055` é testado antes de `55`
 * porque `00` sozinho também é começo de DDD inválido, e o comprimento 13
 * separa "+55 + DDD 61" de "DDD 55 + número", que colidiriam.
 */
function removerPrefixoInternacional(digitos: string): string {
  if (digitos.startsWith('0055')) return digitos.slice(4);
  if (digitos.startsWith('55') && digitos.length === DIGITOS_NACIONAIS + 2) return digitos.slice(2);
  return digitos;
}

/** `+5561991504477` → `(61) 99150-4477`. Só para exibição. */
export function formatarTelefoneBR(e164: string): string {
  const nacional = e164.replace(/\D/g, '').slice(-DIGITOS_NACIONAIS);
  return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
}
