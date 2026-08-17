import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Clock } from 'lucide-react';
import { centavosParaReais, jsonLdProduto } from '@napo/core';

import {
  BlocoRotulagem,
  Disco,
  DisponibilidadeProvider,
  EstadoDisponibilidade,
  SeletorFornada,
} from '@/features/catalogo';
import { lerProdutoPorSlug, lerSlugsAtivos } from '@/features/catalogo/services/catalogo';
import { temEstoqueNoHorizonte } from '@/features/disponibilidade';
import { publicEnv } from '@/lib/env';

// As 12 páginas nascem no build; slug desconhecido é 404 sem tocar o banco
// (RN1/RN8/T9). `force-static` mantém tudo no CDN (T19).
export const dynamic = 'force-static';
export const dynamicParams = false;
export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await lerSlugsAtivos();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await lerProdutoPorSlug(slug);
  if (!item) return {};

  const { produto, fotoUrl } = item;
  const descricao = produto.descricao ?? produto.denominacaoVenda ?? undefined;
  return {
    title: produto.nome,
    description: descricao,
    alternates: { canonical: `/sabores/${produto.slug}` },
    openGraph: {
      title: `${produto.nome} · Napo`,
      description: descricao,
      type: 'website',
      images: fotoUrl ? [fotoUrl] : undefined,
    },
  };
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

  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  // Preço e disponibilidade do JSON-LD saem das mesmas fontes que a tela usa
  // (RN9/T25): preço da função pura, disponibilidade do mesmo motor (T23).
  const jsonLd = jsonLdProduto({
    produto,
    faixa,
    url: `${base}/sabores/${produto.slug}`,
    imagemUrl: fotoUrl ? `${base}${fotoUrl}` : undefined,
    disponibilidade: (await temEstoqueNoHorizonte(produto.id)) ? 'InStock' : 'OutOfStock',
  });

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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

        {/* Compra — a disponibilidade ao vivo é ilha cliente sobre esta coluna */}
        <div>
          <DisponibilidadeProvider>
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

          <SeletorFornada />
          <EstadoDisponibilidade produtoId={produto.id} />
          <p className="mt-2.5 flex items-center gap-2 text-sm text-texto-suave">
            <Clock className="h-3.5 w-3.5" />O pedido pelo site abre em breve. Por enquanto, falamos no
            WhatsApp.
          </p>

          <BlocoRotulagem produto={produto} />
          </DisponibilidadeProvider>
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
