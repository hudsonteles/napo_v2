#!/usr/bin/env node
/**
 * Gera `packages/db/src/types.generated.ts` a partir do banco local.
 *
 * Existe porque a forma óbvia é armadilha: `supabase gen types ... > arquivo`
 * faz o shell **truncar o destino antes** de o comando rodar. Se o CLI falhar —
 * e ele falha sem as variáveis que o `config.toml` referencia — o que sobra é um
 * arquivo vazio e um typecheck quebrado em toda parte. Aconteceu em 2026-09-05.
 *
 * Aqui a saída é capturada em memória e só substitui o arquivo depois de exit 0
 * com conteúdo plausível. Falha não toca no que está no disco.
 *
 * `--check` não escreve: compara e sai 1 se houver diferença. É o que o CI usa
 * para pegar tipos fora de sincronia com as migrations.
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ambienteSupabase } from './supabase.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'packages', 'db', 'src', 'types.generated.ts');
const conferir = process.argv.includes('--check');

/** Um arquivo de tipos sem isto é um arquivo que não deve substituir nada. */
const MARCA = 'export type Database';

const processo = spawn(
  'supabase',
  ['gen', 'types', 'typescript', '--local'],
  { shell: true, env: ambienteSupabase(), stdio: ['ignore', 'pipe', 'inherit'] },
);

let saida = '';
processo.stdout.setEncoding('utf8');
processo.stdout.on('data', (pedaco) => {
  saida += pedaco;
});

processo.on('exit', (codigo) => {
  if (codigo !== 0) {
    console.error(`\nGeração de tipos falhou (exit ${codigo}). O arquivo atual foi preservado.`);
    process.exit(codigo ?? 1);
  }

  if (!saida.includes(MARCA)) {
    console.error('\nA saída do CLI não parece um arquivo de tipos. O arquivo atual foi preservado.');
    process.exit(1);
  }

  if (conferir) {
    const atual = readFileSync(destino, 'utf8');
    if (atual === saida) {
      console.log('OK: tipos em sincronia com as migrations.');
      return;
    }

    console.error('Tipos gerados fora de sincronia. Rode `pnpm db:types` e commite o resultado.');
    process.exit(1);
  }

  writeFileSync(destino, saida);
  console.log(`Tipos gerados em ${destino}`);
});
