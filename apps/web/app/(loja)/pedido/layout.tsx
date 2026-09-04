import type { ReactNode } from 'react';

import { exigirAcesso } from '@/features/auth';

export const dynamic = 'force-dynamic';

/**
 * Guarda da tela de pedido. Mesma regra do checkout: o pedido mostra endereço,
 * dia e valor — é área da conta, e área da conta exige telefone validado.
 */
export default async function PedidoLayout({ children }: { children: ReactNode }) {
  await exigirAcesso('conta');
  return <>{children}</>;
}
