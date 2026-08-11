import type { RemetenteDeCodigo } from './remetente';

/**
 * Remetente de desenvolvimento e staging (RN16). Escreve o código no log do
 * servidor porque em local não existe WhatsApp — é assim que se testa o fluxo.
 *
 * Não é vazamento: ele só é selecionado quando `WHATSAPP_PROVIDER=fake`, e
 * produção exige `meta`. O serviço de verificação nunca loga o código.
 */
export class RemetenteFake implements RemetenteDeCodigo {
  async enviarCodigo(telefoneE164: string, codigo: string): Promise<void> {
    console.info(`[otp:fake] código ${codigo} para ${telefoneE164}`);
  }
}
