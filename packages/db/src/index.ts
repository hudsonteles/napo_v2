/**
 * `@napo/db` — Tipos gerados do banco (fonte: migrations, via `pnpm db:types`).
 *
 * As factories de client Supabase vivem em `apps/web/src/lib/supabase/` (onde
 * cookies e o runtime do Next importam). Aqui mora apenas o contrato de tipos
 * que o app consome para ter type-safety contra o schema real.
 */
export type { Database, Json } from './types.generated';
