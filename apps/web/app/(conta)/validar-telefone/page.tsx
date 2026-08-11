import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { carregarPerfilDaSessao, ROTA_ENTRAR } from '@/features/auth';
import { FormValidarTelefone } from '@/features/auth/components/form-validar-telefone';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Confirme seu WhatsApp — Napo',
};

/**
 * Gate de telefone (RN3). Exige sessão, mas **não** exige telefone validado: é a
 * tela que o cliente sem número precisa conseguir abrir. Também é o caminho de
 * troca de número (RN10), então quem já validou não é expulso daqui.
 */
export default async function ValidarTelefonePage() {
  const perfil = await carregarPerfilDaSessao();
  if (!perfil) redirect(ROTA_ENTRAR);

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('profiles')
    .select('nome, telefone')
    .eq('id', perfil.id)
    .maybeSingle();

  return (
    // Markup cru declarado em design.md §4.4.4: centralização da página.
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <FormValidarTelefone nomeInicial={data?.nome ?? ''} telefoneInicial={data?.telefone ?? ''} />
    </div>
  );
}
