/**
 * Geometria de distância (RN6, RN11).
 *
 * Nada aqui fala com a API de rotas: recebe números e devolve números. A
 * distância que vale é a **rodoviária**, medida pelo servidor; estas funções
 * cobrem o que sobra quando a rota não responde e a medição do quanto o pin
 * saiu do lugar que a geocodificação apontou.
 */

export interface Coordenada {
  lat: number;
  lng: number;
}

/** Raio médio da Terra. Erro de ±0,3% no pior caso — irrelevante em 12 km. */
const RAIO_TERRA_KM = 6371;

const grausEmRadianos = (graus: number) => (graus * Math.PI) / 180;

/**
 * Arredonda para duas casas, o mesmo que `numeric(6,2)` guarda.
 *
 * Existe para a comparação de borda ser confiável: 11,995 km precisa virar
 * 12,00 antes de encostar no raio, senão o mesmo endereço é atendido em memória
 * e recusado depois de gravado (T25).
 */
export function arredondarKm(km: number): number {
  return Math.round(km * 100) / 100;
}

/**
 * Haversine entre dois pontos, em quilômetros arredondados.
 *
 * **Não é a distância que o cliente paga** — em Brasília o lago transforma 6 km
 * de reta em 14 km de asfalto (RN5). Serve de base para a estimativa da RN11 e
 * para medir deslocamento de pin, onde a reta é exatamente o que se quer.
 */
export function distanciaEmLinhaRetaKm(origem: Coordenada, destino: Coordenada): number {
  const deltaLat = grausEmRadianos(destino.lat - origem.lat);
  const deltaLng = grausEmRadianos(destino.lng - origem.lng);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(grausEmRadianos(origem.lat)) *
      Math.cos(grausEmRadianos(destino.lat)) *
      Math.sin(deltaLng / 2) ** 2;

  return arredondarKm(RAIO_TERRA_KM * 2 * Math.asin(Math.sqrt(a)));
}

/**
 * Estimativa rodoviária quando a API de rotas falha (RN11).
 *
 * O fator vem da configuração, nunca do código: a razão entre asfalto e reta em
 * Brasília gira em 1,3–1,4 e muda com obra e via nova. Fator abaixo de 1 é erro
 * de digitação com cara de desconto — cobraria frete abaixo do custo em todo
 * endereço estimado, calado.
 */
export function estimarDistanciaRodoviariaKm(linhaRetaKm: number, fator: number): number {
  if (fator < 1) {
    throw new Error(`Fator de distância estimada precisa ser >= 1 (recebido: ${fator}).`);
  }

  return arredondarKm(linhaRetaKm * fator);
}

/** Quanto o pin final saiu do ponto que a geocodificação devolveu (RN6). */
export function deslocamentoMetros(geocodificado: Coordenada, final: Coordenada): number {
  return distanciaEmLinhaRetaKm(geocodificado, final) * 1000;
}

/**
 * O deslocamento passou do tolerado? (RN6)
 *
 * Estritamente maior: a RN fala em "acima de 300 m", e o endereço que para
 * exatamente no limite não merece ser marcado para conferência humana.
 */
export function excedeLimiteDeAjuste(deslocamentoM: number, limiteM: number): boolean {
  return deslocamentoM > limiteM;
}
