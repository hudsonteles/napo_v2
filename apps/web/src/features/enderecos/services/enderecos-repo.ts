import 'server-only';

import type { ExcecaoArea, FaixaFrete } from '@napo/core';
import type { Database } from '@napo/db';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Acesso a dado dos endereços e da configuração de área.
 *
 * **Dois clients, de propósito.** O CRUD de endereço usa o client de SESSÃO, e é
 * a RLS que garante a RN1 — não um `where profile_id = ...` que um `if`
 * esquecido amanhã derruba. Configuração, exceções de CEP e a leitura de equipe
 * usam `service_role`, porque a política de `config_operacao` e `excecoes_area`
 * fecha para cliente: essa informação é da operação, e a decisão de área já
 * chega pronta ao cliente.
 */

export interface ConfigDeArea {
  origem: { lat: number; lng: number };
  raioKm: number;
  freteGratisCentavos: number;
  fatorDistanciaEstimada: number;
  limiteAjustePinM: number;
  faixas: FaixaFrete[];
  excecoes: ExcecaoArea[];
  /** 0=domingo … 6=sábado, para a frase de cobertura (RN17). */
  diasDeEntrega: number[];
}

export async function carregarConfigDeArea(): Promise<ConfigDeArea> {
  const supabase = createSupabaseAdminClient();

  const [config, faixas, excecoes, dias] = await Promise.all([
    supabase
      .from('config_operacao')
      .select(
        'lat_cozinha, lng_cozinha, raio_km, frete_gratis_centavos, fator_distancia_estimada, limite_ajuste_pin_m',
      )
      .single(),
    supabase.from('faixas_frete').select('km_de, km_ate, valor_centavos').order('km_de'),
    supabase.from('excecoes_area').select('tipo, cep_prefixo, motivo'),
    supabase.from('dias_semana_entrega').select('dia_semana').eq('entrega', true),
  ]);

  if (config.error || !config.data) {
    throw new Error('Configuração de operação ausente — o singleton de config_operacao não existe.');
  }

  return {
    origem: { lat: Number(config.data.lat_cozinha), lng: Number(config.data.lng_cozinha) },
    raioKm: Number(config.data.raio_km),
    freteGratisCentavos: config.data.frete_gratis_centavos,
    fatorDistanciaEstimada: Number(config.data.fator_distancia_estimada),
    limiteAjustePinM: config.data.limite_ajuste_pin_m,
    faixas: (faixas.data ?? []).map((f) => ({
      kmDe: Number(f.km_de),
      kmAte: Number(f.km_ate),
      valorCentavos: f.valor_centavos,
    })),
    excecoes: (excecoes.data ?? []).map((e) => ({
      tipo: e.tipo,
      cepPrefixo: e.cep_prefixo,
      motivo: e.motivo,
    })),
    diasDeEntrega: (dias.data ?? []).map((d) => d.dia_semana),
  };
}

const CAMPOS = `
  id, apelido, cep, logradouro, numero, complemento, bairro, cidade, uf, referencia,
  lat, lng, lat_geocode, lng_geocode, distancia_km, distancia_estimada,
  precisa_conferencia, atendido, motivo_nao_atendido, padrao, ativo
`;

type TabelaEnderecos = Database['public']['Tables']['enderecos'];

/**
 * Exatamente as colunas de `CAMPOS`. Derivado do schema gerado, não redigitado:
 * coluna renomeada em migration vira erro de tipo aqui, não linha `undefined`
 * numa tela três camadas adiante.
 */
export type LinhaEndereco = Pick<
  TabelaEnderecos['Row'],
  | 'id'
  | 'apelido'
  | 'cep'
  | 'logradouro'
  | 'numero'
  | 'complemento'
  | 'bairro'
  | 'cidade'
  | 'uf'
  | 'referencia'
  | 'lat'
  | 'lng'
  | 'lat_geocode'
  | 'lng_geocode'
  | 'distancia_km'
  | 'distancia_estimada'
  | 'precisa_conferencia'
  | 'atendido'
  | 'motivo_nao_atendido'
  | 'padrao'
  | 'ativo'
>;

export type InsercaoEndereco = TabelaEnderecos['Insert'];
export type EdicaoEndereco = TabelaEnderecos['Update'];

export async function listarAtivos(): Promise<LinhaEndereco[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('enderecos')
    .select(CAMPOS)
    .eq('ativo', true)
    .order('padrao', { ascending: false })
    .order('created_at');

  return (data ?? []) as never;
}

/** Um endereço ativo do dono, ou `null`. RLS decide — id alheio simplesmente não existe (T16). */
export async function lerAtivo(id: string): Promise<LinhaEndereco | null> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('enderecos')
    .select(CAMPOS)
    .eq('id', id)
    .eq('ativo', true)
    .maybeSingle();

  return (data ?? null) as LinhaEndereco | null;
}

export async function contarAtivos(): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const { count } = await supabase
    .from('enderecos')
    .select('id', { count: 'exact', head: true })
    .eq('ativo', true);

  return count ?? 0;
}

export async function inserir(
  linha: InsercaoEndereco,
): Promise<{ data: LinhaEndereco | null; error: string | null }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.from('enderecos').insert(linha).select(CAMPOS).single();

  return { data: (data ?? null) as LinhaEndereco | null, error: error?.message ?? null };
}

export async function atualizar(id: string, campos: EdicaoEndereco): Promise<LinhaEndereco | null> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('enderecos')
    .update(campos)
    .eq('id', id)
    .eq('ativo', true)
    .select(CAMPOS)
    .maybeSingle();

  return (data ?? null) as LinhaEndereco | null;
}

/**
 * Troca de endereço padrão (RN13).
 *
 * Dois comandos em ordem, não um `update ... set padrao = (id = $1)`: o índice
 * único parcial é verificado linha a linha, e o comando único poderia marcar o
 * novo antes de limpar o antigo, batendo na própria garantia. Desmarcar primeiro
 * nunca viola — no pior caso (queda entre os dois) o cliente fica sem padrão,
 * que a tela mostra sem mentir e um clique resolve.
 */
export async function trocarPadrao(id: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  await supabase.from('enderecos').update({ padrao: false }).eq('padrao', true).eq('ativo', true);

  const { data } = await supabase
    .from('enderecos')
    .update({ padrao: true })
    .eq('id', id)
    .eq('ativo', true)
    .select('id')
    .maybeSingle();

  return data !== null;
}
