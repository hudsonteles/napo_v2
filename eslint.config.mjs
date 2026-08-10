import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

/**
 * Config raiz do monorepo (ESLint 9 flat config).
 *
 * O bloco mais importante é a **regra de fronteira** de `packages/core` (RN7):
 * o núcleo puro não pode importar React, Supabase, Next nem fazer HTTP.
 * A violação é um erro de lint — reprova no CI, não depende de revisão humana.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/out/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      'packages/db/src/types.generated.ts',
      'supabase/.temp/**',
      'supabase/.branches/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Regras específicas do app Next.js (Core Web Vitals).
  ...compat.config({
    extends: ['next/core-web-vitals'],
    settings: { next: { rootDir: 'apps/web' } },
  }).map((config) => ({ ...config, files: ['apps/web/**/*.{ts,tsx}'] })),

  // 🔒 Fronteira do núcleo puro (RN7). Nenhuma dependência externa entra em core.
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'packages/core é puro: proibido importar React (RN7).' },
            { name: 'react-dom', message: 'packages/core é puro: proibido importar React (RN7).' },
          ],
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'next', 'next/*'],
              message: 'packages/core é puro: sem React/Next (RN7).',
            },
            {
              group: ['@supabase/*', 'supabase'],
              message: 'packages/core é puro: sem Supabase (RN7).',
            },
            {
              group: ['node:http', 'node:https', 'node:fetch', 'axios', 'undici', 'got'],
              message: 'packages/core é puro: sem HTTP (RN7).',
            },
          ],
        },
      ],
      // `fetch` global também é proibido no núcleo puro.
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'packages/core é puro: sem HTTP (RN7).' },
      ],
    },
  },

  // Ambiente de testes (Vitest) e scripts de config.
  {
    files: ['**/*.test.ts', '**/*.config.{ts,mjs,js}', 'vitest.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
