import 'server-only';

import { gravarCepNoCache, lerCepDoCache } from './cep-repo';

/**
 * Busca de CEP com cache e dois provedores (RN2).
 *
 * O CEP preenche, mas **nunca trava** o cadastro: CEP novo leva meses para ser
 * indexado e boa parte do entorno do DF só tem CEP geral de cidade. Toda falha
 * daqui é `null`, nunca exceção — quem chama abre o formulário para digitação
 * manual e o cadastro segue.
 */

export type FonteCep = 'viacep' | 'brasilapi';

export interface EnderecoDeCep {
  /** Oito dígitos, sem máscara — é assim que a coluna `ceps.cep` guarda. */
  cep: string;
  logradouro: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  fonte: FonteCep;
}

/**
 * O cliente está com o teclado na mão: esperar 30 s por um terceiro fora do ar é
 * pior que digitar o endereço (T21). Três segundos por provedor, dois provedores.
 */
export const TIMEOUT_PROVEDOR_MS = 3000;

/** CEP em oito dígitos, ou `null` se não for CEP. Nenhuma chamada externa antes disto (T8). */
export function normalizarCep(cep: string): string | null {
  const digitos = cep.replace(/\D/g, '');
  return /^[0-9]{8}$/.test(digitos) ? digitos : null;
}

const textoOuNulo = (valor: unknown): string | null => {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  return texto.length > 0 ? texto : null;
};

async function buscarJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_PROVEDOR_MS) });
    if (!resposta.ok) return null;

    return (await resposta.json()) as Record<string, unknown>;
  } catch {
    // Timeout, DNS, TLS, JSON quebrado: para o cadastro é tudo a mesma coisa —
    // este provedor não respondeu, tenta o próximo.
    return null;
  }
}

async function noViaCep(cep: string): Promise<EnderecoDeCep | null> {
  const dados = await buscarJson(`https://viacep.com.br/ws/${cep}/json/`);

  // O ViaCEP responde 200 com `{ "erro": true }` para CEP inexistente — em
  // versões diferentes como boolean ou como a string "true".
  if (!dados || dados.erro) return null;

  const cidade = textoOuNulo(dados.localidade);
  const uf = textoOuNulo(dados.uf);
  if (!cidade || !uf) return null;

  return {
    cep,
    logradouro: textoOuNulo(dados.logradouro),
    bairro: textoOuNulo(dados.bairro),
    cidade,
    uf,
    fonte: 'viacep',
  };
}

async function naBrasilApi(cep: string): Promise<EnderecoDeCep | null> {
  const dados = await buscarJson(`https://brasilapi.com.br/api/cep/v1/${cep}`);
  if (!dados) return null;

  const cidade = textoOuNulo(dados.city);
  const uf = textoOuNulo(dados.state);
  if (!cidade || !uf) return null;

  return {
    cep,
    logradouro: textoOuNulo(dados.street),
    bairro: textoOuNulo(dados.neighborhood),
    cidade,
    uf,
    fonte: 'brasilapi',
  };
}

/**
 * Cache → ViaCEP → BrasilAPI → `null`.
 *
 * O cache é tabela, não memória: serverless não tem processo longevo e um cache
 * em memória morreria a cada cold start, pagando de novo a latência do terceiro
 * pelo mesmo CEP.
 */
export async function buscarCep(cepBruto: string): Promise<EnderecoDeCep | null> {
  const cep = normalizarCep(cepBruto);
  if (!cep) return null;

  const emCache = await lerCepDoCache(cep);
  if (emCache) return emCache;

  const achado = (await noViaCep(cep)) ?? (await naBrasilApi(cep));
  if (!achado) return null;

  // CEP geral de cidade (sem logradouro) também é resposta boa e vai para o
  // cache: o cliente digita a quadra, e a próxima consulta não paga o terceiro.
  await gravarCepNoCache(achado);
  return achado;
}
