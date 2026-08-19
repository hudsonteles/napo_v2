import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { exigirAcesso } from '@/features/auth';
import { lerPedidoDoDono } from '@/features/pedidos';
import { EstadoPagamento, type PedidoView } from '@/features/pedidos/components/estado-pagamento';

export const metadata: Metadata = {
  title: 'Seu pedido',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

/**
 * Página do pedido — o retorno do pagamento e a consulta por link (RN17, RN19).
 * Guarda de sessão + telefone; a leitura é sob a RLS do dono, então número alheio
 * simplesmente não existe (404). O `payment_id` da URL de retorno alimenta a
 * reconciliação ativa da ilha cliente (RN19/T38).
 */
export default async function PedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ numero: string }>;
  searchParams: Promise<{ payment_id?: string }>;
}) {
  await exigirAcesso('conta');

  const numero = Number((await params).numero);
  if (!Number.isInteger(numero)) notFound();

  const pedido = await lerPedidoDoDono(numero);
  if (!pedido) notFound();

  const paymentId = (await searchParams).payment_id ?? null;

  const view: PedidoView = {
    numero: pedido.numero,
    status: pedido.status,
    diaEntrega: pedido.diaEntrega,
    subtotalCentavos: pedido.subtotalCentavos,
    freteCentavos: pedido.freteCentavos,
    totalCentavos: pedido.totalCentavos,
    veredito: pedido.veredito,
    criadoEm: pedido.criadoEm,
    enderecoSnapshot: pedido.enderecoSnapshot as PedidoView['enderecoSnapshot'],
    itens: pedido.itens,
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <EstadoPagamento pedidoInicial={view} numero={numero} paymentId={paymentId} />
    </main>
  );
}
