/**
 * Helper ÚNICO de fuso horário do domínio (RN6).
 *
 * Toda decisão de data de negócio — dia de entrega, cutoff de fermentação —
 * passa por aqui, fixada em `America/Sao_Paulo`. Data errada neste arquivo
 * vende pizza que não existe. Nenhum cálculo de dia pode usar a data do
 * sistema diretamente nem o fuso da máquina.
 *
 * A API é estreita de propósito (funções de negócio, não um wrapper genérico):
 * assim o caminho errado — chamar o método cru e perder o fuso — fica
 * indisponível.
 */

/** Fuso do negócio. O Brasil extinguiu o horário de verão em 2019 (UTC-3 fixo). */
export const FUSO_HORARIO = 'America/Sao_Paulo';

/**
 * Data do calendário em Brasília para um instante, no formato `YYYY-MM-DD`.
 *
 * Usa `Intl.DateTimeFormat` com `timeZone` explícito, então o resultado
 * NÃO varia com o fuso do processo (a variável `TZ` da máquina é irrelevante).
 *
 * @param instante Momento a converter. Padrão: agora.
 * @example hojeEmBrasilia(new Date('2026-08-10T02:30:00Z')) // '2026-08-09'
 */
export function hojeEmBrasilia(instante: Date = new Date()): string {
  // `en-CA` formata como `YYYY-MM-DD`, o formato ISO de data que precisamos.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_HORARIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}

/**
 * Instante UTC que marca o início do dia (00:00) em Brasília para um momento.
 *
 * Deriva o dia via {@link hojeEmBrasilia} e ancora em `-03:00`, o offset fixo
 * de São Paulo desde a extinção do horário de verão. Retorna um `Date` (UTC),
 * pronto para comparação com `timestamptz` do banco.
 */
export function inicioDoDiaEmBrasilia(instante: Date = new Date()): Date {
  const dia = hojeEmBrasilia(instante);
  return new Date(`${dia}T00:00:00-03:00`);
}
