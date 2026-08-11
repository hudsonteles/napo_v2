import type { ReactNode } from 'react';

import { exigirAcesso } from '@/features/auth';

// O guarda consulta o banco a cada navegação protegida — decisão do design §5:
// claim de papel em JWT fica velha até o refresh e barraria quem acabou de
// validar o telefone.
export const dynamic = 'force-dynamic';

/**
 * Guarda da área do cliente (RN2, RN3). Vive no layout do segmento `conta/`, e
 * não no do grupo `(conta)`, porque as telas de auth moram no mesmo grupo e não
 * podem exigir o que estão construindo (design §5).
 */
export default async function ContaLayout({ children }: { children: ReactNode }) {
  await exigirAcesso('conta');

  return <>{children}</>;
}
