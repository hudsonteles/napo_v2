'use client';

import { ArrowRight, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@napo/ui/components/button';

import { useCarrinho } from '@/lib/carrinho/provider';

/**
 * Atalho para fechar o pedido, fixo no rodapé da vitrine.
 *
 * Some quando o carrinho está vazio: barra permanente vira moldura e para de
 * ser vista. Ela aparece **porque** a pessoa já escolheu algo — é lembrete do
 * que ela fez, não anúncio do que ela deveria fazer.
 *
 * Não mostra preço: o valor final depende do frete, que depende do endereço, e
 * um número aqui que muda no checkout é pior que número nenhum (design §4.2).
 */
export function BarraFecharPedido() {
  const { quantidadeTotal, pronto } = useCarrinho();

  if (!pronto || quantidadeTotal === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-preto/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <p className="flex min-w-0 items-center gap-2 text-sm">
          <ShoppingBag className="h-4 w-4 shrink-0 text-amarelo" />
          <span className="font-mono">
            {quantidadeTotal} {quantidadeTotal === 1 ? 'pizza' : 'pizzas'}
          </span>
          <span className="hidden text-texto-suave sm:inline">na sacola</span>
        </p>

        <Button largura="natural" size="sm" className="ml-auto" asChild>
          <Link href="/carrinho">
            Fechar pedido <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
