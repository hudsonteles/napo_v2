import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { carregarPerfilDaSessao } from '@/features/auth';
import { ROTA_ENTRAR } from '@/features/auth/destino';
import { repositorioDePedidos } from '@/features/pedidos';
import { EstadoPagamento } from '@/features/pedidos/components/estado-pagamento';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Seu pedido',
  robots: { index: false, follow: false },
};

/**
 * Para onde o Mercado Pago devolve o cliente.
 *
 * A primeira leitura vem do servidor e as seguintes da ilha cliente, que
 * consulta com espaçamento crescente (RN19). O retorno do navegador é
 * informação, não autorização: quem confirma é o webhook (RN8).
 */
export default async function PedidoPage({ params }: { params: Promise<{ numero: string }> }) {
  const perfil = await carregarPerfilDaSessao();
  const { numero } = await params;

  if (!perfil) redirect(`${ROTA_ENTRAR}?proximo=/pedido/${numero}`);

  const pedido = await repositorioDePedidos().lerPedidoPorNumero(Number(numero));

  // Pedido de outra pessoa responde igual a pedido inexistente.
  if (!pedido || pedido.profileId !== perfil.id) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <EstadoPagamento
        inicial={{
          numero: pedido.numero,
          status: pedido.status,
          diaEntrega: pedido.diaEntrega,
          totalCentavos: pedido.totalCentavos,
        }}
      />
    </main>
  );
}
