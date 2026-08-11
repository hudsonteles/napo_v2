import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BASE = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54421',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  APP_ENV: 'local',
  SUPABASE_SERVICE_ROLE_KEY: 'servico',
  OTP_PEPPER: 'pimenta-de-teste',
};

const original = { ...process.env };

async function carregarEnv(extra: Record<string, string | undefined>) {
  vi.resetModules();
  process.env = { ...original, ...BASE, ...extra } as NodeJS.ProcessEnv;
  const modulo = await import('./env');
  return modulo.getServerEnv;
}

describe('getServerEnv — provedor de WhatsApp (T45)', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    process.env = { ...original };
  });

  it('aceita o remetente falso sem exigir credencial da Meta', async () => {
    const getServerEnv = await carregarEnv({ WHATSAPP_PROVIDER: 'fake' });
    expect(getServerEnv().WHATSAPP_PROVIDER).toBe('fake');
  });

  it('usa o remetente falso quando a variável não é informada', async () => {
    const getServerEnv = await carregarEnv({ WHATSAPP_PROVIDER: undefined });
    expect(getServerEnv().WHATSAPP_PROVIDER).toBe('fake');
  });

  it('falha nomeando as variáveis ausentes quando o provedor é a Meta', async () => {
    const getServerEnv = await carregarEnv({
      WHATSAPP_PROVIDER: 'meta',
      WHATSAPP_PHONE_NUMBER_ID: undefined,
      WHATSAPP_ACCESS_TOKEN: undefined,
      WHATSAPP_TEMPLATE_NAME: undefined,
      WHATSAPP_TEMPLATE_LANG: undefined,
    });

    expect(() => getServerEnv()).toThrowError(/WHATSAPP_PHONE_NUMBER_ID/);
  });

  it('aceita a Meta quando as quatro credenciais estão presentes', async () => {
    const getServerEnv = await carregarEnv({
      WHATSAPP_PROVIDER: 'meta',
      WHATSAPP_PHONE_NUMBER_ID: '123',
      WHATSAPP_ACCESS_TOKEN: 'token',
      WHATSAPP_TEMPLATE_NAME: 'codigo_napo',
      WHATSAPP_TEMPLATE_LANG: 'pt_BR',
    });

    expect(getServerEnv().WHATSAPP_PROVIDER).toBe('meta');
  });

  it('exige o segredo do código em qualquer provedor', async () => {
    const getServerEnv = await carregarEnv({ WHATSAPP_PROVIDER: 'fake', OTP_PEPPER: undefined });
    expect(() => getServerEnv()).toThrowError(/OTP_PEPPER/);
  });
});
