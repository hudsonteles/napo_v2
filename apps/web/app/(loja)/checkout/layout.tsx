import type { ReactNode } from 'react';

import { exigirAcesso } from '@/features/auth';

// O guarda consulta o banco a cada navegação protegida (design §5 do NAPO-002).
export const dynamic = 'force-dynamic';

/**
 * Guarda do checkout (RN1, RN5).
 *
 * Vive no layout do segmento, e não dentro da página, pelo mesmo motivo do
 * `(conta)`: página que se protege sozinha protege só a si mesma, e a próxima
 * rota do segmento nasce aberta. Aqui `exigirAcesso` confere sessão **e**
 * telefone validado contra o banco — o telefone é como o entregador acha o
 * cliente, e sem ele não há pedido a fazer.
 */
export default async function CheckoutLayout({ children }: { children: ReactNode }) {
  await exigirAcesso('checkout');
  return <>{children}</>;
}
