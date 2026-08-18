/**
 * Frete e área de entrega (NAPO-005) — quanto custa levar e até onde se leva.
 *
 * Números entram, números saem. A regra que, errada, cobra frete abaixo do
 * custo mora aqui e é testável sem banco e sem rede (RN16).
 */
export { avaliarArea } from './area';
export type { AvaliacaoArea, EntradaArea, ExcecaoArea, TipoExcecaoArea } from './area';
export {
  arredondarKm,
  deslocamentoMetros,
  distanciaEmLinhaRetaKm,
  estimarDistanciaRodoviariaKm,
  excedeLimiteDeAjuste,
} from './distancia';
export type { Coordenada } from './distancia';
export { calcularFrete, faixaDaDistancia } from './frete';
export type { EntradaFrete, FaixaFrete, ResultadoFrete } from './frete';
