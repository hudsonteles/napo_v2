import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { FormularioEndereco } from '@/features/enderecos/components/formulario-endereco';
import { carregarConfigDeArea } from '@/features/enderecos';
import { caminhoInternoSeguro } from '@/lib/navegacao';

export const metadata: Metadata = {
  title: 'Novo endereço — Napo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function NovoEnderecoPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>;
}) {
  const [config, { proximo }] = await Promise.all([carregarConfigDeArea(), searchParams]);

  // Quem chegou aqui pelo checkout volta para o checkout, inclusive se desistir.
  const volta = caminhoInternoSeguro(proximo);

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <Link
        href={volta ?? '/conta/enderecos'}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-texto-suave hover:text-branco"
      >
        <ArrowLeft className="h-4 w-4" /> {volta ? 'Voltar ao pedido' : 'Meus endereços'}
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">Novo endereço</h1>
      <p className="mt-2 text-sm text-texto-suave">
        Comece pelo CEP. Ajuste o que for preciso — em Brasília o endereço quase nunca é “rua e
        número”.
      </p>

      <FormularioEndereco
        config={{
          raioKm: config.raioKm,
          faixas: config.faixas,
          limiteAjustePinM: config.limiteAjustePinM,
        }}
        proximo={volta}
      />
    </main>
  );
}
