import type { Metadata } from 'next';

import { FormEntrar } from '@/features/auth/components/form-entrar';

export const metadata: Metadata = {
  title: 'Entrar — Napo',
  description: 'Entre com um link no seu e-mail ou com a sua conta Google.',
};

/**
 * Rota pública (RN1). Quem já tem sessão e cai aqui não é redirecionado: trocar
 * de conta é um caminho legítimo, e o middleware só barra o inverso.
 */
export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string; erro?: string }>;
}) {
  const { proximo, erro } = await searchParams;

  return (
    // Markup cru declarado em design.md §4.4.4: centralização da página.
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <FormEntrar proximo={proximo ?? null} erro={erro ?? null} />
    </div>
  );
}
