import { z } from 'zod';

import type { Coordenada, ResultadoFrete } from '@napo/core';

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
/**
 * Logradouros de Brasília em que o complemento é obrigatório (RN3).
 *
 * `SQN 210 Bloco C` sem `Apto 302` é uma quadra com seis blocos iguais — a
 * entrega não chega. A lista é o contrato e é editável: ampliar é decisão de
 * operação, não refatoração. Compara por prefixo de palavra para não pegar
 * "Rua da Quadra" por acidente.
 */
const PADROES_COM_COMPLEMENTO = [
  'sqn', 'sqs', 'sqsw', 'sqnw', 'shin', 'shis', 'shcs', 'shces',
  'cln', 'cls', 'clnw', 'clsw', 'crs', 'crn',
  'qi', 'ql', 'ql', 'qe', 'qn', 'qna', 'qnb', 'qnc', 'qnd', 'qne',
  'scs', 'sen', 'ses', 'sds', 'sbn', 'sbs', 'scn', 'sqsw',
  'condomínio', 'condominio', 'residencial', 'edifício', 'edificio', 'bloco', 'quadra',
] as const;

/** O logradouro é de quadra ou condomínio? (RN3) */
export function exigeComplemento(logradouro: string): boolean {
  const palavras = logradouro
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z]+/)
    .filter(Boolean);

  return PADROES_COM_COMPLEMENTO.some((padrao) =>
    palavras.includes(padrao.normalize('NFD').replace(/[̀-ͯ]/g, '')),
  );
}

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
})
  .superRefine((endereco, ctx) => {
    if (exigeComplemento(endereco.logradouro) && !endereco.complemento?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['complemento'],
        message: 'Informe bloco e apartamento — sem eles a entrega não chega.',
      });
    }
  });

export type EntradaEndereco = z.infer<typeof esquemaEndereco>;

/**
 * O endereço como as telas leem. Vive aqui, e não em `services/`, porque o
 * serviço é `server-only` e o card é ilha de cliente — tipo importado de módulo
 * de servidor obriga todo consumidor a saber disso.
 */
export interface Endereco {
  id: string;
  apelido: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  referencia: string | null;
  lat: number;
  lng: number;
  distanciaKm: number | null;
  distanciaEstimada: boolean;
  precisaConferencia: boolean;
  atendido: boolean;
  motivoNaoAtendido: string | null;
  padrao: boolean;
}

/**
 * Resultado da avaliação de posição da etapa 2 (drift.md).
 *
 * Vive aqui, e não em `services/`, pelo mesmo motivo de `Endereco`: o serviço é
 * `server-only` e a etapa 2 é ilha de cliente.
 */
export interface PosicaoAvaliada {
  geocodificada: Coordenada | null;
  final: Coordenada;
  distanciaKm: number;
  distanciaEstimada: boolean;
  precisaConferencia: boolean;
  atendido: boolean;
  motivoNaoAtendido: string | null;
  frete: ResultadoFrete;
}
