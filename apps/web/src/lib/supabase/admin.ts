import 'server-only';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '@napo/db';

import { getServerEnv, publicEnv } from '@/lib/env';

/**
 * Client com `service_role` — ignora RLS, **exclusivo de Route Handlers** (RN3).
 *
 * O `import 'server-only'` no topo transforma um import equivocado em erro de
 * build, não em vazamento em produção: é a diferença entre uma regra escrita e
 * uma regra que se defende sozinha.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    getServerEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
