import Link from 'next/link';
import { ArrowRight, ChevronDown, MessageCircle } from 'lucide-react';
import { Button } from '@napo/ui/components/button';

import {
  BarraFornada,
  CardProduto,
  DisponibilidadeProvider,
  lerCatalogo,
  SeletorFornada,
} from '@/features/catalogo';

// SSG com revalidação longa (design §4.5): zero render por visita (T19).
export const dynamic = 'force-static';
export const revalidate = 3600;

const REGUA = [
  { eixo: 'massa', mercado: 'Massa crua na embalagem', napo: 'Longa fermentação' },
  { eixo: 'forno', mercado: 'Você assa em casa, do zero', napo: 'Assada na pedra, no forno italiano' },
  {
    eixo: 'em casa',
    mercado: 'Nunca fica boa — e a culpa não é sua',
    napo: 'Oito minutos e está na mesa',
  },
];

const FRETES = [
  { faixa: 'Até 4 km', valor: 'R$ 6,00', destaque: false },
  { faixa: '4 a 8 km', valor: 'R$ 10,00', destaque: false },
  { faixa: '8 a 12 km', valor: 'R$ 14,00', destaque: false },
  { faixa: 'Acima de R$ 150', valor: 'grátis', destaque: true },
];

export default async function HomePage() {
  const { produtos } = await lerCatalogo();
  const maisPedidas = produtos
    .filter((p) => p.produto.rankingMaisPedidas != null)
    .sort((a, b) => a.produto.rankingMaisPedidas! - b.produto.rankingMaisPedidas!)
    .slice(0, 3);

  return (
    <>
      {/* ═══ HERO — header + hero = 100dvh ═══ */}
      <section className="relative flex h-[calc(100dvh-65px)] items-center overflow-hidden border-b border-borda">
        <div className="absolute inset-0 lg:left-1/2" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto pré-otimizada, sem next/image (design §5) */}
          <img src="/produtos/forno.jpeg" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-preto/75 lg:hidden" />
          <div className="absolute inset-0 hidden bg-gradient-to-r from-preto via-preto/40 to-transparent lg:block" />
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
          <div className="lg:w-[54%]">
            <h1 className="text-[clamp(2.25rem,6.5vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.03em]">
              Longa
              <br />
              fermentação.
              <br />
              Assada <span className="text-amarelo">na pedra</span>.
            </h1>
            <p className="mt-[clamp(1rem,2.5vh,2rem)] max-w-md text-[clamp(0.95rem,1.9vw,1.125rem)] leading-relaxed text-texto-suave">
              Em casa, só aquecer. A sua cozinha não tem forno de pedra — a nossa tem, e a pizza sai
              de lá pronta.
            </p>
            <div className="mt-[clamp(1.25rem,3vh,2.5rem)] flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild largura="natural" className="gap-2 px-6">
                <Link href="/sabores">
                  Ver os 12 sabores
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" largura="natural" className="px-6">
                <Link href="/como-aquecer">Como aquecer</Link>
              </Button>
            </div>
          </div>
        </div>

        <a
          href="#fornada"
          className="absolute bottom-5 left-1/2 -translate-x-1/2 text-texto-suave transition hover:text-branco"
          aria-label="Ver a fornada da semana"
        >
          <ChevronDown className="h-6 w-6" />
        </a>
      </section>

      {/* ═══ Disponibilidade ao vivo governa fornada + mais pedidas ═══ */}
      <DisponibilidadeProvider>
        <section id="fornada" className="border-b border-borda bg-superficie">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_1fr] lg:items-center">
            <BarraFornada />
            <SeletorFornada />
          </div>
        </section>

        {maisPedidas.length > 0 ? (
          <section className="border-b border-borda">
            <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="text-[clamp(1.75rem,5vw,3rem)] font-extrabold tracking-tight">
                  As mais pedidas
                </h2>
                <Link
                  href="/sabores"
                  className="inline-flex items-center gap-2 text-sm text-texto-suave underline underline-offset-4 transition hover:text-branco"
                >
                  Ver os 12 <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {maisPedidas.map((item) => (
                  <CardProduto key={item.produto.id} item={item} />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </DisponibilidadeProvider>

      {/* ═══ A diferença é o forno — régua comparativa ═══ */}
      <section className="border-b border-borda">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <h2 className="max-w-3xl text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
            O concorrente não é a pizzaria
            <br className="hidden sm:block" /> da esquina. É o freezer do mercado.
          </h2>

          <div className="mt-14 grid gap-2 sm:grid-cols-[1fr_auto_1fr]">
            <p className="font-mono text-xs tracking-[0.25em] text-texto-suave uppercase">
              Congelada de supermercado
            </p>
            <p className="hidden sm:block sm:px-8" />
            <p className="font-mono text-xs tracking-[0.25em] text-amarelo uppercase sm:text-right">
              Napo
            </p>
          </div>

          <div className="mt-4">
            {REGUA.map((linha) => (
              <div
                key={linha.eixo}
                className="grid items-center gap-2 border-t border-borda py-6 last:border-b sm:grid-cols-[1fr_auto_1fr]"
              >
                <p className="text-lg text-texto-suave">{linha.mercado}</p>
                <p className="font-mono text-xs tracking-widest text-texto-suave uppercase sm:px-8">
                  {linha.eixo}
                </p>
                <p className="text-lg font-medium sm:text-right">{linha.napo}</p>
              </div>
            ))}
          </div>

          <p className="mt-10 max-w-xl leading-relaxed text-texto-suave">
            A fermentação longa também é o que deixa a massa leve — dela você não sai pesado.
          </p>
        </div>
      </section>

      {/* ═══ Eventos — porta de entrada ═══ */}
      <section className="border-b border-borda">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
            <div className="relative overflow-hidden rounded-card border border-borda">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto pré-otimizada, sem next/image (design §5) */}
              <img
                src="/produtos/capa.jpeg"
                alt="Pizzas fatiadas em tábua, servidas em evento"
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-preto/70 to-transparent" />
            </div>
            <div>
              <p className="font-mono text-xs tracking-[0.25em] text-amarelo uppercase">Eventos</p>
              <h2 className="mt-5 text-[clamp(1.75rem,5vw,3rem)] leading-[1.05] font-extrabold tracking-tight text-balance">
                Sua festa com pizza saindo da pedra na hora.
              </h2>
              <p className="mt-5 max-w-md leading-relaxed text-texto-suave">
                Levamos o forno até você. De 10 a 100 pessoas, com opção de louças e talheres,
                bebidas e garçons — a partir de{' '}
                <strong className="font-medium text-branco">R$ 64,90 por pessoa</strong> nos grupos
                maiores.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild largura="natural" className="gap-2 px-6">
                  <Link href="/eventos">
                    <MessageCircle className="h-4 w-4" />
                    Pedir um orçamento
                  </Link>
                </Button>
                <Button asChild variant="outline" largura="natural" className="px-6">
                  <Link href="/eventos">Como funciona</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Entrega e área (RN10/T14) ═══ */}
      <section>
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
            <div>
              <p className="font-mono text-xs tracking-[0.25em] text-texto-suave uppercase">
                Entrega
              </p>
              <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
                Brasília, às sextas.
              </h2>
              <p className="mt-5 max-w-md leading-relaxed text-texto-suave">
                Produção por encomenda, sem estoque parado. Você escolhe a sexta, a gente assa
                naquela semana. Raio de 12&nbsp;km a partir da cozinha.
              </p>
            </div>
            <dl>
              {FRETES.map((f) => (
                <div
                  key={f.faixa}
                  className={`flex justify-between border-t py-4 ${
                    f.destaque ? 'border-amarelo/30 last:border-b' : 'border-borda'
                  }`}
                >
                  <dt className={f.destaque ? 'font-medium text-amarelo' : 'text-texto-suave'}>
                    {f.faixa}
                  </dt>
                  <dd className={`font-mono ${f.destaque ? 'font-semibold text-amarelo' : 'font-medium'}`}>
                    {f.valor}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}
