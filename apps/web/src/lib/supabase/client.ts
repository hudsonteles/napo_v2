import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@napo/db';

import { publicEnv } from '@/lib/env';

/**
 * Client Supabase para o browser (Client Components). Usa apenas a chave
 * anônima, protegida por RLS. A `service_role` jamais passa por aqui (RN3).
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
