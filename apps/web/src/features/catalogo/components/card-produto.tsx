import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { centavosParaReais } from '@napo/core';
import { Button } from '@napo/ui/components/button';
import { SeletorQuantidade } from '@napo/ui/components/seletor-quantidade';

import { temAlergenoCritico, textoContem } from '../alergenos';
import type { ProdutoVitrine } from '../tipos';
import { Disco } from './disco';

/**
 * Card da vitrine — variação A3 (disco em painel `superficie-alta`, dados em
 * `superficie`). Parte estática servida do CDN: disco, selo de ranking, nome,
 * preço, alérgeno. A disponibilidade ao vivo (quantidade, esgotado) é ilha
 * cliente do bloco G — aqui o rodapé é neutro e honesto (canal ainda fechado).
 *
 * O alérgeno fica junto do preço/CTA e SEMPRE em texto (RN3/§4.7); o vermelho é
 * reforço para os críticos, nunca o único sinal.
 */
export function CardProduto({ item }: { item: ProdutoVitrine }) {
  const { produto, precoEfetivoCentavos, fotoUrl } = item;
  const contem = textoContem(produto.alergenosContem);
  const critico = temAlergenoCritico(produto.alergenosContem);
  const ranking = produto.rankingMaisPedidas;

  return (
    <article className="group flex flex-col overflow-hidden rounded-card border border-borda transition hover:border-borda-forte">
      <Link href={`/sabores/${produto.slug}`} className="block">
        <div className="relative bg-superficie-alta px-6 py-7">
          <Disco fotoUrl={fotoUrl} alt={`Pizza ${produto.nome}`} />
          {ranking ? (
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

        <div className="mt-5 flex items-center gap-2">
          <SeletorQuantidade valor={1} onChange={() => {}} max={1} disabled />
          <Button
            disabled
            size="sm"
            className="flex-1 bg-superficie-alta font-semibold text-neutral-500"
          >
            Adicionar
          </Button>
        </div>
        <p className="mt-2.5 font-mono text-xs text-texto-suave">pedido online em breve</p>
      </div>
    </article>
  );
}
