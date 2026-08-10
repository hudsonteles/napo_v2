import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@napo/db';

import { publicEnv } from '@/lib/env';

/**
 * Client Supabase para código de servidor (Server Components, Route Handlers).
 * Liga a sessão do usuário aos cookies da requisição — é o pacote `@supabase/ssr`
 * que gerencia isso corretamente no App Router. Usa a chave anônima; a RLS é
 * quem decide o que cada sessão enxerga.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          // Em Server Components a escrita de cookie pode ser ignorada pelo
          // runtime; o middleware de sessão (NAPO-002) faz a renovação real.
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Sem sessão a renovar neste contexto — seguro ignorar.
          }
        },
      },
    },
  );
}
