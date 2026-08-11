import type { ReactNode } from 'react';

import { Card } from '@napo/ui/components/card';

import { exigirAcesso } from '@/features/auth';

export const dynamic = 'force-dynamic';

/**
 * Guarda do painel (RN4). Cliente logado vê recusa explícita em vez de ser
 * mandado para o login: já está autenticado, e fingir que não está confunde
 * quem só errou de endereço (T25).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { acessoNegado } = await exigirAcesso('admin');

  if (acessoNegado) {
    return (
      <div className="grid min-h-dvh place-items-center px-4 py-10">
        <Card className="w-full max-w-[420px] space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Acesso negado</h1>
          <p className="text-sm leading-relaxed text-texto-suave">
            Esta área é da equipe da Napo. Sua conta não tem permissão para abri-la.
          </p>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
