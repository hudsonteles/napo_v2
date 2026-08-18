import 'server-only';

import {
  avaliarArea,
  calcularFrete,
  deslocamentoMetros,
  excedeLimiteDeAjuste,
  type Coordenada,
  type ResultadoFrete,
} from '@napo/core';

import type { Endereco, EntradaEndereco } from '../schema';
import { geocodificar, medirDistancia } from './geocoding';
import {
  atualizar,
  carregarConfigDeArea,
  contarAtivos,
  inserir,
  lerAtivo,
  listarAtivos,
  trocarPadrao,
  type EdicaoEndereco,
  type LinhaEndereco,
} from './enderecos-repo';

/**
 * Orquestração do cadastro de endereço.
 *
 * A ordem importa e é a da RN4/RN5: geocodifica pelo número, mede o
 * deslocamento do pin, mede a distância rodoviária a partir da coordenada
 * FINAL, avalia a área e só então grava. **A distância nunca vem do corpo da
 * requisição** — se viesse, o cliente escolheria a própria faixa de frete.
 */

export const MAX_ENDERECOS_ATIVOS = 10;

export type FalhaEndereco = 'limite-atingido' | 'nao-encontrado' | 'falha-ao-gravar';

export function paraEndereco(linha: LinhaEndereco): Endereco {
  return {
    id: linha.id,
    apelido: linha.apelido,
    cep: linha.cep,
    logradouro: linha.logradouro,
    numero: linha.numero,
    complemento: linha.complemento,
    bairro: linha.bairro,
    cidade: linha.cidade,
    uf: linha.uf,
    referencia: linha.referencia,
    lat: Number(linha.lat),
    lng: Number(linha.lng),
    distanciaKm: linha.distancia_km === null ? null : Number(linha.distancia_km),
    distanciaEstimada: linha.distancia_estimada,
    precisaConferencia: linha.precisa_conferencia,
    atendido: linha.atendido,
    motivoNaoAtendido: linha.motivo_nao_atendido,
    padrao: linha.padrao,
  };
}

interface Posicionamento {
  geocodificada: Coordenada | null;
  final: Coordenada;
  distanciaKm: number;
  distanciaEstimada: boolean;
  precisaConferencia: boolean;
}

/**
 * Geocodifica, aceita o ajuste do pin e mede a distância (RN4, RN5, RN6, RN11).
 *
 * Quando o geocoder não encontra o endereço, a coordenada final é a que o
 * cliente confirmou no mapa e o endereço nasce marcado para conferência — o
 * pin do mapa não é palpite do sistema, mas também não é medição.
 */
async function posicionar(
  entrada: EntradaEndereco,
  config: Awaited<ReturnType<typeof carregarConfigDeArea>>,
): Promise<Posicionamento | null> {
  const geocodificada = await geocodificar({
    logradouro: entrada.logradouro,
    numero: entrada.numero,
    bairro: entrada.bairro ?? null,
    cidade: entrada.cidade,
    uf: entrada.uf,
    cep: entrada.cep,
  });

  const informada =
    typeof entrada.lat === 'number' && typeof entrada.lng === 'number'
      ? { lat: entrada.lat, lng: entrada.lng }
      : null;

  const final = informada ?? geocodificada;
  // Sem geocodificação e sem pin confirmado não há de onde tirar coordenada.
  if (!final) return null;

  const deslocou =
    geocodificada !== null &&
    informada !== null &&
    excedeLimiteDeAjuste(deslocamentoMetros(geocodificada, informada), config.limiteAjustePinM);

  const medida = await medirDistancia(config.origem, final, config.fatorDistanciaEstimada);

  return {
    geocodificada,
    final,
    distanciaKm: medida.distanciaKm,
    distanciaEstimada: medida.estimada,
    // Estimativa e pin muito deslocado são os dois caminhos para uma distância
    // que ninguém conferiu virar rota de entrega real.
    precisaConferencia: deslocou || medida.estimada || geocodificada === null,
  };
}

export async function listarEnderecos(): Promise<Endereco[]> {
  return (await listarAtivos()).map(paraEndereco);
}

