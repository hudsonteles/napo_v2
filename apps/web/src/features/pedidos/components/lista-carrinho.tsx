'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@napo/ui/components/button';
import { Card } from '@napo/ui/components/card';
import { SeletorQuantidade } from '@napo/ui/components/seletor-quantidade';
import { cn } from '@napo/ui/lib/cn';

import { useCarrinho } from '@/lib/carrinho/provider';

/**
 * A sacola, ao vivo (RN1, RN2, RN3).
 *
 * Nada de dinheiro é decidido aqui: preço, disponibilidade e dia vêm de
 * `POST /api/carrinho/validar` a cada abertura da página. O que o navegador
 * guarda é só id e quantidade — um carrinho que carrega o próprio preço é um
 * carrinho que escolhe quanto pagar.
 */

interface ItemValidado {
  produtoId: string;
  nome: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  disponivel: number;
  fotoUrl: string | null;
  diametroCm: number | null;
  porcoes: number | null;
}

interface Ajuste {
  produtoId: string;
  tipo: 'esgotado' | 'reduzido';
  de?: number;
  para?: number;
}

interface CarrinhoValidado {
  itens: ItemValidado[];
  ajustes: Ajuste[];
  bloqueado: boolean;
  dia: { data: string; determinadoPor: string } | null;
  foraDoCatalogo: string[];
}

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Tamanho antes de peso: quem compra decide por quantas pessoas comem, não por gramas. */
function medidas(item: ItemValidado): string {
  const partes = [
    item.diametroCm !== null ? `${item.diametroCm} cm` : null,
    item.porcoes !== null ? `serve ${item.porcoes}` : null,
  ].filter(Boolean);

  return partes.join(' · ');
}

