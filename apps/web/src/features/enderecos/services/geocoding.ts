import 'server-only';

import {
  arredondarKm,
  distanciaEmLinhaRetaKm,
  estimarDistanciaRodoviariaKm,
  type Coordenada,
} from '@napo/core';

import { getGoogleEnv } from '@/lib/env';

/**
 * Geocodificação e medição de rota no Google (RN4, RN5, RN11).
 *
 * `import 'server-only'` no topo é o que sustenta o T18: um import equivocado
 * deste módulo por código de cliente vira erro de build, não uma chave de
 * servidor viajando no bundle. A chave nunca aparece em query string de rota,
 * só em cabeçalho — query string vai para log de proxy e de CDN.
 */

export interface EnderecoParaBusca {
  logradouro: string;
  numero: string;
  bairro: string | null;
  cidade: string;
  uf: string;
  cep: string;
}

export interface DistanciaMedida {
  distanciaKm: number;
  /** `true` quando veio da linha reta com fator, não da rota (RN11). */
  estimada: boolean;
}

const TIMEOUT_MS = 5000;

/** `s/n` é a ausência de número, não um número — mandá-lo confunde o geocoder. */
const SEM_NUMERO = /^s\/?n$/i;

/**
 * Endereço em uma linha para o geocoder, **com o número** (RN4): o CEP devolve o
 * meio da rua e o número devolve a porta, e a diferença entre os dois é uma
 * quadra inteira de caminhada para o entregador.
 */
export function montarEnderecoParaBusca(endereco: EnderecoParaBusca): string {
  const partes = [
    endereco.logradouro,
    SEM_NUMERO.test(endereco.numero.trim()) ? null : endereco.numero,
    endereco.bairro,
    `${endereco.cidade} - ${endereco.uf}`,
    endereco.cep,
  ];

  return partes.filter(Boolean).join(', ');
}

/**
 * Coordenada do endereço, ou `null`.
 *
 * `null` não é erro: o formulário abre o mapa no centro da cidade com o pin
 * arrastável e um aviso de que a posição precisa ser conferida. Geocodificação
 * erra com frequência em quadra do Plano Piloto — é para isso que o pin existe.
 */
export async function geocodificar(endereco: EnderecoParaBusca): Promise<Coordenada | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', montarEnderecoParaBusca(endereco));
  // "Brasília" existe em outros países; sem o filtro o geocoder pode responder
  // uma coordenada plausível e completamente errada.
  url.searchParams.set('components', 'country:BR');
  url.searchParams.set('key', getGoogleEnv().GOOGLE_MAPS_SERVER_KEY);

  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!resposta.ok) return null;

    const dados = (await resposta.json()) as {
      status?: string;
      results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
    };

    // ZERO_RESULTS, OVER_QUERY_LIMIT, REQUEST_DENIED: para o cadastro é tudo a
    // mesma coisa — não há coordenada, o cliente confere no mapa.
    const local = dados.status === 'OK' ? dados.results?.[0]?.geometry?.location : undefined;
    if (typeof local?.lat !== 'number' || typeof local?.lng !== 'number') return null;

    return { lat: local.lat, lng: local.lng };
  } catch {
    return null;
  }
}

async function rotaRodoviariaKm(origem: Coordenada, destino: Coordenada): Promise<number | null> {
  const ponto = (c: Coordenada) => ({
    location: { latLng: { latitude: c.lat, longitude: c.lng } },
  });

  try {
    const resposta = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': getGoogleEnv().GOOGLE_MAPS_SERVER_KEY,
        // Sem a máscara o Google recusa a requisição, e cada campo a mais é
        // cobrado numa faixa de SKU diferente. Só a distância importa aqui.
        'X-Goog-FieldMask': 'routes.distanceMeters',
      },
      body: JSON.stringify({
        origin: ponto(origem),
        destination: ponto(destino),
        travelMode: 'DRIVE',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!resposta.ok) return null;

    const dados = (await resposta.json()) as { routes?: { distanceMeters?: number }[] };
    const metros = dados.routes?.[0]?.distanceMeters;

    return typeof metros === 'number' ? arredondarKm(metros / 1000) : null;
  } catch {
    return null;
  }
}

/**
 * Distância da cozinha até o endereço (RN5), com estimativa marcada quando a
 * rota não responde (RN11).
 *
 * **Nunca devolve zero nem nulo.** Distância ausente viraria frete zero ou
 * cadastro travado; distância estimada e sinalizada é honesta e revisável — o
 * endereço fica marcado até conferência humana.
 */
export async function medirDistancia(
  origem: Coordenada,
  destino: Coordenada,
  fatorEstimativa: number,
): Promise<DistanciaMedida> {
  const rodoviaria = await rotaRodoviariaKm(origem, destino);

  if (rodoviaria !== null) {
    return { distanciaKm: rodoviaria, estimada: false };
  }

  return {
    distanciaKm: estimarDistanciaRodoviariaKm(
      distanciaEmLinhaRetaKm(origem, destino),
      fatorEstimativa,
    ),
    estimada: true,
  };
}