export async function criarEndereco(
  entrada: EntradaEndereco,
  profileId: string,
): Promise<{ endereco: Endereco } | { falha: FalhaEndereco }> {
  const ativos = await contarAtivos();
  if (ativos >= MAX_ENDERECOS_ATIVOS) return { falha: 'limite-atingido' };

  const config = await carregarConfigDeArea();
  const posicao = await posicionar(entrada, config);
  if (!posicao) return { falha: 'falha-ao-gravar' };

  const area = avaliarArea({
    distanciaKm: posicao.distanciaKm,
    cep: entrada.cep,
    raioKm: config.raioKm,
    excecoes: config.excecoes,
  });

  const { data, error } = await inserir({
    profile_id: profileId,
    apelido: entrada.apelido,
    cep: entrada.cep,
    logradouro: entrada.logradouro,
    numero: entrada.numero,
    complemento: entrada.complemento ?? null,
    bairro: entrada.bairro ?? null,
    cidade: entrada.cidade,
    uf: entrada.uf,
    referencia: entrada.referencia ?? null,
    lat_geocode: posicao.geocodificada?.lat ?? null,
    lng_geocode: posicao.geocodificada?.lng ?? null,
    lat: posicao.final.lat,
    lng: posicao.final.lng,
    distancia_km: posicao.distanciaKm,
    distancia_estimada: posicao.distanciaEstimada,
    precisa_conferencia: posicao.precisaConferencia,
    atendido: area.atendido,
    motivo_nao_atendido: area.motivo,
    // O primeiro endereço nasce padrão (RN13). Marcar explicitamente o segundo
    // passa pela troca atômica, não por aqui.
    padrao: ativos === 0,
  });

  if (error || !data) return { falha: 'falha-ao-gravar' };

  if (entrada.padrao && ativos > 0) {
    await trocarPadrao(data.id);
    const atualizado = await lerAtivo(data.id);
    if (atualizado) return { endereco: paraEndereco(atualizado) };
  }

  return { endereco: paraEndereco(data) };
}

/**
 * Edição (RN12): só refaz geocodificação e rota se a coordenada mudou.
 *
 * Corrigir o ponto de referência não pode custar duas chamadas externas — cada
 * consulta é dinheiro e latência, e a distância de um endereço não muda sozinha.
 */
export async function atualizarEndereco(
  id: string,
  entrada: EntradaEndereco,
): Promise<{ endereco: Endereco } | { falha: FalhaEndereco }> {
  const atual = await lerAtivo(id);
  if (!atual) return { falha: 'nao-encontrado' };

  const campos: EdicaoEndereco = {
    apelido: entrada.apelido,
    cep: entrada.cep,
    logradouro: entrada.logradouro,
    numero: entrada.numero,
    complemento: entrada.complemento ?? null,
    bairro: entrada.bairro ?? null,
    cidade: entrada.cidade,
    uf: entrada.uf,
    referencia: entrada.referencia ?? null,
  };

  const mudouCoordenada =
    typeof entrada.lat === 'number' &&
    typeof entrada.lng === 'number' &&
    (entrada.lat !== Number(atual.lat) || entrada.lng !== Number(atual.lng));

  if (mudouCoordenada) {
    const config = await carregarConfigDeArea();
    const posicao = await posicionar(entrada, config);

    if (posicao) {
      const area = avaliarArea({
        distanciaKm: posicao.distanciaKm,
        cep: entrada.cep,
        raioKm: config.raioKm,
        excecoes: config.excecoes,
      });

      Object.assign(campos, {
        lat_geocode: posicao.geocodificada?.lat ?? null,
        lng_geocode: posicao.geocodificada?.lng ?? null,
        lat: posicao.final.lat,
        lng: posicao.final.lng,
        distancia_km: posicao.distanciaKm,
        distancia_estimada: posicao.distanciaEstimada,
        precisa_conferencia: posicao.precisaConferencia,
        atendido: area.atendido,
        motivo_nao_atendido: area.motivo,
      });
    }
  }

  const linha = await atualizar(id, campos);
  return linha ? { endereco: paraEndereco(linha) } : { falha: 'nao-encontrado' };
}

/** Desativa (RN15). A linha continua existindo para o histórico e a auditoria de entrega. */
export async function desativarEndereco(id: string): Promise<boolean> {
  return (await atualizar(id, { ativo: false, padrao: false })) !== null;
}

export async function definirPadrao(id: string): Promise<boolean> {
  return trocarPadrao(id);
}

/**
 * Frete de um endereço (RN7, RN8, RN16). Contrato que o checkout do NAPO-006
 * consome — por isso nasce aqui, e não lá.
 *
 * O endereço é lido do banco pelo id, sob a RLS do dono; nada de distância vinda
 * do cliente (RN5, T17).
 */
export async function calcularFreteDoEndereco(
  enderecoId: string,
  subtotalCentavos: number,
): Promise<ResultadoFrete | null> {
  const endereco = await lerAtivo(enderecoId);
  if (!endereco) return null;

  const config = await carregarConfigDeArea();

  return calcularFrete({
    distanciaKm: endereco.distancia_km === null ? null : Number(endereco.distancia_km),
    subtotalCentavos,
    atendido: endereco.atendido,
    motivoNaoAtendido: endereco.motivo_nao_atendido,
    faixas: config.faixas,
    freteGratisCentavos: config.freteGratisCentavos,
  });
}
