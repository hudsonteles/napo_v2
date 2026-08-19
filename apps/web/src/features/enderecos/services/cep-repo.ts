import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import type { EnderecoDeCep, FonteCep } from './cep';

/**
 * Acesso ao cache de CEP. Separado de `cep.ts` para a lógica de fallback entre
 * provedores ser testável sem banco — a decisão de qual provedor vale é o que
 * pode errar, não o `select`.
 *
 * Usa o client de `service_role`: a tabela é escrita pelo servidor e o cliente
 * só lê. Nenhum dado daqui é PII — logradouro é informação pública.
 */

export async function lerCepDoCache(cep: string): Promise<EnderecoDeCep | null> {
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from('ceps')
    .select('cep, logradouro, bairro, cidade, uf, fonte')
    .eq('cep', cep)
    .maybeSingle();

  if (!data) return null;

  return {
    cep: data.cep,
    logradouro: data.logradouro,
    bairro: data.bairro,
    cidade: data.cidade,
    uf: data.uf,
    fonte: data.fonte as FonteCep,
  };
}

export async function gravarCepNoCache(endereco: EnderecoDeCep): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // `upsert`: dois cadastros simultâneos com o mesmo CEP não podem virar erro de
  // chave duplicada numa tela que o cliente está preenchendo.
  await supabase.from('ceps').upsert(
    {
      cep: endereco.cep,
      logradouro: endereco.logradouro,
      bairro: endereco.bairro,
      cidade: endereco.cidade,
      uf: endereco.uf,
      fonte: endereco.fonte,
    },
    { onConflict: 'cep' },
  );
}
