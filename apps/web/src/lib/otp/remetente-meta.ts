import type { RemetenteDeCodigo } from './remetente';

const TIMEOUT_MS = 8_000;

interface CredenciaisMeta {
  phoneNumberId: string;
  accessToken: string;
  template: string;
  idioma: string;
}

/**
 * WhatsApp Cloud API (design §6.3). Template de categoria *authentication*:
 * o código viaja como parâmetro do corpo e do botão de copiar.
 *
 * Uma retentativa apenas — o código expira em 10 minutos e insistir contra um
 * provedor fora do ar só atrasa a mensagem de erro para quem está esperando.
 */
export class RemetenteMeta implements RemetenteDeCodigo {
  constructor(private readonly credenciais: CredenciaisMeta) {}

  async enviarCodigo(telefoneE164: string, codigo: string): Promise<void> {
    try {
      await this.postar(telefoneE164, codigo);
    } catch {
      await this.postar(telefoneE164, codigo);
    }
  }

  private async postar(telefoneE164: string, codigo: string): Promise<void> {
    const resposta = await fetch(
      `https://graph.facebook.com/v21.0/${this.credenciais.phoneNumberId}/messages`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          authorization: `Bearer ${this.credenciais.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: telefoneE164,
          type: 'template',
          template: {
            name: this.credenciais.template,
            language: { code: this.credenciais.idioma },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: codigo }] },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: codigo }],
              },
            ],
          },
        }),
      },
    );

    if (!resposta.ok) {
      // O corpo da Meta pode conter o número; fica no status, que basta para
      // diagnosticar sem carregar dado pessoal para o log.
      throw new Error(`WhatsApp Cloud API respondeu ${resposta.status}`);
    }
  }
}