function diaPorExtenso(data: string) {
  // `data` é `YYYY-MM-DD`; o `T12:00` evita o recuo de um dia por fuso.
  return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function ListaCarrinho() {
  const { itens, definirQuantidade, remover, pronto } = useCarrinho();
  const [validado, setValidado] = useState<CarrinhoValidado | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!pronto) return;

    if (itens.length === 0) {
      setValidado(null);
      setCarregando(false);
      return;
    }

    let vivo = true;
    setCarregando(true);

    fetch('/api/carrinho/validar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itens: itens.map(({ produtoId, quantidade }) => ({ produtoId, quantidade })) }),
    })
      .then((resposta) => resposta.json())
      .then((corpo) => {
        if (vivo && corpo?.success) setValidado(corpo.data);
      })
      .catch(() => {
        // Sem revalidação não há preço para mostrar: a tela cai no estado de
        // carregamento em vez de exibir número velho como se fosse atual.
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });

    return () => {
      vivo = false;
    };
  }, [itens, pronto]);

  if (!pronto || (carregando && !validado)) {
    return (
      <div className="mt-7 space-y-3" aria-busy>
        {[0, 1].map((linha) => (
          // O esqueleto tem a forma do card que vai chegar — foto, duas linhas de
          // texto e o preço à direita. Um retângulo cinza inteiro anuncia
          // "carregando"; este anuncia *o que* está carregando, e a tela não
          // salta quando o conteúdo entra.
          <Card key={linha} className="flex gap-4 p-4">
            <div className="h-20 w-20 shrink-0 animate-pulse rounded-campo bg-superficie-alta" />
            <div className="flex-1 space-y-2.5 py-1">
              <div className="h-4 w-40 animate-pulse rounded bg-superficie-alta" />
              <div className="h-3 w-24 animate-pulse rounded bg-superficie-alta" />
              <div className="h-11 w-32 animate-pulse rounded-campo bg-superficie-alta" />
            </div>
            <div className="h-4 w-20 animate-pulse rounded bg-superficie-alta" />
          </Card>
        ))}
      </div>
    );
  }

  if (itens.length === 0) {
    return (
      <Card className="mt-7 p-10 text-center">
        <p className="text-texto-suave">Seu carrinho está vazio.</p>
        <Button largura="natural" size="sm" className="mt-5" asChild>
          <Link href="/sabores">Ver sabores</Link>
        </Button>
      </Card>
    );
  }

  const podeAvancar = Boolean(validado && !validado.bloqueado && validado.dia);
  const ajustePor = new Map((validado?.ajustes ?? []).map((ajuste) => [ajuste.produtoId, ajuste]));
  const subtotal = (validado?.itens ?? []).reduce(
    (total, item) => total + item.precoUnitarioCentavos * item.quantidade,
    0,
  );

  return (
    <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {(validado?.itens ?? []).map((item) => {
          const ajuste = ajustePor.get(item.produtoId);
          const esgotado = ajuste?.tipo === 'esgotado';

          return (
            <Card
              key={item.produtoId}
              className={cn('flex gap-4 p-4', esgotado && 'opacity-60')}
            >
              {item.fotoUrl ? (
                <Image
                  src={item.fotoUrl}
                  alt={item.nome}
                  width={80}
                  height={80}
                  className="h-20 w-20 shrink-0 rounded-campo object-cover"
                />
              ) : (
                // Produto sem ensaio ainda (NAPO-020) mantém a proporção.
                <div className="h-20 w-20 shrink-0 rounded-campo bg-superficie-alta" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{item.nome}</h2>
                <p className="mt-0.5 font-mono text-xs text-texto-suave">{medidas(item)}</p>

                <div className="mt-3 flex items-center gap-3">
                  <SeletorQuantidade
                    valor={item.quantidade}
                    max={Math.max(item.disponivel, item.quantidade)}
                    onChange={(valor) => definirQuantidade(item.produtoId, valor)}
                    disabled={esgotado}
                  />
                  <Button
                    variant="ghost"
                    size="link"
                    largura="natural"
                    onClick={() => remover(item.produtoId)}
                    className="text-xs hover:text-erro"
                  >
                    remover
                  </Button>
                </div>

                {ajuste?.tipo === 'esgotado' && (
                  <p className="mt-2.5 font-mono text-xs text-erro">esgotado nesta fornada</p>
                )}
                {ajuste?.tipo === 'reduzido' && (
                  <p className="mt-2.5 font-mono text-xs text-amarelo">
                    só {ajuste.para} {ajuste.para === 1 ? 'unidade cabe' : 'unidades cabem'} nesta
                    fornada — confirme para seguir
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-bold">
                  {reais(item.precoUnitarioCentavos * item.quantidade)}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-texto-suave">
                  {reais(item.precoUnitarioCentavos)} cada
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="h-fit p-5">
        {/* O dia é derivado (RN2) e vem com o motivo — não é seletor. */}
        <div className="rounded-campo border border-borda-forte bg-superficie-alta p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-texto-suave">Entrega</p>
          <p className="mt-1 font-bold">
            {validado?.dia ? diaPorExtenso(validado.dia.data) : 'sem fornada disponível'}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-texto-suave">
            {validado?.dia
              ? 'É a primeira fornada que assa todos os seus sabores.'
              : 'Nenhuma fornada do horizonte comporta este carrinho inteiro.'}
          </p>
        </div>

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-texto-suave">Subtotal</dt>
            <dd className="font-mono">{reais(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            {/* O frete depende do endereço, escolhido no checkout: um valor que
                muda depois é pior que nenhum valor agora (design §4.2). */}
            <dt className="text-texto-suave">Frete</dt>
            <dd className="font-mono text-texto-suave">no próximo passo</dd>
          </div>
        </dl>

        {podeAvancar ? (
          <Button className="mt-5" asChild>
            <Link href="/checkout">
              Finalizar pedido <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button className="mt-5" disabled>
            Finalizar pedido <ArrowRight className="h-4 w-4" />
          </Button>
        )}

        <p className="mt-2.5 text-center text-[11px] leading-relaxed text-texto-suave">
          {validado?.bloqueado
            ? 'Ajuste os itens marcados para seguir.'
            : 'Você entra na conta no próximo passo.'}
        </p>
      </Card>
    </div>
  );
}
