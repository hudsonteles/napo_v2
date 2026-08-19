'use client';

import { ShoppingBag } from 'lucide-react';

import { cn } from '../lib/cn';

/**
 * Acesso ao carrinho no cabeçalho: ícone com contador sobreposto (design §4.4.4).
 * Presentacional de propósito — mora em `packages/ui` porque o cabeçalho é do
 * catálogo e não pode importar uma feature do app; o estado do carrinho
 * (`localStorage`) chega por prop, ligado no app. Alvo de toque de 44px.
 *
 * O contador SOME quando o carrinho está vazio (só o ícone, nunca "0"): estado
 * vazio é ausência de número, não zero na cara (critério visual 7). Espera a
 * hidratação (`pronto`) para não piscar um contador antes de ler o navegador.
 */
export interface AcessoCarrinhoProps {
  totalUnidades: number;
  /** `false` até a leitura do `localStorage` — evita piscar o contador. */
  pronto: boolean;
  href?: string;
  className?: string;
}

export function AcessoCarrinho({ totalUnidades, pronto, href = '/carrinho', className }: AcessoCarrinhoProps) {
  const mostrarContador = pronto && totalUnidades > 0;

  return (
    <a
      href={href}
      aria-label={
        mostrarContador
          ? `Carrinho com ${totalUnidades} ${totalUnidades === 1 ? 'item' : 'itens'}`
          : 'Carrinho'
      }
      className={cn(
        'relative ml-1 flex h-11 w-11 items-center justify-center rounded-campo text-branco transition hover:bg-superficie-alta',
        className,
      )}
    >
      <ShoppingBag className="h-5 w-5" />
      {mostrarContador && (
        <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amarelo px-1 font-mono text-[10px] font-bold text-preto tabular-nums">
          {totalUnidades}
        </span>
      )}
    </a>
  );
}
