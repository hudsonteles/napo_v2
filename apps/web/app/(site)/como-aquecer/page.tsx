import type { Metadata } from 'next';
import { ChevronDown } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Como aquecer',
  description:
    'A pizza sai do forno italiano assada na pedra e é congelada na hora. No seu forno, o que falta são minutos — não uma receita.',
  alternates: { canonical: '/como-aquecer' },
};

const PASSOS = [
  {
    n: 1,
    titulo: 'Pré-aqueça a 220 °C',
    texto: 'Dez minutos de forno vazio. Quanto mais quente, mais perto do resultado original.',
  },
  {
    n: 2,
    titulo: 'Direto na grade, congelada',
    texto: 'Sem forma, sem papel e sem descongelar. Descongelar antes molha a massa.',
  },
  {
    n: 3,
    titulo: '8 a 10 minutos',
    texto: 'Até a borda dourar e o queijo borbulhar. Corte fora do forno.',
  },
];

const FAQ = [
  {
    p: 'Preciso descongelar antes?',
    r: 'Não. A pizza vai do freezer direto para o forno pré-aquecido. Descongelar solta água na massa e tira a crocância.',
  },
  {
    p: 'Quanto tempo dura no freezer?',
    r: '90 dias a −18 °C. A validade de cada sabor está na página do produto.',
  },
  {
    p: 'Onde vocês entregam?',
    r: 'Brasília, num raio de 12 km a partir da cozinha, às sextas. Frete de R$ 6 a R$ 14 conforme a distância, grátis acima de R$ 150.',
  },
  {
    p: 'Tenho alergia. Como sei o que posso comer?',
    r: 'Cada sabor lista o que contém e o que pode conter por contato. Importante: todos são feitos na mesma cozinha, que manipula glúten, leite, soja e avelã — pode haver traços mesmo quando o ingrediente não está na receita.',
  },
];

export default function ComoAquecerPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        A parte difícil já foi feita
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-texto-suave">
        A pizza sai do nosso forno italiano assada na pedra e é congelada na hora. No seu forno, o
        que falta são minutos — não uma receita.
      </p>

      <ol className="mt-12 grid gap-5 sm:grid-cols-3">
        {PASSOS.map((passo) => (
          <li key={passo.n} className="rounded-card border border-borda bg-superficie p-7">
            <span className="text-3xl font-semibold text-amarelo">{passo.n}</span>
            <p className="mt-4 font-medium">{passo.titulo}</p>
            <p className="mt-2 text-sm leading-relaxed text-texto-suave">{passo.texto}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-20 text-3xl font-semibold tracking-tight">Perguntas frequentes</h2>
      <div className="mt-8 max-w-3xl divide-y divide-borda rounded-card border border-borda bg-superficie">
        {FAQ.map((item, i) => (
          <details key={item.p} className="group px-6 py-5" open={i === 0}>
            <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium">
              {item.p}
              <ChevronDown className="h-4 w-4 shrink-0 text-texto-suave transition group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-texto-suave">{item.r}</p>
          </details>
        ))}
      </div>
    </main>
  );
}
