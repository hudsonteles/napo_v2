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
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-borda-forte bg-preto/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3 sm:px-8">
          <p className="flex items-center gap-3">
            <ShoppingBag className="h-5 w-5 shrink-0 text-amarelo" />
            {/* `whitespace-nowrap` em cada linha: sem isso o flex espreme a
                coluna e "3 pizzas" quebra de novo, virando quatro linhas. */}
            <span className="leading-tight whitespace-nowrap">
              <span className="block font-mono text-base font-bold">
                {quantidadeTotal} {quantidadeTotal === 1 ? 'pizza' : 'pizzas'}
              </span>
              <span className="block text-xs text-texto-suave">na sacola</span>
            </span>
          </p>

          <Button largura="natural" className="shrink-0 px-6" asChild>
            <Link href="/carrinho">
              Fechar pedido <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* A barra é fixa e cobriria o fim da página; este espaçador devolve o
          espaço para o rodapé continuar alcançável. */}
      <div className="h-[76px]" aria-hidden />
    </>
  );
}
