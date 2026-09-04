import type { Metadata } from 'next';

import { ListaCarrinho } from '@/features/pedidos/components/lista-carrinho';

export const metadata: Metadata = {
  title: 'Seu carrinho',
  // A sacola é pessoal e muda a cada visita: nada aqui deve ser indexado.
  robots: { index: false, follow: false },
};

/**
 * Carrinho é página, não gaveta (design §4.5): tem 2 ou 3 itens, é linkável e
 * sobrevive ao redirecionamento do login — que é o passo seguinte.
 */
export default function CarrinhoPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Seu carrinho</h1>
      <ListaCarrinho />
    </main>
  );
}
