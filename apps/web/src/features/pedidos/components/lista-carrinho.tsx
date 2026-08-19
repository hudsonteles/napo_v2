'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ShoppingBag } from 'lucide-react';

import { Button } from '@napo/ui/components/button';
import { SeletorQuantidade } from '@napo/ui/components/seletor-quantidade';

import { useCarrinho } from '@/lib/carrinho/provider';

import {
  formatarCentavos,
  formatarDiaBarra,
  formatarFornadaExtenso,
  montarVistaCarrinho,
  type ItemRevalidado,
  type LinhaCarrinho,
  type ProdutoParaExibir,
} from '../carrinho-view';

interface RespostaValidar {
  itens: ItemRevalidado[];
  dia: { data: string; determinadoPor: string } | null;
}

/**
 * A tela do carrinho: junta o que o navegador guarda com o catálogo (via
 * `props`) e revalida preço e vaga no servidor (`POST /api/carrinho/validar`,
 * sem sessão — RN1). Frete não aparece aqui (só no checkout, RN18); o dia é
 * derivado e vem com o motivo (RN2); item esgotado é sinalizado e trava o
 * avanço (T41). Contrato visual: `docs/specs/006-checkout/preview.html` §A.
 */
export function ListaCarrinho({ catalogo }: { catalogo: ProdutoParaExibir[] }) {
  const { itens, definirQuantidade, remover, pronto } = useCarrinho();
  const [resp, setResp] = useState<RespostaValidar | null>(null);
  const [erro, setErro] = useState(false);

  const chave = useMemo(() => itens.map((i) => `${i.produtoId}:${i.quantidade}`).join('|'), [itens]);

  useEffect(() => {
    if (!pronto) return;
    if (itens.length === 0) {
      setResp({ itens: [], dia: null });
      setErro(false);
      return;
    }

    let vivo = true;
    setErro(false);
    fetch('/api/carrinho/validar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })) }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((json) => {
        if (!vivo) return;
        if (!json?.success) {
          setErro(true);
          return;
        }
        setResp(json.data);
      })
      .catch(() => {
        if (vivo) setErro(true);
      });

    return () => {
      vivo = false;
    };
    // `chave` resume itens (id+quantidade); revalida a cada mudança real.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, chave]);

  if (!pronto) {
    return <div className="mt-7 h-64 animate-pulse rounded-card bg-superficie" aria-hidden />;
  }

  if (itens.length === 0) {
    return <CarrinhoVazio />;
  }

  const vista = montarVistaCarrinho(itens, catalogo, resp?.itens ?? null);
  const dia = resp?.dia ?? null;

  return (
    <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {erro && (
          <div className="rounded-card border border-erro/40 bg-erro/5 p-4 text-sm leading-relaxed text-texto-suave">
            Não foi possível confirmar preços e disponibilidade agora. Recarregue a página para tentar de novo.
          </div>
        )}

        {vista.linhas.map((linha) =>
          linha.esgotado ? (
            <ItemEsgotado key={linha.produtoId} linha={linha} dia={dia?.data ?? null} onRemover={() => remover(linha.produtoId)} />
          ) : (
            <ItemCarrinhoCard
              key={linha.produtoId}
              linha={linha}
              onQuantidade={(q) => definirQuantidade(linha.produtoId, q)}
              onRemover={() => remover(linha.produtoId)}
            />
          ),
        )}
      </div>

      <aside className="h-fit rounded-card border border-borda bg-superficie p-5">
        {dia && (
          <div className="rounded-campo border border-borda-forte bg-superficie-alta p-3.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-texto-suave">Entrega</p>
            <p className="mt-1 font-bold capitalize">{formatarFornadaExtenso(dia.data)}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-texto-suave">
              É a primeira fornada que assa todos os seus sabores.
            </p>
          </div>
        )}

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-texto-suave">Subtotal</dt>
            <dd className="font-mono">
              {vista.subtotalCentavos != null ? (
                formatarCentavos(vista.subtotalCentavos)
              ) : (
                <span className="inline-block h-4 w-16 animate-pulse rounded bg-superficie-alta align-middle" aria-hidden />
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-texto-suave">Frete</dt>
            <dd className="font-mono text-texto-suave">no próximo passo</dd>
          </div>
        </dl>

        {vista.podeFinalizar ? (
          <Button asChild className="mt-5">
            <Link href="/checkout">
              Finalizar pedido <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button disabled className="mt-5">
            Finalizar pedido
          </Button>
        )}

        {vista.temEsgotado && (
          <p className="mt-2 text-center text-[11px] text-erro">
            Remova o item esgotado para seguir.
          </p>
        )}
        <p className="mt-2.5 text-center text-[11px] leading-relaxed text-texto-suave">
          Você entra na conta no próximo passo.
        </p>
      </aside>
    </div>
  );
}

function FotoItem({ fotoUrl, tamanho }: { fotoUrl: string | null; tamanho: string }) {
  if (fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- foto pré-otimizada servida do CDN (design §5)
      <img src={fotoUrl} alt="" className={`${tamanho} shrink-0 rounded-campo object-cover`} />
    );
  }
  return (
    <div className={`${tamanho} flex shrink-0 items-center justify-center rounded-campo bg-superficie-alta text-borda-forte`} aria-hidden>
      <ShoppingBag className="h-6 w-6" />
    </div>
  );
}

function ItemCarrinhoCard({
  linha,
  onQuantidade,
  onRemover,
}: {
  linha: LinhaCarrinho;
  onQuantidade: (q: number) => void;
  onRemover: () => void;
}) {
  return (
    <article className="flex gap-4 rounded-card border border-borda bg-superficie p-4">
      <FotoItem fotoUrl={linha.fotoUrl} tamanho="h-20 w-20" />
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">{linha.nome}</h2>
        <p className="mt-0.5 font-mono text-xs text-texto-suave">
          {linha.faixaNome}
          {linha.pesoG != null ? ` · ${linha.pesoG} g` : ''}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <SeletorQuantidade
            valor={linha.quantidade}
            max={linha.disponivel ?? linha.quantidade}
            onChange={onQuantidade}
          />
          <Button variant="ghost" size="sm" largura="natural" onClick={onRemover} className="px-2 text-xs hover:text-erro">
            remover
          </Button>
        </div>
      </div>
      <div className="text-right">
        {linha.totalLinhaCentavos != null ? (
          <>
            <p className="font-mono text-sm font-bold">{formatarCentavos(linha.totalLinhaCentavos)}</p>
            <p className="mt-0.5 font-mono text-[11px] text-texto-suave">
              {formatarCentavos(linha.precoUnitarioCentavos!)} cada
            </p>
          </>
        ) : (
          <span className="inline-block h-4 w-16 animate-pulse rounded bg-superficie-alta" aria-hidden />
        )}
      </div>
    </article>
  );
}

function ItemEsgotado({ linha, dia, onRemover }: { linha: LinhaCarrinho; dia: string | null; onRemover: () => void }) {
  return (
    <div className="rounded-card border border-borda bg-superficie p-4">
      <article className="flex gap-4 opacity-50">
        <FotoItem fotoUrl={linha.fotoUrl} tamanho="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{linha.nome}</h3>
          <p className="mt-0.5 font-mono text-xs text-erro">
            esgotado{dia ? ` na fornada de ${formatarDiaBarra(dia)}` : ' nesta fornada'}
          </p>
        </div>
      </article>
      <div className="mt-3">
        <Button size="sm" largura="natural" onClick={onRemover}>
          Remover e seguir
        </Button>
      </div>
    </div>
  );
}

function CarrinhoVazio() {
  return (
    <div className="mt-7 rounded-card border border-borda bg-superficie px-6 py-12 text-center">
      <ShoppingBag className="mx-auto h-8 w-8 text-borda-forte" />
      <p className="mt-3 font-semibold">Seu carrinho está vazio</p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-texto-suave">
        Ainda dá tempo de entrar na próxima fornada.
      </p>
      <Button asChild largura="natural" className="mt-4">
        <Link href="/sabores">Ver sabores</Link>
      </Button>
    </div>
  );
}
