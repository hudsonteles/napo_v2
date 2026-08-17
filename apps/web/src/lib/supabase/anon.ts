import { createClient } from '@supabase/supabase-js';

import type { Database } from '@napo/db';

import { publicEnv } from '@/lib/env';

/**
 * Client anônimo SEM sessão nem cookie, para leitura pública em SSG. Não toca
 * `cookies()` de propósito: o client de sessão (`server.ts`) tornaria a página
 * dinâmica (render a cada visita), quebrando o SSG que o grupo `(site)` exige
 * (design §3.1/§4.5). A chave é a anônima; a RLS decide o que é visível.
 */
export function createSupabaseAnonClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
