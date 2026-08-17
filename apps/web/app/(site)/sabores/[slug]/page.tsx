import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Clock, ShoppingBag } from 'lucide-react';
import { centavosParaReais } from '@napo/core';
import { Button } from '@napo/ui/components/button';
import { SeletorQuantidade } from '@napo/ui/components/seletor-quantidade';

import { BlocoRotulagem, Disco } from '@/features/catalogo';
import { lerProdutoPorSlug, lerSlugsAtivos } from '@/features/catalogo/services/catalogo';

// As 12 páginas nascem no build; slug desconhecido é 404 sem tocar o banco
// (RN1/RN8/T9). `force-static` mantém tudo no CDN (T19).
export const dynamic = 'force-static';
export const dynamicParams = false;
export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await lerSlugsAtivos();
  return slugs.map((slug) => ({ slug }));
}

const PASSOS = [
  { n: 1, titulo: 'Pré-aqueça a 220 °C', texto: 'Forno bem quente por 10 minutos antes da pizza.' },
  { n: 2, titulo: 'Direto na grade', texto: 'Sem forma e sem papel. Congelada, sem descongelar antes.' },
  { n: 3, titulo: '8 a 10 minutos', texto: 'Até a borda dourar. Corte e sirva na hora.' },
];

export default async function ProdutoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await lerProdutoPorSlug(slug);
  if (!item) notFound();

  const { produto, categoria, faixa, precoEfetivoCentavos, fotoUrl } = item;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-texto-suave">
        <Link href="/" className="hover:text-branco">
          Início
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/sabores" className="hover:text-branco">
          Sabores
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-branco">{produto.nome}</span>
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
        {/* Mídia — disco em painel (A3), coerente com o card */}
        <div>
          <div className="overflow-hidden rounded-card border border-borda bg-superficie-alta">
            <div className="group p-8 sm:p-12">
              <Disco fotoUrl={fotoUrl} alt={`Pizza ${produto.nome} vista de cima`} className="w-full max-w-md" />
            </div>
          </div>
        </div>

        {/* Compra */}
        <div>
          <p className="font-mono text-xs tracking-[0.25em] text-texto-suave uppercase">
            {categoria.nome} · {faixa.nome}
          </p>
          <h1 className="mt-4 text-[clamp(2rem,5.5vw,3.5rem)] leading-[1.02] font-extrabold tracking-[-0.03em]">
            {produto.nome}
          </h1>
          {produto.denominacaoVenda ? (
            <p className="mt-3 text-sm text-texto-suave">{produto.denominacaoVenda}</p>
          ) : null}
          {produto.descricao ? (
            <p className="mt-6 leading-relaxed text-texto-suave">{produto.descricao}</p>
          ) : null}

          <div className="mt-8 flex items-end gap-3">
            <p className="text-[clamp(2rem,5vw,3rem)] leading-none font-extrabold tracking-tight">
              {centavosParaReais(precoEfetivoCentavos)}
            </p>
            <p className="pb-1 text-sm text-texto-suave">frete à parte</p>
          </div>

          {/* SeletorFornada + disponibilidade ao vivo chegam no bloco G */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <SeletorQuantidade valor={1} max={1} disabled />
            <Button disabled largura="natural" className="min-h-13 flex-1 gap-2 bg-superficie-alta px-6 font-semibold text-neutral-500">
              <ShoppingBag className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
          <p className="mt-2.5 flex items-center gap-2 text-sm text-texto-suave">
            <Clock className="h-3.5 w-3.5" />O pedido pelo site abre em breve. Por enquanto, falamos no
            WhatsApp.
          </p>

          <BlocoRotulagem produto={produto} />
        </div>
      </div>

      {/* Preparo */}
      <section className="mt-16 border-t border-borda pt-12 sm:mt-20 sm:pt-16">
        <h2 className="text-[clamp(1.75rem,5vw,3rem)] font-extrabold tracking-tight">Como aquecer</h2>
        <p className="mt-3 max-w-xl leading-relaxed text-texto-suave">{produto.preparo}</p>
        <ol className="mt-10 grid gap-5 sm:grid-cols-3">
          {PASSOS.map((passo) => (
            <li key={passo.n} className="rounded-card border border-borda bg-superficie p-6">
              <span className="text-2xl font-extrabold text-amarelo">{passo.n}</span>
              <p className="mt-3 font-medium">{passo.titulo}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-texto-suave">{passo.texto}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
