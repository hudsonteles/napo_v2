import type { MetadataRoute } from 'next';

import { lerSlugsAtivos } from '@/features/catalogo/services/catalogo';
import { publicEnv } from '@/lib/env';

/**
 * Sitemap gerado no build a partir do catálogo ativo (T7). Produto inativo não
 * entra — `lerSlugsAtivos` só vê o ativo pela RLS (RN1). URL de produto
 * descontinuado nunca é anunciada ao buscador.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const agora = new Date();

  const estaticas: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: agora, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/sabores`, lastModified: agora, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/como-aquecer`, lastModified: agora, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/eventos`, lastModified: agora, changeFrequency: 'monthly', priority: 0.7 },
  ];

  const slugs = await lerSlugsAtivos();
  const produtos: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${base}/sabores/${slug}`,
    lastModified: agora,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...estaticas, ...produtos];
}
