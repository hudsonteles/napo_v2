/**
 * Feature de catálogo (NAPO-003) — leitura pública do catálogo e composição da
 * vitrine e da página de produto. Expõe só o necessário; internals são privados.
 */
export { lerCatalogo, lerProdutoPorSlug, lerSlugsAtivos } from './services/catalogo';
export { fotoDoProduto } from './fotos';
export { rotuloAlergeno, temAlergenoCritico, textoContem } from './alergenos';
export { Disco } from './components/disco';
export { CardProduto } from './components/card-produto';
export { BlocoRotulagem } from './components/bloco-rotulagem';
export { VitrineFiltravel } from './components/vitrine-filtravel';
export { DisponibilidadeProvider } from './components/disponibilidade-provider';
export { SeletorFornada } from './components/seletor-fornada';
export { BarraFornada } from './components/barra-fornada';
export { EstadoDisponibilidade } from './components/estado-disponibilidade';
export { estadoDoProduto } from './disponibilidade-view';
export type { CatalogoLido, ProdutoVitrine } from './tipos';
