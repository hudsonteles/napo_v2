/**
 * RN7 — nenhuma superfície (texto de produto, meta description, JSON-LD) pode
 * alegar benefício de saúde, digestão ou função. É território regulado pela
 * ANVISA. Formulação sensorial ("leve", "não pesa") é permitida e NÃO entra na
 * lista — é o que separa o argumento sensorial da alegação funcional.
 *
 * Lista curada dos radicais que caracterizam alegação regulada. Match por
 * substring em minúsculas: "digest" pega "digestão"/"digestível"; "leve" fica
 * de fora de propósito. Esta lista é o contrato — ampliar é decisão editorial.
 */
const RADICAIS_ALEGACAO_SAUDE = [
  'saudável',
  'saudavel',
  'digest',
  'emagrec',
  'detox',
  'funcional',
  'nutritiv',
  'faz bem',
  'benefício à saúde',
  'beneficio a saude',
  'imunidade',
  'metabolismo',
  'fortalece',
] as const;

/** Radicais de alegação encontrados no texto (vazio = limpo). */
export function alegacoesDeSaudeEncontradas(texto: string): string[] {
  const alvo = texto.toLowerCase();
  return RADICAIS_ALEGACAO_SAUDE.filter((radical) => alvo.includes(radical));
}

/** Verdadeiro se o texto carrega qualquer alegação de saúde proibida (RN7). */
export function contémAlegacaoDeSaude(texto: string): boolean {
  return alegacoesDeSaudeEncontradas(texto).length > 0;
}
