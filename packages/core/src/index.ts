/**
 * `@napo/core` — REGRAS PURAS do domínio.
 *
 * TypeScript puro: não importa React, não importa Supabase, não faz HTTP (RN7).
 * Toda regra que decide o que pode ser vendido, quando e por quanto mora aqui
 * e é testável com testes rápidos e determinísticos.
 */
export {
  FUSO_HORARIO,
  diaDaSemanaEmBrasilia,
  hojeEmBrasilia,
  inicioDoDiaEmBrasilia,
  instanteEmBrasilia,
  somarDias,
} from './tempo';
export * from './catalogo';
export * from './disponibilidade';
export * from './otp';
export * from './telefone';
