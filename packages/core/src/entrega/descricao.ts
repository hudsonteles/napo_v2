import type { DiaSemana } from '../disponibilidade';

/**
 * A frase de cobertura, derivada da configuração (RN17).
 *
 * Dia de entrega e raio são dado, não texto. Uma frase cravada que contradiz a
 * configuração é pior que frase nenhuma: promete entrega em dia que a operação
 * não faz. Vive no core porque a home, o checkout e o e-mail de confirmação vão
 * precisar da mesma frase — o segundo consumidor a escreveria diferente.
 */

interface NomeDoDia {
  /** Plural recorrente: "às sextas", não "na sexta". */
  plural: string;
  /** Sábado e domingo são masculinos e pedem "aos". */
  preposicao: 'às' | 'aos';
}

const DIAS: Record<DiaSemana, NomeDoDia> = {
  0: { plural: 'domingos', preposicao: 'aos' },
  1: { plural: 'segundas', preposicao: 'às' },
  2: { plural: 'terças', preposicao: 'às' },
  3: { plural: 'quartas', preposicao: 'às' },
  4: { plural: 'quintas', preposicao: 'às' },
  5: { plural: 'sextas', preposicao: 'às' },
  6: { plural: 'sábados', preposicao: 'aos' },
};

/**
 * Lista de dias ativos → "às quartas e sextas".
 *
 * `null` quando não há dia ativo: a tela omite a frase em vez de anunciar
 * entrega que a operação não faz.
 */
export function descreverDiasDeEntrega(dias: DiaSemana[]): string | null {
  const ordenados = [...new Set(dias)].sort((a, b) => a - b);
  if (ordenados.length === 0) return null;

  // A preposição só reaparece quando o gênero vira ("às sextas e aos sábados").
  const termos = ordenados.map((dia, indice) => {
    const { plural, preposicao } = DIAS[dia];
    const anterior = indice === 0 ? null : DIAS[ordenados[indice - 1] as DiaSemana];

    return anterior?.preposicao === preposicao ? plural : `${preposicao} ${plural}`;
  });

  if (termos.length === 1) return termos[0] as string;

  const ultimo = termos.at(-1) as string;
  return `${termos.slice(0, -1).join(', ')} e ${ultimo}`;
}

/** Raio da operação → "12 km". Vírgula decimal, como todo número do site. */
export function descreverRaio(raioKm: number): string {
  return `${String(raioKm).replace('.', ',')} km`;
}

export interface Cobertura {
  dias: DiaSemana[];
  raioKm: number;
  cidade: string;
}

/** Frase inteira, para superfícies que não estilizam as partes (e-mail, checkout). */
export function descreverCobertura({ dias, raioKm, cidade }: Cobertura): string | null {
  const quando = descreverDiasDeEntrega(dias);
  if (!quando) return null;

  return `Entregamos ${quando} em ${cidade}, num raio de ${descreverRaio(raioKm)} da cozinha.`;
}
