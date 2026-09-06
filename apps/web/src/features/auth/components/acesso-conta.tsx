'use client';

import { useEffect, useRef, useState } from 'react';
import { CircleUserRound, LogOut, MapPin, ReceiptText, UserRound } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@napo/ui/components/dropdown-menu';
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
  const [email, setEmail] = useState<string | null>(null);
  const sairRef = useRef<HTMLFormElement>(null);
  const [autenticado, setAutenticado] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let vivo = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!vivo) return;
      setAutenticado(data.user !== null);
      setEmail(data.user?.email ?? null);
    });

    // Entrar ou sair em outra aba muda o cabeçalho desta também.
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      if (!vivo) return;
      setAutenticado(Boolean(sessao?.user));
      setEmail(sessao?.user?.email ?? null);
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
      <Link
        href="/entrar"
        className={cn(
          'rounded-campo px-3 py-2 text-sm text-texto-suave transition hover:bg-superficie-alta hover:text-branco',
          className,
        )}
      >
        Entrar
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Minha conta"
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-campo text-texto-suave transition hover:bg-superficie-alta hover:text-branco data-[state=open]:bg-superficie-alta data-[state=open]:text-branco',
          className,
        )}
      >
        <CircleUserRound className="h-5 w-5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {email && <DropdownMenuLabel>{email}</DropdownMenuLabel>}

        <DropdownMenuItem asChild>
          <Link href="/conta">
            <UserRound className="h-4 w-4" /> Meu perfil
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/conta/enderecos">
            <MapPin className="h-4 w-4" /> Endereços
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/conta/pedidos">
            <ReceiptText className="h-4 w-4" /> Meus pedidos
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Sair é POST: por GET, qualquer prefetch do navegador derrubaria a
            sessão sem ninguém ter clicado.
 
            O formulário fica FORA do item de propósito. Dentro dele, o Radix
            fecha o menu ao selecionar e desmonta o item antes de o navegador
            terminar a submissão — o clique parecia não fazer nada. Aqui o item
            só dispara o envio, e quem submete é um formulário que continua
            montado. */}
        <DropdownMenuItem
          onSelect={(evento) => {
            evento.preventDefault();
            sairRef.current?.requestSubmit();
          }}
        >
          <LogOut className="h-4 w-4" /> Sair
        </DropdownMenuItem>

        <form ref={sairRef} action="/api/auth/sair" method="post" className="hidden" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
