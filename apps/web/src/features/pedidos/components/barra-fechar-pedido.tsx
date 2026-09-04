'use client';

import { useEffect, useState } from 'react';
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
 * O valor é **subtotal**, rotulado como tal: o frete depende do endereço e só
 * existe no checkout. Número sem rótulo aqui viraria promessa de total.
 */
const reais = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function BarraFecharPedido() {
  const { itens, quantidadeTotal, pronto } = useCarrinho();
  const [subtotalCentavos, setSubtotalCentavos] = useState<number | null>(null);

  useEffect(() => {
    if (!pronto || itens.length === 0) {
      setSubtotalCentavos(null);
      return;
    }

    let vivo = true;

    // O navegador guarda id e quantidade, nunca preço (RN3): o subtotal é
    // sempre apurado pelo servidor, mesmo para um número de rodapé.
    fetch('/api/carrinho/validar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        itens: itens.map(({ produtoId, quantidade }) => ({ produtoId, quantidade })),
      }),
    })
      .then((resposta) => resposta.json())
      .then((corpo) => {
        if (!vivo || !corpo?.success) return;

        setSubtotalCentavos(
          (corpo.data.itens as { precoUnitarioCentavos: number; quantidade: number }[]).reduce(
            (total, item) => total + item.precoUnitarioCentavos * item.quantidade,
            0,
          ),
        );
      })
      .catch(() => {
        // Sem preço conferido, a barra continua sem número — nunca com um velho.
      });

    return () => {
      vivo = false;
    };
  }, [itens, pronto]);

  if (!pronto || quantidadeTotal === 0) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-borda-forte bg-preto/95 backdrop-blur">
        {/* Container estreito: a barra atravessa a tela, mas o conteúdo fica
            junto no centro — informação nas pontas de uma faixa de 1200 px
            obriga a varrer a tela para ligar o valor ao botão. */}
        <div className="mx-auto flex max-w-md items-center justify-between gap-4 px-4 py-3">
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

          <div className="flex items-center gap-4">
            {subtotalCentavos !== null && (
              <p className="hidden text-right leading-tight whitespace-nowrap sm:block">
                <span className="block font-mono text-base font-bold">
                  {reais(subtotalCentavos)}
                </span>
                <span className="block text-xs text-texto-suave">sem frete</span>
              </p>
            )}

            <Button largura="natural" size="sm" className="shrink-0" asChild>
              <Link href="/carrinho">
                Fechar pedido <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* A barra é fixa e cobriria o fim da página; este espaçador devolve o
          espaço para o rodapé continuar alcançável. */}
      <div className="h-[76px]" aria-hidden />
    </>
  );
}
