import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Runner de testes do app. O alias `@/` espelha o `paths` do `tsconfig.json` —
 * sem ele os imports das rotas não resolvem fora do build do Next.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // O `server-only` lança por padrão fora do bundler do Next; os testes
      // rodam em Node e trocam-no por um módulo vazio. A proteção continua
      // valendo no build real, que resolve a condição `react-server`.
      'server-only': fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)),
    },
  },
  // Os testes rodam em Node e não processam CSS. Sem esta config vazia o Vite
  // carrega o `postcss.config.mjs` do Next, cuja notação de plugin por string ele
  // não entende, e a suíte quebra antes do primeiro teste.
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'node',
    // Módulos que validam ambiente no import (`lib/env.ts`) precisam de valores
    // válidos aqui — os testes nunca alcançam o Supabase real.
    env: {
      APP_ENV: 'local',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54421',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-de-teste',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      SUPABASE_SERVICE_ROLE_KEY: 'servico-de-teste',
      OTP_PEPPER: 'pimenta-de-teste',
    },
    include: ['{app,src}/**/*.test.ts'],
  },
});
