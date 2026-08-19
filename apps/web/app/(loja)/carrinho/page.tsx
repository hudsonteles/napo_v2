import type { Metadata } from 'next';

import { lerCatalogo } from '@/features/catalogo';
import { ListaCarrinho } from '@/features/pedidos/components/lista-carrinho';

export const metadata: Metadata = {
  title: 'Seu carrinho',
  robots: { index: false },
};

/**
 * Página do carrinho. Server Component: lê o catálogo (nome, faixa, foto — dado
 * estável) e o entrega à ilha cliente, que junta com o que o navegador guarda
 * (id + quantidade) e revalida preço e vaga no servidor (RN3). O carrinho é
 * anônimo (RN1): nada aqui depende de sessão.
 */
export default async function CarrinhoPage() {
  const { produtos } = await lerCatalogo();

  const catalogo = produtos.map((p) => ({
    produtoId: p.produto.id,
    nome: p.produto.nome,
    faixaNome: p.faixa.nome,
    pesoG: p.produto.pesoLiquidoG,
    fotoUrl: p.fotoUrl,
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Seu carrinho</h1>
      <ListaCarrinho catalogo={catalogo} />
    </main>
  );
}
