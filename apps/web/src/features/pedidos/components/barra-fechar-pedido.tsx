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
    // Ilha do tamanho do conteúdo, centralizada acima do rodapé. Uma faixa de
    // ponta a ponta pesa como barra de sistema e rouba a atenção do produto —
    // que é o que a pessoa veio ver.
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-4 rounded-card border border-borda-forte bg-preto/95 py-2.5 pl-4 pr-2.5 shadow-2xl shadow-black/50 backdrop-blur">
        <p className="flex items-center gap-2.5">
          <ShoppingBag className="h-4 w-4 shrink-0 text-amarelo" />
          {/* Duas linhas: o número é o dado, "na sacola" é o rótulo dele. */}
          <span className="leading-tight">
            <span className="block font-mono text-sm font-bold">
              {quantidadeTotal} {quantidadeTotal === 1 ? 'pizza' : 'pizzas'}
            </span>
            <span className="block text-[11px] text-texto-suave">na sacola</span>
          </span>
        </p>

        <Button largura="natural" size="sm" asChild>
          <Link href="/carrinho">
            Fechar pedido <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
