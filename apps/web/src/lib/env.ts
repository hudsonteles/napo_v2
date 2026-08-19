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
  // Maps JS para o ajuste do pin (NAPO-005 RN6). Pública de propósito — quem a
  // protege é a restrição por referrer, não o segredo.
  NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: z.string().min(1),
});

const publicParsed = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
});

if (!publicParsed.success) {
  throw new Error(mensagemDeErro('públicas', publicParsed.error));
}

export const publicEnv = publicParsed.data;

// ── Variáveis de servidor: NUNCA no browser ──────────────────────────────────
const serverSchema = z
  .object({
    APP_ENV: z.enum(['local', 'staging', 'production']),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    // Segredo do HMAC do código (RN6). Trocá-la invalida os desafios em voo —
    // aceitável, eles duram 10 minutos.
    OTP_PEPPER: z.string().min(1),
    // RN16: o canal troca por variável, nunca por alteração de código.
    WHATSAPP_PROVIDER: z.enum(['fake', 'meta']).default('fake'),
    WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
    WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
    WHATSAPP_TEMPLATE_NAME: z.string().min(1).optional(),
    WHATSAPP_TEMPLATE_LANG: z.string().min(1).optional(),
  })
  // Provedor mal configurado precisa quebrar no boot, não na primeira pessoa
  // que tentar se cadastrar (T45).
  .superRefine((valores, ctx) => {
    if (valores.WHATSAPP_PROVIDER !== 'meta') return;

    for (const chave of [
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_TEMPLATE_NAME',
      'WHATSAPP_TEMPLATE_LANG',
    ] as const) {
      if (!valores[chave]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [chave],
          message: 'obrigatória quando WHATSAPP_PROVIDER=meta',
        });
      }
    }
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
    OTP_PEPPER: process.env.OTP_PEPPER,
    WHATSAPP_PROVIDER: process.env.WHATSAPP_PROVIDER,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_TEMPLATE_NAME: process.env.WHATSAPP_TEMPLATE_NAME,
    WHATSAPP_TEMPLATE_LANG: process.env.WHATSAPP_TEMPLATE_LANG,
  });

  if (!parsed.success) {
    throw new Error(mensagemDeErro('de servidor', parsed.error));
  }

  serverCache = parsed.data;
  return serverCache;
}

// ── Google Maps: escopo próprio, não o schema monolítico ─────────────────────
// `getServerEnv()` valida tudo de uma vez, e é chamado no SSG do catálogo: pôr a
// chave lá faria uma credencial de geocodificação ausente impedir a Margherita
// de ser prerenderizada. Cada subsistema falha alto no que é dele, e só nisso.
const googleSchema = z.object({
  // Geocoding + Routes (NAPO-005 RN5). Sem prefixo NEXT_PUBLIC_ de propósito: o
  // Next substitui a referência por `undefined` no bundle do cliente, e é essa
  // substituição que impede a chave de servidor de vazar (T18).
  GOOGLE_MAPS_SERVER_KEY: z.string().min(1),
});

type GoogleEnv = z.infer<typeof googleSchema>;
let googleCache: GoogleEnv | null = null;

/** Credenciais do Google usadas apenas por geocodificação e rota. Código de servidor apenas. */
export function getGoogleEnv(): GoogleEnv {
  if (googleCache) return googleCache;

  const parsed = googleSchema.safeParse({
    GOOGLE_MAPS_SERVER_KEY: process.env.GOOGLE_MAPS_SERVER_KEY,
  });

  if (!parsed.success) {
    throw new Error(mensagemDeErro('do Google Maps', parsed.error));
  }

  googleCache = parsed.data;
  return googleCache;
}

function mensagemDeErro(escopo: string, erro: z.ZodError): string {
  const faltando = erro.issues.map((i) => i.path.join('.')).join(', ');
  return (
    `Variáveis de ambiente ${escopo} ausentes ou inválidas: ${faltando}. ` +
    'Copie `.env.example` para `apps/web/.env.local` e preencha (RN5).'
  );
}
