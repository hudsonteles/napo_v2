'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { centavosParaReais } from '@napo/core';

import { temAlergenoCritico, textoContem } from '../alergenos';
import { estadoDoProduto } from '../disponibilidade-view';
import type { ProdutoVitrine } from '../tipos';
import { useDisponibilidade } from './disponibilidade-provider';
import { Disco } from './disco';
import { EstadoDisponibilidade } from './estado-disponibilidade';

/**
 * Card da vitrine — variação A3 (disco em painel, dados em `superficie`). A parte
 * estática (disco, selo de ranking, nome, preço, alérgeno) veio do CDN; a
 * disponibilidade é ilha cliente (RN6). Esgotado na fornada ativa dessatura o
 * disco e entra o carimbo; a área de ação passa a oferecer a próxima fornada.
 */
export function CardProduto({ item }: { item: ProdutoVitrine }) {
  const { produto, precoEfetivoCentavos, fotoUrl } = item;
  const { estado } = useDisponibilidade();

  const contem = textoContem(produto.alergenosContem);
  const critico = temAlergenoCritico(produto.alergenosContem);
  const ranking = produto.rankingMaisPedidas;
  const esgotado =
    estado.status === 'ok' &&
    estadoDoProduto(estado.dias, estado.dataAtiva, produto.id).tipo === 'esgotado';

  return (
    <article className="group flex flex-col overflow-hidden rounded-card border border-borda transition hover:border-borda-forte">
      <Link href={`/sabores/${produto.slug}`} className="block">
        <div className="relative bg-superficie-alta px-6 py-7">
          <Disco fotoUrl={fotoUrl} alt={`Pizza ${produto.nome}`} esmaecido={esgotado} />
          {esgotado ? (
            <div className="absolute inset-0 grid place-items-center">
              <span className="rotate-[-11deg] rounded-sm border-2 border-texto-suave px-4 py-1.5 font-mono text-sm font-bold tracking-[0.22em] text-texto-suave uppercase shadow-[0_0_0_3px_rgba(10,10,10,0.45)]">
                Esgotado
              </span>
            </div>
          ) : ranking ? (
            <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 translate-y-1/2 items-center gap-1.5 rounded-full bg-amarelo px-3 py-1 text-preto ring-4 ring-superficie">
              <span className="text-xs leading-none font-extrabold">{ranking}º</span>
              <span className="font-mono text-[10px] tracking-widest uppercase">mais pedida</span>
            </div>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col bg-superficie p-5 pt-7">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">{produto.nome}</h2>
          <p className="font-mono text-lg font-bold">{centavosParaReais(precoEfetivoCentavos)}</p>
        </div>
        {produto.descricao ? (
          <p className="mt-1.5 text-sm text-texto-suave">{produto.descricao}</p>
        ) : null}
        {contem ? (
          critico ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-erro">
              <AlertTriangle className="h-3.5 w-3.5" /> {contem}
            </p>
          ) : (
            <p className="mt-2 text-xs text-texto-suave">{contem}</p>
          )
        ) : null}

        <EstadoDisponibilidade produtoId={produto.id} />
      </div>
    </article>
  );
}
