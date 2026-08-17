/**
 * Feature de catálogo (NAPO-003) — leitura pública do catálogo e composição da
 * vitrine e da página de produto. Expõe só o necessário; internals são privados.
 */
export { lerCatalogo } from './services/catalogo';
export { fotoDoProduto } from './fotos';
export { rotuloAlergeno, temAlergenoCritico, textoContem } from './alergenos';
export { Disco } from './components/disco';
export { CardProduto } from './components/card-produto';
export { VitrineFiltravel } from './components/vitrine-filtravel';
export type { CatalogoLido, ProdutoVitrine } from './tipos';
