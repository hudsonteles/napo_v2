/**
 * Superfície de servidor da feature de endereços (ARCHITECTURE §3.2).
 *
 * Só o que rotas e páginas consomem. Os repositórios (`services/*-repo`) são
 * internos: quem precisa de dado passa pelos serviços, que carregam a regra.
 */
export { buscarCep, normalizarCep } from './services/cep';
export type { EnderecoDeCep, FonteCep } from './services/cep';
export { geocodificar, medirDistancia, montarEnderecoParaBusca } from './services/geocoding';
export type { DistanciaMedida, EnderecoParaBusca } from './services/geocoding';
