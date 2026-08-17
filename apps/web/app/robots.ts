import type { MetadataRoute } from 'next';

import { publicEnv } from '@/lib/env';

/**
 * Convenção nativa do Next, gerada no build (custo zero por visita). Libera o
 * site inteiro e aponta o buscador para o sitemap (T7). Nada de indexação é
 * bloqueado — a conversão por busca orgânica é premissa do R1 (spec §2).
 */
export default function robots(): MetadataRoute.Robots {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${base}/sitemap.xml`,
  };
}
