/**
 * Avaliação de área de entrega (RN9, RN10).
 *
 * Decide se um endereço é atendido e por quê. O "por quê" não é decoração: é o
 * texto que a tela mostra a quem fez tudo certo e mora onde a casa ainda não
 * chega, e o registro que explica seis meses depois por que aquele CEP está
 * barrado.
 */

export type TipoExcecaoArea = 'bloqueio' | 'liberacao';

export interface ExcecaoArea {
  tipo: TipoExcecaoArea;
  /** Prefixo de CEP, só dígitos ou com máscara — a comparação normaliza os dois. */
  cepPrefixo: string;
  motivo: string;
}

export interface EntradaArea {
  /** `null` quando a distância ainda não pôde ser medida. */
  distanciaKm: number | null;
  cep: string;
  raioKm: number;
  excecoes: ExcecaoArea[];
}

export interface AvaliacaoArea {
  atendido: boolean;
  motivo: string | null;
}

const apenasDigitos = (valor: string) => valor.replace(/\D/g, '');

/**
 * A exceção aplicável ao CEP, ou `null`.
 *
 * Vence o prefixo **mais longo**: com uma suspensão de região `716` e uma
 * liberação de condomínio `71680`, a regra geral engoliria a exceção dela se a
 * ordem decidisse.
 */
function excecaoAplicavel(cep: string, excecoes: ExcecaoArea[]): ExcecaoArea | null {
  const cepNormalizado = apenasDigitos(cep);

  return excecoes
    .filter((e) => cepNormalizado.startsWith(apenasDigitos(e.cepPrefixo)))
    .sort((a, b) => apenasDigitos(b.cepPrefixo).length - apenasDigitos(a.cepPrefixo).length)
    .at(0)
    ?? null;
}

export function avaliarArea({ distanciaKm, cep, raioKm, excecoes }: EntradaArea): AvaliacaoArea {
  // A exceção é decisão humana registrada e vence o raio nas duas direções (RN10).
  const excecao = excecaoAplicavel(cep, excecoes);
  if (excecao) {
    return { atendido: excecao.tipo === 'liberacao', motivo: excecao.motivo };
  }

  if (distanciaKm === null) {
    return { atendido: false, motivo: 'Distância ainda não medida.' };
  }

  // `<=`: o limite inclui a borda (T25). Um endereço a exatos 12,00 km está no
  // raio de 12 km — arredondar contra o cliente na borda é recusar venda por
  // ponto flutuante.
  if (distanciaKm <= raioKm) {
    return { atendido: true, motivo: null };
  }

  return {
    atendido: false,
    motivo: `Fora do raio de ${raioKm} km — o endereço fica a ${distanciaKm} km.`,
  };
}
