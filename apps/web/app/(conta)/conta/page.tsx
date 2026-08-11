import type { Metadata } from 'next';

import { Button } from '@napo/ui/components/button';
import { Card } from '@napo/ui/components/card';

export const metadata: Metadata = {
  title: 'Minha conta — Napo',
};

/**
 * Destino mínimo do cliente. Existe para provar o guarda do layout; a área de
 * verdade (pedidos e endereços) é o NAPO-007.
 */
export default function ContaPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <Card className="w-full max-w-[420px] space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Sua conta</h1>
          <p className="text-sm leading-relaxed text-texto-suave">
            Telefone confirmado. Seus pedidos e endereços aparecem aqui em breve.
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
