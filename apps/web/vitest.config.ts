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
    },
  },
  // Os testes rodam em Node e não processam CSS. Sem esta config vazia o Vite
  // carrega o `postcss.config.mjs` do Next, cuja notação de plugin por string ele
  // não entende, e a suíte quebra antes do primeiro teste.
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'node',
    include: ['{app,src}/**/*.test.ts'],
  },
});
