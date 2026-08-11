import 'server-only';

import { getServerEnv } from '@/lib/env';

import { RemetenteFake } from './remetente-fake';
import { RemetenteMeta } from './remetente-meta';

/**
 * Canal de entrega do código. A interface é o contrato inteiro: nada acima dela
 * sabe qual provedor respondeu, e é isso que torna a troca por BSP uma
 * configuração em vez de reescrita (design §5).
 */
export interface RemetenteDeCodigo {
  enviarCodigo(telefoneE164: string, codigo: string): Promise<void>;
}

export function remetenteDeCodigo(): RemetenteDeCodigo {
  const env = getServerEnv();

  if (env.WHATSAPP_PROVIDER === 'meta') {
    return new RemetenteMeta({
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID as string,
      accessToken: env.WHATSAPP_ACCESS_TOKEN as string,
      template: env.WHATSAPP_TEMPLATE_NAME as string,
      idioma: env.WHATSAPP_TEMPLATE_LANG as string,
    });
  }

  return new RemetenteFake();
}
