import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import {
  caminhoInternoSeguro,
  decidirAcesso,
  ROTA_ENTRAR,
  ROTA_VALIDAR_TELEFONE,
  type AreaProtegida,
  type PerfilSessao,
} from '../destino';

// Espelha o client de servidor em vez de reconstruir o genérico do supabase-js:
// o tipo do schema já vive na factory, e duplicá-lo diverge na primeira migration.
type Cliente = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function lerPerfil(supabase: Cliente, id: string): Promise<PerfilSessao | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, role, telefone_validado_em')
    .eq('id', id)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    papel: data.role,
    telefoneValidado: data.telefone_validado_em !== null,
  };
}

/**
 * Perfil da sessão atual, criando-o no primeiro login (RN13).
 *
 * O `insert` **não** carrega `role`: o default do banco é `cliente` e o trigger
 * do NAPO-001 barra promoção. Papel vindo da requisição é ignorado por omissão —
 * não existe caminho em que ele seja lido (T28).
 *
 * O perfil nasce aqui, e não em trigger de `auth.users`, porque o trigger roda
 * fora do contexto da requisição e falha em silêncio (design §3.1).
 */
export async function garantirPerfil(supabase: Cliente): Promise<PerfilSessao | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const existente = await lerPerfil(supabase, user.id);
  if (existente) return existente;

  const metadados = user.user_metadata as { full_name?: string; name?: string } | null;

  const { error } = await supabase.from('profiles').insert({
    id: user.id,
    email: user.email ?? null,
    nome: metadados?.full_name ?? metadados?.name ?? null,
  });

  if (error) return null;

  return lerPerfil(supabase, user.id);
}

export async function carregarPerfilDaSessao(): Promise<PerfilSessao | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return lerPerfil(supabase, user.id);
}

/**
 * Guarda de layout de servidor. O middleware já barrou quem não tem sessão; aqui
 * o papel e o telefone são conferidos **contra o banco**, não contra o token —
 * claim em JWT fica velha até o refresh, e quem acabou de validar o telefone
 * continuaria barrado (design §5).
 *
 * `sem-permissao` não redireciona: quem está logado e não pode entrar precisa
 * ver isso dito, não ser tratado como anônimo (T25).
 */
export async function exigirAcesso(
  area: AreaProtegida,
  /**
   * Para onde voltar depois de resolver a pendência. Sem isso, quem é
   * interrompido no meio do pagamento para validar o telefone termina o
   * cadastro e é despejado na área da conta — do lado errado da compra que
   * estava fazendo.
   */
  proximo?: string,
): Promise<{ perfil: PerfilSessao; acessoNegado: boolean }> {
  const perfil = await carregarPerfilDaSessao();
  const acesso = decidirAcesso(perfil, area);

  if (acesso.permitido && perfil) {
    return { perfil, acessoNegado: false };
  }

  const comRetorno = (rota: string) => {
    const interno = caminhoInternoSeguro(proximo);
    return interno ? `${rota}?proximo=${encodeURIComponent(interno)}` : rota;
  };

  if (!perfil || (!acesso.permitido && acesso.motivo === 'sem-sessao')) {
    redirect(comRetorno(ROTA_ENTRAR));
  }

  if (!acesso.permitido && acesso.motivo === 'telefone-pendente') {
    redirect(comRetorno(ROTA_VALIDAR_TELEFONE));
  }

  return { perfil, acessoNegado: true };
}
