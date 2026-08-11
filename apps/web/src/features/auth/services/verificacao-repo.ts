import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Acesso aos dados do desafio de OTP, isolado da orquestração.
 *
 * Separado de `verificacao.ts` porque as regras (teto, expiração, tentativa)
 * precisam ser testáveis sem simular o PostgREST inteiro — e porque toda esta
 * camada roda com `service_role`, o que merece um arquivo com fronteira nítida.
 */

export interface Desafio {
  id: string;
  telefone: string;
  codigoHash: string;
  tentativas: number;
  expiraEm: Date;
  validadoEm: Date | null;
  criadoEm: Date;
}

/** Violação de unicidade no Postgres. É a corrida da RN9 chegando pelo erro. */
const ERRO_UNICIDADE = '23505';

export async function contarEnviosPorNumero(telefone: string, desde: Date): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from('telefone_verificacoes')
    .select('id', { count: 'exact', head: true })
    .eq('telefone', telefone)
    .gte('created_at', desde.toISOString())
    .is('invalidado_em', null);

  return count ?? 0;
}

export async function contarEnviosPorIp(ip: string | null, desde: Date): Promise<number> {
  if (!ip) return 0;

  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from('telefone_verificacoes')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', desde.toISOString())
    .is('invalidado_em', null);

  return count ?? 0;
}

export async function ultimoDesafioDoPerfil(perfilId: string): Promise<Desafio | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('telefone_verificacoes')
    .select('id, telefone, codigo_hash, tentativas, expira_em, validado_em, created_at')
    .eq('profile_id', perfilId)
    .is('invalidado_em', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    telefone: data.telefone,
    codigoHash: data.codigo_hash,
    tentativas: data.tentativas,
    expiraEm: new Date(data.expira_em),
    validadoEm: data.validado_em ? new Date(data.validado_em) : null,
    criadoEm: new Date(data.created_at),
  };
}

export async function telefoneValidadoPorOutraConta(
  telefone: string,
  perfilId: string,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('telefone', telefone)
    .not('telefone_validado_em', 'is', null)
    .neq('id', perfilId)
    .maybeSingle();

  return data !== null;
}

export async function gravarDesafio(entrada: {
  perfilId: string;
  telefone: string;
  codigoHash: string;
  expiraEm: Date;
  ip: string | null;
}): Promise<{ id: string; expiraEm: Date }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('telefone_verificacoes')
    .insert({
      profile_id: entrada.perfilId,
      telefone: entrada.telefone,
      codigo_hash: entrada.codigoHash,
      expira_em: entrada.expiraEm.toISOString(),
      ip: entrada.ip,
    })
    .select('id, expira_em')
    .single();

  if (error || !data) {
    throw new Error(`Não foi possível gravar o desafio: ${error?.code ?? 'sem retorno'}`);
  }

  return { id: data.id, expiraEm: new Date(data.expira_em) };
}

export async function invalidarDesafio(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('telefone_verificacoes')
    .update({ invalidado_em: new Date().toISOString() })
    .eq('id', id);
}

export async function registrarTentativa(id: string, tentativas: number): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from('telefone_verificacoes').update({ tentativas }).eq('id', id);
}

export async function concluirDesafio(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('telefone_verificacoes')
    .update({ validado_em: new Date().toISOString() })
    .eq('id', id);
}

export async function atualizarNome(perfilId: string, nome: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from('profiles').update({ nome }).eq('id', perfilId);
}

/**
 * RN9, RN10. A unicidade é decidida pelo índice parcial, não por leitura prévia:
 * duas abas conferindo o mesmo número passam pelo mesmo `update` e exatamente
 * uma sai com sucesso (T44).
 */
export async function marcarTelefoneValidado(
  perfilId: string,
  telefone: string,
): Promise<{ conflito: boolean }> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('profiles')
    .update({ telefone, telefone_validado_em: new Date().toISOString() })
    .eq('id', perfilId);

  if (error?.code === ERRO_UNICIDADE) return { conflito: true };
  if (error) throw new Error(`Falha ao validar telefone: ${error.code}`);

  return { conflito: false };
}
