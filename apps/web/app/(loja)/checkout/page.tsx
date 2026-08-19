import type { Metadata } from 'next';

import { exigirAcesso } from '@/features/auth';
import { carregarConfigDeArea, listarEnderecos } from '@/features/enderecos';
import { lerPagamentoMinutos } from '@/features/pedidos';
import { CheckoutCliente } from '@/features/pedidos/components/checkout-cliente';

export const metadata: Metadata = {
  title: 'Finalizar pedido',
  robots: { index: false },
};

/**
 * Checkout. Server Component: o guarda de acesso barra quem não tem sessão E
 * telefone validado (RN5) antes de renderizar — a área `checkout` exige o número
 * inclusive de quem é equipe, porque é o contato que o entregador vai ligar. Os
 * endereços e a config de frete vêm do servidor; a orquestração (carrinho,
 * frete, pagamento) é a ilha cliente.
 */
export default async function CheckoutPage() {
  await exigirAcesso('checkout');

  const [enderecos, config, minutos] = await Promise.all([
    listarEnderecos(),
    carregarConfigDeArea(),
    lerPagamentoMinutos(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Finalizar pedido</h1>
      <CheckoutCliente
        enderecos={enderecos}
        freteGratisCentavos={config.freteGratisCentavos}
        minutos={minutos}
      />
    </main>
  );
}
