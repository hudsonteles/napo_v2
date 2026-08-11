import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * RN15. Grava o aceite apontando para a **versão do texto**, não para um
 * booleano: "aceitou os termos" sem dizer quais termos não prova nada.
 *
 * Marketing é linha própria e só existe se pedida — consentimento embutido em
 * outro aceite não é consentimento livre.
 */
export async function registrarConsentimentos({
  perfilId,
  ip,
  marketing,
}: {
  perfilId: string;
  ip: string | null;
  marketing: boolean;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { data: versoes, error } = await supabase
    .from('termos_versoes')
    .select('tipo, versao')
    .eq('vigente', true);

  if (error || !versoes) {
    throw new Error(`Versões de termos indisponíveis: ${error?.code ?? 'sem retorno'}`);
  }

  const tiposAceitos: readonly string[] = marketing
    ? ['termos', 'privacidade', 'marketing']
    : ['termos', 'privacidade'];

  const linhas = versoes
    .filter((versao) => tiposAceitos.includes(versao.tipo))
    .map((versao) => ({
      profile_id: perfilId,
      tipo: versao.tipo,
      versao: versao.versao,
      ip,
    }));

  // Reaceitar a mesma versão é ruído: o índice único decide, o upsert ignora.
  const { error: erroGravacao } = await supabase
    .from('consentimentos')
    .upsert(linhas, { onConflict: 'profile_id,tipo,versao', ignoreDuplicates: true });

  if (erroGravacao) {
    throw new Error(`Falha ao registrar consentimento: ${erroGravacao.code}`);
  }
}
