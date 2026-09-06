import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { carregarPerfilDaSessao } from '@/features/auth';
import { repositorioDePedidos } from '@/features/pedidos';
import { PagamentoCliente } from '@/features/pedidos/components/pagamento-cliente';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pagamento do pedido',
  robots: { index: false, follow: false },
};

/**
 * Onde o Payment Brick vive (ADR-0001).
 *
 * Rota própria e endereçável de propósito: a janela é de 30 minutos e o cliente
 * recarrega, volta e abre em outra aba. Um passo revelado dentro do checkout
 * perderia o pedido a cada F5 — e convidaria a criar um segundo pedido,
 * consumindo uma segunda vaga da mesma pessoa.
 */
export default async function PagarPage({ params }: { params: Promise<{ numero: string }> }) {
  const perfil = await carregarPerfilDaSessao();
  const { numero } = await params;

  const pedido = await repositorioDePedidos().lerPedidoPorNumero(Number(numero));

  // O Brick exige um e-mail de pagador. Ele vem da sessão, não de um campo: o
  // checkout não pede dado que já existe, e um campo a mais num formulário de
  // pagamento é uma desistência a mais.
  const { data } = await (await createSupabaseServerClient()).auth.getUser();

  // Pedido de outra pessoa responde igual a pedido inexistente.
  if (!pedido || pedido.profileId !== perfil?.id) notFound();

  // Não existe caminho para cobrar de novo o que já foi pago: quem chega aqui
  // com o dinheiro dentro vai para a tela do pedido.
  if (pedido.situacaoPagamento === 'pago' || pedido.situacaoPagamento === 'estornado') {
    redirect(`/pedido/${pedido.numero}`);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <PagamentoCliente
        numero={pedido.numero}
        pedidoId={pedido.id}
        diaEntrega={pedido.diaEntrega}
        totalCentavos={pedido.totalCentavos}
        expiraEm={pedido.expiraEm}
        emailPadrao={data.user?.email ?? ''}
      />
    </main>
  );
}
