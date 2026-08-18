import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { FormularioEndereco } from '@/features/enderecos/components/formulario-endereco';
import { listarEnderecos } from '@/features/enderecos';

export const metadata: Metadata = {
  title: 'Editar endereço — Napo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function EditarEnderecoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Lê da própria listagem do dono: endereço de outro cliente simplesmente não
  // está aqui, e vira 404 — não "proibido" (RN1, T16).
  const endereco = (await listarEnderecos()).find((e) => e.id === id);
  if (!endereco) notFound();

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <Link
        href="/conta/enderecos"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-texto-suave hover:text-branco"
      >
        <ArrowLeft className="h-4 w-4" /> Meus endereços
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">Editar endereço</h1>
      <p className="mt-2 text-sm text-texto-suave">
        Mexer só no ponto de referência não refaz a medição — a distância de um endereço não muda
        sozinha.
      </p>

      <FormularioEndereco endereco={endereco} />
    </main>
  );
}
