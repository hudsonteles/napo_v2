import type { Metadata } from 'next';
import { carregarConfigDeArea, listarEnderecos } from '@/features/enderecos';
import { CheckoutCliente } from '@/features/pedidos/components/checkout-cliente';
import type { EnderecoDoCheckout } from '@/features/pedidos/components/seletor-endereco';
import { repositorioDePedidos } from '@/features/pedidos';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Finalizar pedido',
  robots: { index: false, follow: false },
};

/**
 * O checkout não pede dado que já existe (design §4.5): sem campos de nome,
 * telefone ou e-mail — o gate do NAPO-002 já validou tudo.
 *
 * A página compõe endereços (feature de endereços) e carrinho (ilha cliente):
 * a camada `app` é a única que pode juntar as duas (ARCHITECTURE §3.2).
 */
export default async function CheckoutPage() {
  const [enderecos, config, minutos] = await Promise.all([
    listarEnderecos(),
    carregarConfigDeArea(),
    repositorioDePedidos().pagamentoMinutos(),
  ]);

  const paraTela: EnderecoDoCheckout[] = enderecos.map((endereco) => ({
    id: endereco.id,
    titulo: [endereco.logradouro, endereco.numero, endereco.complemento]
      .filter(Boolean)
      .join(' · '),
    detalhe: `${endereco.bairro ? `${endereco.bairro}, ` : ''}${endereco.cidade} · ${endereco.cep}`,
    distanciaKm: endereco.distanciaKm,
    atendido: endereco.atendido,
    motivoNaoAtendido: endereco.motivoNaoAtendido,
    padrao: endereco.padrao,
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Finalizar pedido</h1>
      <CheckoutCliente
        enderecos={paraTela}
        faixas={config.faixas}
        freteGratisCentavos={config.freteGratisCentavos}
        minutosDeReserva={minutos}
      />
    </main>
  );
}
