import type { Metadata } from 'next';
import Link from 'next/link';
import { ReceiptText } from 'lucide-react';

import { Button } from '@napo/ui/components/button';
import { Card } from '@napo/ui/components/card';

export const metadata: Metadata = {
  title: 'Meus pedidos — Napo',
  robots: { index: false, follow: false },
};

/**
 * Destino da seção Pedidos. A **listagem** é o NAPO-007 — aqui fica só o
 * endereço dela, para o menu não ter dois itens apontando ao mesmo lugar nem um
 * link que responde 404. Quem acabou de comprar continua chegando ao pedido
 * pela página de retorno do pagamento, que mostra tudo.
 */
export default function PedidosPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Meus pedidos</h1>

      <Card className="mt-7 p-8 text-center">
        <ReceiptText className="mx-auto h-6 w-6 text-texto-suave" />
        <p className="mt-4 text-sm leading-relaxed text-texto-suave">
          A lista dos seus pedidos aparece aqui em breve. Enquanto isso, o link que você recebeu
          ao pagar continua mostrando o pedido e o dia da entrega.
        </p>
        <Button largura="natural" size="sm" variant="outline" className="mt-6" asChild>
          <Link href="/sabores">Ver as pizzas</Link>
        </Button>
      </Card>
    </main>
  );
}
