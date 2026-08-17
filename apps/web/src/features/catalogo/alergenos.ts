import type { Alergeno } from '@napo/core';

/**
 * Rótulos e destaque de alérgenos (RN3/RN4). A informação crítica aparece em
 * TEXTO, nunca só cor ou ícone (design §4.7): "Contém avelã" é o sinal, o
 * vermelho é reforço. Grafia canônica com acento vem daqui — o enum do banco é
 * sem acento para não depender de digitação.
 */
const ROTULO: Record<Alergeno, string> = {
  gluten: 'glúten',
  leite: 'leite',
  ovos: 'ovos',
  soja: 'soja',
  amendoim: 'amendoim',
  castanhas: 'castanhas',
  avela: 'avelã',
  peixe: 'peixe',
  crustaceos: 'crustáceos',
};

// Castanhas e amendoim causam as reações mais graves — a avelã da Nutella é o
// caso que a RN3 nomeia. Contê-los eleva o aviso na vitrine.
const CRITICOS: ReadonlySet<Alergeno> = new Set(['avela', 'amendoim', 'castanhas']);

export function rotuloAlergeno(alergeno: Alergeno): string {
  return ROTULO[alergeno];
}

/** "Contém avelã, glúten, leite" — texto pronto para o card e a página. */
export function textoContem(alergenos: Alergeno[]): string {
  if (alergenos.length === 0) return '';
  return `Contém ${alergenos.map(rotuloAlergeno).join(', ')}`;
}

/** Verdadeiro se a lista tem um alérgeno de reação grave (eleva o aviso, RN3). */
export function temAlergenoCritico(alergenos: Alergeno[]): boolean {
  return alergenos.some((a) => CRITICOS.has(a));
}
