import type { Metadata } from 'next';
import { FileClock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de privacidade',
  description: 'Como a Napo trata os dados pessoais de clientes, conforme a LGPD.',
  alternates: { canonical: '/legal/privacidade' },
};

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">Política de privacidade</h1>

        {/* Conteúdo provisório: o texto real entra com o NAPO-009, antes de publicar */}
        <div className="mt-6 flex items-start gap-3 rounded-card border border-amarelo/30 bg-amarelo/[0.06] p-5 text-sm leading-relaxed">
          <FileClock className="mt-0.5 h-4 w-4 shrink-0 text-amarelo" />
          <span className="text-texto-suave">
            <strong className="font-medium text-branco">Conteúdo provisório.</strong> A política
            definitiva entra com o módulo de LGPD (NAPO-009), com consentimento versionado, antes de
            qualquer publicação. Esta rota existe para não deixar link quebrado no rodapé.
          </span>
        </div>

        <div className="mt-8 space-y-4 leading-relaxed text-texto-suave">
          <p>
            Este documento descreverá quais dados a Napo coleta (cadastro, pedido, entrega), com que
            finalidade, por quanto tempo são guardados e como exercer os direitos previstos na LGPD.
          </p>
          <p>
            A validação de telefone por WhatsApp é usada apenas para autenticação e avisos de pedido
            — nunca para propaganda sem opt-in separado.
          </p>
        </div>
      </div>
    </main>
  );
}
