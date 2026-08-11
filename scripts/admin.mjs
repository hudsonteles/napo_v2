#!/usr/bin/env node
/**
 * Ferramentas de administração de acesso (RN14).
 *
 * É um invólucro fino: toda a regra — exigir admin, exigir motivo, gravar
 * auditoria na mesma transação — vive nas funções `SECURITY DEFINER` do banco
 * (`0009_admin_functions.sql`). A tela do NAPO-008 vai chamar as mesmas funções,
 * e é por isso que este script não pode reimplementar nada delas.
 *
 * Sem dependência de pacote: fala com o PostgREST por `fetch` nativo. Instalar
 * um SDK na raiz do monorepo para duas chamadas HTTP não se paga.
 *
 * Uso:
 *   node scripts/admin.mjs validar-telefone --usuario <email|uuid> --telefone +5561991504477 --motivo "..."
 *   node scripts/admin.mjs promover         --usuario <email|uuid> --papel gerente          --motivo "..."
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARQUIVO_ENV = resolve(RAIZ, 'apps/web/.env.local');

const PAPEIS = ['cliente', 'atendente', 'cozinha', 'gerente', 'admin'];

/**
 * Mesmo formato do check constraint de `profiles.telefone`. A regra completa
 * (DDD existente, nono dígito) é do núcleo e do banco — aqui só se evita a
 * viagem de rede para um erro óbvio de digitação.
 */
const E164_BR = /^\+55\d{11}$/;

function abortar(mensagem) {
  console.error(`\nErro: ${mensagem}\n`);
  process.exit(1);
}

/** Lê `.env.local` sem dependência: o script roda fora do runtime do Next. */
function carregarEnv() {
  let bruto;
  try {
    bruto = readFileSync(ARQUIVO_ENV, 'utf8');
  } catch {
    abortar(`Não encontrei ${ARQUIVO_ENV}. Copie \`.env.example\` e preencha.`);
  }

  const env = {};
  for (const linha of bruto.split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) continue;
    const separador = limpa.indexOf('=');
    if (separador < 0) continue;
    env[limpa.slice(0, separador).trim()] = limpa.slice(separador + 1).trim();
  }

  for (const chave of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!env[chave]) abortar(`${chave} ausente em ${ARQUIVO_ENV}.`);
  }

  return env;
}

function lerArgumentos(argv) {
  const [comando, ...resto] = argv;
  const opcoes = {};

  for (let i = 0; i < resto.length; i += 2) {
    const chave = resto[i];
    if (!chave?.startsWith('--')) abortar(`Argumento inesperado: ${chave}`);
    const valor = resto[i + 1];
    if (valor === undefined) abortar(`Faltou o valor de ${chave}.`);
    opcoes[chave.slice(2)] = valor;
  }

  return { comando, opcoes };
}

function criarCliente(env) {
  const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
  const cabecalhos = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
  };

  return {
    async buscarPerfil(identificador) {
      const ehUuid = /^[0-9a-f-]{36}$/i.test(identificador);
      const filtro = ehUuid
        ? `id=eq.${identificador}`
        : `email=eq.${encodeURIComponent(identificador)}`;

      const resposta = await fetch(`${base}/rest/v1/profiles?${filtro}&select=id,email,role`, {
        headers: cabecalhos,
      });

      if (!resposta.ok) abortar(`Consulta a profiles falhou (${resposta.status}).`);

      const linhas = await resposta.json();
      if (linhas.length === 0) abortar(`Nenhum perfil para "${identificador}".`);
      if (linhas.length > 1) abortar(`Mais de um perfil para "${identificador}". Use o id.`);

      return linhas[0];
    },

    async chamar(funcao, argumentos) {
      const resposta = await fetch(`${base}/rest/v1/rpc/${funcao}`, {
        method: 'POST',
        headers: cabecalhos,
        body: JSON.stringify(argumentos),
      });

      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => ({}));
        abortar(`${funcao}: ${corpo.message ?? `HTTP ${resposta.status}`}`);
      }
    },
  };
}

function exigir(opcoes, campo, dica) {
  const valor = opcoes[campo]?.trim();
  if (!valor) abortar(`--${campo} é obrigatório${dica ? ` (${dica})` : ''}.`);
  return valor;
}

async function validarTelefone(cliente, opcoes) {
  const identificador = exigir(opcoes, 'usuario', 'e-mail ou id');
  const telefone = exigir(opcoes, 'telefone', 'formato +5561991504477');
  const motivo = exigir(opcoes, 'motivo', 'por que o override foi necessário');

  if (!E164_BR.test(telefone)) {
    abortar(`Telefone precisa estar em E.164: +55 seguido de DDD e 9 dígitos.`);
  }

  const perfil = await cliente.buscarPerfil(identificador);
  await cliente.chamar('validar_telefone_manual', {
    alvo: perfil.id,
    telefone_e164: telefone,
    motivo,
  });

  console.info(`\nTelefone ${telefone} validado manualmente para ${perfil.email}.`);
  console.info('Auditoria registrada com autor, valores anterior e novo, e motivo.\n');
}

async function promover(cliente, opcoes) {
  const identificador = exigir(opcoes, 'usuario', 'e-mail ou id');
  const papel = exigir(opcoes, 'papel', PAPEIS.join(' | '));
  const motivo = exigir(opcoes, 'motivo', 'por que a mudança foi necessária');

  if (!PAPEIS.includes(papel)) abortar(`Papel inválido. Use um de: ${PAPEIS.join(', ')}.`);

  const perfil = await cliente.buscarPerfil(identificador);
  await cliente.chamar('promover_usuario', { alvo: perfil.id, novo_role: papel, motivo });

  console.info(`\n${perfil.email}: ${perfil.role} -> ${papel}.`);
  console.info('Auditoria registrada com autor, valores anterior e novo, e motivo.\n');
}

function ajuda() {
  console.info(`
Ferramentas de administração do Napo (NAPO-002, RN14)

  validar-telefone  --usuario <email|uuid> --telefone <+55DDD9XXXXXXXX> --motivo "<texto>"
  promover          --usuario <email|uuid> --papel <${PAPEIS.join('|')}> --motivo "<texto>"

Motivo é obrigatório nos dois comandos: é o único identificador de intenção que
sobra quando a ação roda pela service_role, sem sessão de admin.
`);
}

const { comando, opcoes } = lerArgumentos(process.argv.slice(2));

if (!comando || comando === '--help' || comando === 'ajuda') {
  ajuda();
  process.exit(0);
}

const cliente = criarCliente(carregarEnv());

if (comando === 'validar-telefone') await validarTelefone(cliente, opcoes);
else if (comando === 'promover') await promover(cliente, opcoes);
else {
  ajuda();
  abortar(`Comando desconhecido: ${comando}`);
}
