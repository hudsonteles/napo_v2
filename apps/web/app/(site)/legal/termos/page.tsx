import type { Metadata } from 'next';
import { FileClock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Termos de uso',
  description: 'Condições de venda, prazos de entrega e política de cancelamento da Napo.',
  alternates: { canonical: '/legal/termos' },
};

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">Termos de uso</h1>

        {/* Conteúdo provisório: o texto real entra com o NAPO-009, antes de publicar */}
        <div className="mt-6 flex items-start gap-3 rounded-card border border-amarelo/30 bg-amarelo/[0.06] p-5 text-sm leading-relaxed">
          <FileClock className="mt-0.5 h-4 w-4 shrink-0 text-amarelo" />
          <span className="text-texto-suave">
            <strong className="font-medium text-branco">Conteúdo provisório.</strong> O texto
            definitivo entra com o módulo de LGPD (NAPO-009), antes de qualquer publicação. Esta rota
            existe para não deixar link quebrado no rodapé.
          </span>
        </div>

        <div className="mt-8 space-y-4 leading-relaxed text-texto-suave">
          <p>
            Este documento reunirá as condições de venda, prazos de entrega, política de cancelamento
            e responsabilidades da Napo Alimentos.
          </p>
          <p>
            Enquanto não é publicado, qualquer dúvida sobre pedido ou entrega pode ser tratada
            diretamente pelo nosso WhatsApp.
          </p>
        </div>
      </div>
    </main>
  );
}
