'use client';

import { useEffect, useState } from 'react';
import { CircleUserRound } from 'lucide-react';
import { cn } from '@napo/ui/lib/cn';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Porta de entrada para a conta no cabeçalho.
 *
 * **Ilha cliente de propósito.** Ler a sessão no servidor exigiria `cookies()`,
 * que tira o `(site)` do estático — e o SSG da vitrine é decisão de custo
 * declarada (`ARCHITECTURE.md` §4.5). Aqui a sessão é lida no navegador, pelo
 * mesmo cookie, sem tocar em nenhuma página prerenderizada.
 *
 * Enquanto não sabe, não afirma: nada é renderizado no lugar. Mostrar "Entrar"
 * para quem está logado, e trocar meio segundo depois, é pior que esperar.
 */
export function AcessoConta({ className }: { className?: string }) {
  const [autenticado, setAutenticado] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let vivo = true;

    supabase.auth.getUser().then(({ data }) => {
      if (vivo) setAutenticado(data.user !== null);
    });

    // Entrar ou sair em outra aba muda o cabeçalho desta também.
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      if (vivo) setAutenticado(sessao?.user !== undefined && sessao?.user !== null);
    });

    return () => {
      vivo = false;
      assinatura.subscription.unsubscribe();
    };
  }, []);

  if (autenticado === null) {
    return <span className={cn('block h-11 w-11', className)} aria-hidden />;
  }

  if (!autenticado) {
    return (
      <a
        href="/entrar"
        className={cn(
          'rounded-campo px-3 py-2 text-sm text-texto-suave transition hover:bg-superficie-alta hover:text-branco',
          className,
        )}
      >
        Entrar
      </a>
    );
  }

  return (
    <a
      href="/conta"
      aria-label="Minha conta"
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-campo text-texto-suave transition hover:bg-superficie-alta hover:text-branco',
        className,
      )}
    >
      <CircleUserRound className="h-5 w-5" />
    </a>
  );
}
