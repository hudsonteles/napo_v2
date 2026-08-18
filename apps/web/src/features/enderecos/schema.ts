import { z } from 'zod';

/**
 * Contrato de entrada do endereço — o mesmo no formulário e na rota.
 *
 * Sem `server-only` de propósito: duas validações do mesmo endereço divergem no
 * primeiro campo novo, e a que erra é sempre a do cliente, que é a que a pessoa
 * vê. O servidor revalida porque validação de cliente não é segurança.
 *
 * `distanciaKm` **não existe aqui** (RN5, T17): distância que chega pronta do
 * navegador é distância que o cliente escolhe — e com ela, a faixa que vai pagar.
 */
export const esquemaEndereco = z.object({
  apelido: z.string().trim().min(1).max(40),
  cep: z.string().regex(/^[0-9]{8}$/),
  logradouro: z.string().trim().min(1).max(160),
  numero: z.string().trim().min(1).max(20),
  complemento: z.string().trim().max(80).nullish(),
  bairro: z.string().trim().max(80).nullish(),
  cidade: z.string().trim().min(1).max(80),
  uf: z.string().length(2),
  referencia: z.string().trim().max(200).nullish(),
  /** Coordenada final confirmada no mapa. Ausente = vale a do geocoding. */
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
  padrao: z.boolean().optional(),
});

export type EntradaEndereco = z.infer<typeof esquemaEndereco>;
