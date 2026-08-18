/**
 * A regra de frete (RN7, RN8, RN16).
 *
 * Um único lugar transforma distância e subtotal em valor. Checkout, admin e
 * qualquer simulador futuro chamam esta função — duas implementações da mesma
 * regra é como um canal passa a cobrar diferente do outro.
 */

export interface FaixaFrete {
  kmDe: number;
  /** Aberto: `kmAte` pertence à faixa seguinte, exceto na última (ver `faixaDaDistancia`). */
  kmAte: number;
  valorCentavos: number;
}

export interface EntradaFrete {
  distanciaKm: number | null;
  subtotalCentavos: number;
  /** Veredito de área já calculado (`area.ts`) — o frete não reavalia raio nem exceção. */
  atendido: boolean;
  motivoNaoAtendido: string | null;
  faixas: FaixaFrete[];
  freteGratisCentavos: number;
}

export interface ResultadoFrete {
  /** `null` quando não há entrega a cobrar — fora de área nunca vira zero. */
  freteCentavos: number | null;
  gratis: boolean;
  faixa: FaixaFrete | null;
  foraDeArea: boolean;
  motivo: string | null;
}

/**
 * A faixa que contém a distância, ou `null` se nenhuma contém.
 *
 * Intervalo `[kmDe, kmAte)` — 4,00 km é a faixa de cima (T26). A **última**
 * faixa é a exceção e fecha à direita, porque seu fim é o raio de atuação e
 * 12,00 km é atendido (T25): sem isso a borda do raio ficaria sem preço.
 */
export function faixaDaDistancia(distanciaKm: number, faixas: FaixaFrete[]): FaixaFrete | null {
  const ordenadas = [...faixas].sort((a, b) => a.kmDe - b.kmDe);

  const contendo = ordenadas.find((f) => distanciaKm >= f.kmDe && distanciaKm < f.kmAte);
  if (contendo) return contendo;

  const ultima = ordenadas.at(-1);
  return ultima && distanciaKm === ultima.kmAte ? ultima : null;
}

const SEM_FRETE = {
  freteCentavos: null,
  gratis: false,
  faixa: null,
  foraDeArea: true,
} as const;

export function calcularFrete(entrada: EntradaFrete): ResultadoFrete {
  const { distanciaKm, subtotalCentavos, atendido, motivoNaoAtendido, faixas } = entrada;

  if (!atendido || distanciaKm === null) {
    return { ...SEM_FRETE, motivo: motivoNaoAtendido };
  }

  const faixa = faixaDaDistancia(distanciaKm, faixas);

  // Distância dentro do raio mas sem faixa configurada é buraco de configuração,
  // não entrega grátis: cobrar zero calado é o prejuízo que ninguém vê no mês.
  if (!faixa) {
    return {
      ...SEM_FRETE,
      motivo: motivoNaoAtendido ?? `Nenhuma faixa de frete cobre ${distanciaKm} km.`,
    };
  }

  const gratis = subtotalCentavos >= entrada.freteGratisCentavos;

  return {
    freteCentavos: gratis ? 0 : faixa.valorCentavos,
    gratis,
    // A faixa acompanha o resultado mesmo grátis: o painel econômico do NAPO-008
    // precisa saber quanto de entrega a casa absorveu, não só que absorveu.
    faixa,
    foraDeArea: false,
    motivo: null,
  };
}
