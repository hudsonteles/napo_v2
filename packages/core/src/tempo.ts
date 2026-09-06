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

/**
 * Instante UTC de um horário (`HH:MM`) num dia (`YYYY-MM-DD`) de Brasília.
 *
 * É o que permite o cutoff nascer da janela de entrega sem que nenhum cálculo
 * toque no fuso da máquina (RN5).
 *
 * @example instanteEmBrasilia('2026-08-14', '17:00') // 2026-08-14T20:00:00Z
 */
export function instanteEmBrasilia(dia: string, hora: string): Date {
  const [hh = '00', mm = '00'] = hora.split(':');
  return new Date(`${dia}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:00-03:00`);
}

/**
 * Dia da semana de uma data de calendário: 0=domingo … 6=sábado.
 *
 * Mesma convenção do `EXTRACT(DOW)` do Postgres, para que a linha de
 * `dias_semana_entrega` case com o cálculo sem tradução no meio.
 */
export function diaDaSemanaEmBrasilia(dia: string): number {
  return new Date(`${dia}T12:00:00-03:00`).getUTCDay();
}

/**
 * Soma dias de calendário a uma data `YYYY-MM-DD`, devolvendo outra data.
 *
 * Ancorado ao meio-dia para que a aritmética nunca escorregue de dia por
 * causa de borda de fuso.
 */
export function somarDias(dia: string, quantidade: number): string {
  const base = new Date(`${dia}T12:00:00-03:00`);
  base.setUTCDate(base.getUTCDate() + quantidade);
  return hojeEmBrasilia(base);
}

/**
 * Milissegundos restantes em `mm:ss`, para contagem regressiva.
 *
 * Arredonda para cima: enquanto sobrar qualquer fração de segundo, o relógio
 * ainda mostra aquele segundo. Mostrar `00:00` com meio segundo de vida faria a
 * tela desmontar o pagamento antes de o prazo acabar de verdade.
 *
 * Passou do prazo devolve `00:00`, nunca negativo — o cliente não precisa saber
 * há quanto tempo perdeu a vaga.
 */
export function formatarContagem(msRestantes: number): string {
  const segundos = Math.max(0, Math.ceil(msRestantes / 1000));
  const minutos = Math.floor(segundos / 60);

  return `${String(minutos).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;
}
