#!/usr/bin/env node
/**
 * Envoltório do Supabase CLI que injeta `supabase/.env` no ambiente.
 *
 * O `config.toml` é versionado e referencia credenciais por `env(...)` — client
 * secret em arquivo versionado é segredo publicado. A CLI 1.x não tem
 * `--env-file`, e ela lê as variáveis do processo: é esse repasse que este
 * script faz, e nada mais.
 *
 * Sem o arquivo, segue em frente: quem não usa login social não deve ser
 * impedido de subir o banco.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const arquivo = join(raiz, 'supabase', '.env');

function carregar(caminho) {
  let conteudo;

  try {
    conteudo = readFileSync(caminho, 'utf8');
  } catch {
    return {};
  }

  return Object.fromEntries(
    conteudo
      .split(/\r?\n/)
      .map((linha) => linha.trim())
      .filter((linha) => linha.length > 0 && !linha.startsWith('#'))
      .map((linha) => {
        const separador = linha.indexOf('=');
        if (separador === -1) return null;
        const chave = linha.slice(0, separador).trim();
        // Aspas em volta do valor são do formato do arquivo, não do segredo.
        const valor = linha
          .slice(separador + 1)
          .trim()
          .replace(/^["']|["']$/g, '');
        return [chave, valor];
      })
      .filter((par) => par !== null),
  );
}

/**
 * Chaves que o `config.toml` referencia por `env(...)`. Precisam existir E ser
 * não-vazias: o CLI trata valor vazio como variável ausente e aborta. O CI não
 * tem `supabase/.env` e não pode deixar de subir o banco por causa de um
 * provedor de login que ele nem exercita — daí o marcador.
 *
 * Com o marcador, o provedor sobe inoperante: quem tentasse usá-lo receberia
 * erro do Google. É por isso que o botão na tela depende de outra chave
 * (`NEXT_PUBLIC_AUTH_GOOGLE`) e não da existência do provedor.
 */
const SEM_CREDENCIAL = 'ausente-neste-ambiente';
const OBRIGATORIAS = ['SUPABASE_AUTH_GOOGLE_CLIENT_ID', 'SUPABASE_AUTH_GOOGLE_SECRET'];

/**
 * O ambiente que o CLI precisa. Exportado porque `gen-types.mjs` executa o
 * mesmo binário por outro caminho — capturando a saída em vez de herdá-la — e
 * duplicar a leitura do arquivo faria as duas divergirem no primeiro ajuste.
 */
export function ambienteSupabase() {
  // O ambiente já definido vence o arquivo: em CI as variáveis vêm do runner.
  const ambiente = { ...carregar(arquivo), ...process.env };

  for (const chave of OBRIGATORIAS) {
    if (!ambiente[chave]) ambiente[chave] = SEM_CREDENCIAL;
  }

  return ambiente;
}

// Importado como módulo (`gen-types.mjs`), não deve executar nada.
const invocadoDireto = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (!invocadoDireto) {
  // nada a fazer: quem importa quer só `ambienteSupabase`.
} else {
const ambiente = ambienteSupabase();

const processo = spawn('supabase', process.argv.slice(2), {
  stdio: 'inherit',
  shell: true,
  env: ambiente,
});

processo.on('exit', (codigo) => process.exit(codigo ?? 1));
}
