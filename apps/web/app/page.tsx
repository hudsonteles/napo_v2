import { getServerEnv } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Health check sempre ao vivo — nunca servido de cache estático.
export const dynamic = 'force-dynamic';

/**
 * Tela crua de verificação da fundação (NAPO-001).
 *
 * NÃO tem contrato visual — é texto puro, descartável, substituído pelo NAPO-003.
 * Existe só para provar a cadeia inteira: Next renderiza, `env` validou, o client
 * Supabase conectou e o Postgres respondeu com a sua hora (design §3).
 */
export default async function Page() {
  // Valida as variáveis de servidor no boot da renderização (RN5). Se
  // `SUPABASE_SERVICE_ROLE_KEY` faltar, isto lança e a página não sobe.
  getServerEnv();

  const supabase = await createSupabaseServerClient();
  const { data: horario, error } = await supabase.rpc('horario_servidor');

  const conectou = !error && Boolean(horario);

  return (
    <main style={{ textAlign: 'center', padding: '2rem', maxWidth: '40rem' }}>
      <p style={{ fontSize: '3rem', margin: 0 }} aria-hidden>
        {conectou ? '✅' : '❌'}
      </p>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
        {conectou ? 'Fundação de pé' : 'Falha ao conectar no banco'}
      </h1>

      {conectou ? (
        <p style={{ color: '#f5c518' }}>
          Postgres respondeu: <strong>{String(horario)}</strong>
        </p>
      ) : (
        <p style={{ color: '#f5c518' }}>
          {error?.message ?? 'Sem resposta do banco. O Docker está ativo? Rode `pnpm db:start`.'}
        </p>
      )}

      <p style={{ opacity: 0.6, fontSize: '0.85rem' }}>
        Tela de verificação do NAPO-001 — descartável. O site nasce no NAPO-003.
      </p>
    </main>
  );
}
