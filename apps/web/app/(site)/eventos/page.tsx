import type { Metadata } from 'next';
import { ChefHat, CupSoda, Flame, MessageCircle, UserRound, Utensils } from 'lucide-react';
import { Button } from '@napo/ui/components/button';

export const metadata: Metadata = {
  title: 'Eventos — pizza assada na pedra na sua festa',
  description:
    'Levamos o forno de pedra até o seu evento. De 10 a 100 pessoas em Brasília, com pizza assada na hora. A partir de R$ 64,90 por pessoa nos grupos maiores.',
  alternates: { canonical: '/eventos' },
};

// Linha de WhatsApp do negócio. Confirmar/definir antes do go-live (NAPO-021);
// o site não é publicado ao fim do NAPO-003.
const WHATSAPP = 'https://wa.me/556100000000?text=Quero%20um%20or%C3%A7amento%20de%20evento';

const FAIXAS = [
  { pessoas: '10 a 30 pessoas', valor: 'R$ 99,00', destaque: false },
  { pessoas: '30 a 60 pessoas', valor: 'R$ 82,00', destaque: false },
  { pessoas: '60 a 100 pessoas', valor: 'R$ 64,90', destaque: true },
];

export default function EventosPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
      <p className="font-mono text-xs tracking-[0.25em] text-amarelo uppercase">Eventos</p>
      <h1 className="mt-6 max-w-3xl text-[clamp(2rem,6vw,3.5rem)] leading-[1.03] font-extrabold tracking-tight text-balance">
        Levamos o forno até a sua festa
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-texto-suave">
        A massa fermenta na nossa cozinha e assa na pedra, no seu evento. De 10 a 100 pessoas, em
        Brasília.
      </p>

      {/* Faixas de preço como conteúdo — o cálculo interativo é item próprio do ROADMAP */}
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {FAIXAS.map((f) => (
          <div
            key={f.pessoas}
            className={`rounded-card border bg-superficie p-6 ${f.destaque ? 'border-amarelo/30' : 'border-borda'}`}
          >
            <p
              className={`font-mono text-xs tracking-widest uppercase ${f.destaque ? 'text-amarelo' : 'text-texto-suave'}`}
            >
              {f.pessoas}
            </p>
            <p className={`mt-4 font-mono text-3xl font-extrabold ${f.destaque ? 'text-amarelo' : ''}`}>
              {f.valor}
            </p>
            <p className="mt-1 text-sm text-texto-suave">por pessoa</p>
          </div>
        ))}
      </div>
      <p className="mt-4 font-mono text-xs text-texto-suave">
        valores de referência · quanto maior o grupo, menor o preço por pessoa
      </p>

      {/* O forno no local NÃO é opcional: é o serviço (RN16) */}
      <h2 className="mt-16 text-3xl font-extrabold tracking-tight">O que está sempre incluído</h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-amarelo/30 bg-superficie p-6">
          <Flame className="h-6 w-6 text-amarelo" />
          <p className="mt-4 text-lg font-semibold">Forno de pedra no local</p>
          <p className="mt-1.5 text-sm leading-relaxed text-texto-suave">
            Levamos o forno até o seu evento. Não é adicional — é o serviço: sem forno na festa, não
            é Napo.
          </p>
        </div>
        <div className="rounded-card border border-amarelo/30 bg-superficie p-6">
          <ChefHat className="h-6 w-6 text-amarelo" />
          <p className="mt-4 text-lg font-semibold">Pizza assada na hora</p>
          <p className="mt-1.5 text-sm leading-relaxed text-texto-suave">
            Massa de longa fermentação, assada na pedra na frente dos seus convidados e servida
            quente.
          </p>
        </div>
      </div>

      <h2 className="mt-14 text-3xl font-extrabold tracking-tight">O que você escolhe incluir</h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-borda bg-superficie p-5">
          <Utensils className="h-5 w-5 text-texto-suave" />
          <p className="mt-3 font-medium">Louças e talheres</p>
          <p className="mt-1 text-sm text-texto-suave">Você não lava nada depois.</p>
        </div>
        <div className="rounded-card border border-borda bg-superficie p-5">
          <CupSoda className="h-5 w-5 text-texto-suave" />
          <p className="mt-3 font-medium">Bebidas</p>
          <p className="mt-1 text-sm text-texto-suave">Refrigerante e água.</p>
        </div>
        <div className="rounded-card border border-borda bg-superficie p-5">
          <UserRound className="h-5 w-5 text-texto-suave" />
          <p className="mt-3 font-medium">Garçons</p>
          <p className="mt-1 text-sm text-texto-suave">R$ 250 por garçom.</p>
        </div>
      </div>

      <div className="mt-14 rounded-card border border-borda bg-superficie p-7 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Vamos montar o seu?</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-texto-suave">
              Conte a data, o número de pessoas e o local. Respondemos com o orçamento fechado.
            </p>
          </div>
          <Button asChild largura="natural" className="gap-2 px-6">
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Falar no WhatsApp
            </a>
          </Button>
        </div>
        <p className="mt-6 border-t border-borda pt-5 font-mono text-xs text-texto-suave">
          orçamento automático online · em breve
        </p>
      </div>
    </main>
  );
}
