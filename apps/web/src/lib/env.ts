import { z } from 'zod';

/**
 * Ponto ÚNICO de leitura de `process.env` (RN5). Validação com Zod no boot —
 * variável faltando vira erro barulhento na inicialização, nunca `undefined`
 * viajando três camadas até um erro incompreensível em runtime.
 *
 * A separação entre público e servidor é o que mantém a `service_role` fora do
 * browser (RN3): as variáveis de servidor são lidas por referência explícita a
 * `process.env.*` (sem prefixo `NEXT_PUBLIC_`), que o Next substitui por
 * `undefined` no bundle do cliente — o segredo nunca chega ao navegador.
 */

// ── Variáveis públicas: seguras no browser (prefixo NEXT_PUBLIC_) ────────────
// Referências explícitas para o Next conseguir inliná-las no bundle do cliente.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // Base do link de retorno do Magic Link e do OAuth. Precisa ser explícita: em
  // produção o app roda atrás de proxy, e `window.location` do navegador que
  // pediu o link não é fonte confiável do domínio para onde ele deve voltar.
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

const publicParsed = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!publicParsed.success) {
  throw new Error(mensagemDeErro('públicas', publicParsed.error));
}

export const publicEnv = publicParsed.data;

// ── Variáveis de servidor: NUNCA no browser ──────────────────────────────────
const serverSchema = z.object({
  APP_ENV: z.enum(['local', 'staging', 'production']),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

type ServerEnv = z.infer<typeof serverSchema>;
let serverCache: ServerEnv | null = null;

/**
 * Lê e valida as variáveis de servidor sob demanda (RN5). Lança se qualquer uma
 * faltar, nomeando explicitamente quais — inclusive `SUPABASE_SERVICE_ROLE_KEY`,
 * sem a qual a aplicação não sobe. Chamada em código de servidor apenas.
 */
export function getServerEnv(): ServerEnv {
  if (serverCache) return serverCache;

  const parsed = serverSchema.safeParse({
    APP_ENV: process.env.APP_ENV,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    throw new Error(mensagemDeErro('de servidor', parsed.error));
  }

  serverCache = parsed.data;
  return serverCache;
}

function mensagemDeErro(escopo: string, erro: z.ZodError): string {
  const faltando = erro.issues.map((i) => i.path.join('.')).join(', ');
  return (
    `Variáveis de ambiente ${escopo} ausentes ou inválidas: ${faltando}. ` +
    'Copie `.env.example` para `apps/web/.env.local` e preencha (RN5).'
  );
}
