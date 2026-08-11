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
  test: {
    environment: 'node',
    include: ['{app,src}/**/*.test.ts'],
  },
});
