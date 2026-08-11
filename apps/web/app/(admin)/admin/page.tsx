import type { Metadata } from 'next';

import { Button } from '@napo/ui/components/button';
import { Card } from '@napo/ui/components/card';

export const metadata: Metadata = {
  title: 'Painel — Napo',
};

/**
 * Destino mínimo da equipe. Prova o guarda de papel; o painel de verdade
 * (pedidos, estoque, custos) é o NAPO-008.
 */
export default function AdminPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <Card className="w-full max-w-[420px] space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
          <p className="text-sm leading-relaxed text-texto-suave">
            Você entrou como equipe. Pedidos, estoque e custos chegam no NAPO-008.
          </p>
        </div>

        <form action="/api/auth/sair" method="post">
          <Button type="submit" variant="outline">
            Sair
          </Button>
        </form>
      </Card>
    </div>
  );
}
