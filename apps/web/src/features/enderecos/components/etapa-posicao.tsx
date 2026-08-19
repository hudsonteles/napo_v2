'use client';

import { useEffect, useRef, useState } from 'react';
import { Info, LoaderCircle } from 'lucide-react';

import {
  deslocamentoMetros,
  excedeLimiteDeAjuste,
  formatarReais,
  type Coordenada,
  type FaixaFrete,
} from '@napo/core';
import { Button } from '@napo/ui/components/button';

import type { EntradaEndereco, MedidaDaPosicao, PosicaoAvaliada } from '../schema';
import { desvioDoSugerido, MapaConfirmacao } from './mapa-confirmacao';
import { formatarKm, ReguaDistancia } from './regua-distancia';

export interface ConfigDeExibicao {
  raioKm: number;
  faixas: FaixaFrete[];
  limiteAjustePinM: number;
}

/**
 * Etapa 2 do cadastro: confirmar onde a entrega chega (drift.md).
 *
 * A régua de distância fica **colada à confirmação** de propósito: mover o mapa
 * move o dinheiro, e é isso que dá motivo para olhar. Quem confirma não está
 * conferindo um pin — está conferindo quanto custa.
 *
 * Mover além do limite **risca** o valor e anuncia o recálculo. O contrário —
 * deixar o número mudar calado depois de salvar — é a mesma desonestidade que a
 * RN11 combate na distância estimada.
 */
/** Espera depois que o mapa para, antes de medir. Ajuste fino não vira chamada. */
const ESPERA_ANTES_DE_MEDIR_MS = 600;

/** Abaixo disso é tremor de dedo, não mudança de porta. */
const MOVIMENTO_MINIMO_M = 30;

export function EtapaPosicao({
  endereco,
  entrada,
  posicao,
  config,
  salvando,
  onConfirmar,
  onVoltar,
}: {
  /** Uma linha com o que a pessoa digitou: confirma-se uma posição, não um endereço abstrato. */
  endereco: string;
  /** O contrato validado da etapa 1, para remedir a cada ajuste. */
  entrada: EntradaEndereco;
  posicao: PosicaoAvaliada;
  config: ConfigDeExibicao;
  salvando: boolean;
  onConfirmar: (coordenada: Coordenada) => void;
  onVoltar: () => void;
}) {
  const [centro, setCentro] = useState<Coordenada>(posicao.final);
  const [medida, setMedida] = useState<MedidaDaPosicao | null>(null);
  const [medindo, setMedindo] = useState(false);
  const ultimoMedido = useRef<Coordenada>(posicao.final);

  /**
   * Mede de novo a cada ajuste do mapa (decisão do PM, 2026-08-18).
   *
   * A régua existe para que mover o mapa mova o dinheiro — riscar o número e
   * esperar a confirmação matava justamente isso. Dois filtros mantêm o custo
   * honesto: espera depois que o movimento para, e ignora deslocamento de ruído.
   */
  useEffect(() => {
    if (deslocamentoMetros(ultimoMedido.current, centro) < MOVIMENTO_MINIMO_M) return;

    let cancelado = false;
    const relogio = setTimeout(async () => {
      setMedindo(true);
      try {
        const resposta = await fetch('/api/enderecos/medida', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...entrada, lat: centro.lat, lng: centro.lng }),
        });
        const corpo = await resposta.json();
        if (cancelado || !resposta.ok || !corpo.success) return;

        ultimoMedido.current = centro;
        setMedida(corpo.data as MedidaDaPosicao);
      } finally {
        if (!cancelado) setMedindo(false);
      }
    }, ESPERA_ANTES_DE_MEDIR_MS);

    return () => {
      cancelado = true;
      clearTimeout(relogio);
    };
  }, [centro, entrada]);

  const desvio = desvioDoSugerido(posicao.geocodificada, centro);
  const moveu = desvio !== null && excedeLimiteDeAjuste(desvio, config.limiteAjustePinM);
  // Sem geocodificação não há ponto sugerido; a medição só existe depois do
  // primeiro ajuste, e é ela que manda quando existe.
  const semSugestao = posicao.geocodificada === null && medida === null;
  const atual = medida ?? posicao;
  const mostrarMedida = !semSugestao;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-campo border border-borda bg-superficie px-4 py-3">
        <p className="text-sm">{endereco}</p>
        <button
          type="button"
          onClick={onVoltar}
          className="text-xs text-texto-suave underline underline-offset-2 hover:text-branco"
        >
          editar
        </button>
      </div>

      {semSugestao && (
        <div className="mt-4 flex gap-3 rounded-campo border border-borda-forte bg-superficie-alta px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amarelo" />
          <p className="text-sm text-texto-suave">
            Não achamos esse endereço no mapa — acontece com quadra nova e chácara.{' '}
            <span className="text-branco">Centralize onde a entrega deve chegar</span> e a gente
            confere antes da primeira viagem.
          </p>
        </div>
      )}

      <div className="mt-4">
        <MapaConfirmacao
          centro={posicao.final}
          original={posicao.geocodificada}
          onMover={setCentro}
        />
      </div>

      {/* Barra de confirmação: markup cru declarado no design §4.4.4 (bloco de dado
          único que não se repete em outra tela). */}
      <div
        className={
          moveu || !mostrarMedida
            ? 'mt-4 rounded-card border border-dashed border-borda-forte bg-superficie/50 p-5'
            : 'mt-4 rounded-card border border-borda-forte bg-superficie p-5'
        }
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] tracking-widest text-texto-suave">
              DA COZINHA ATÉ AQUI
            </p>
            {mostrarMedida ? (
              <p className="mt-0.5 flex items-center gap-2 text-lg font-semibold tabular-nums">
                {atual.distanciaEstimada ? '~' : ''}
                {formatarKm(atual.distanciaKm)} km
                {atual.frete.faixa &&
                  ` · faixa ${atual.frete.faixa.kmDe}–${atual.frete.faixa.kmAte} km`}
                {medindo && (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin text-amarelo motion-reduce:animate-none"
                    aria-label="Recalculando a distância"
                  />
                )}
              </p>
            ) : (
              <p className="mt-0.5 text-lg font-semibold text-texto-suave">
                {medindo ? 'medindo…' : 'centralize e a gente calcula'}
              </p>
            )}
          </div>

          <div className="text-right">
            {!mostrarMedida ? (
              <p className="text-sm font-semibold text-texto-suave">calculamos ao confirmar</p>
            ) : atual.atendido ? (
              <>
                <p className="text-2xl font-bold tabular-nums">
                  {formatarReais(atual.frete.freteCentavos ?? 0)}
                </p>
                <p className="text-xs text-texto-suave">grátis acima de R$ 150,00</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">ainda não entregamos aí</p>
                <p className="text-xs text-texto-suave">seu endereço fica salvo</p>
              </>
            )}
          </div>
        </div>

        <div className={medindo ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
          <ReguaDistancia
            distanciaKm={semSugestao ? null : atual.distanciaKm}
            raioKm={config.raioKm}
            faixas={config.faixas}
            atendido={atual.atendido}
          />
        </div>

        {moveu && (
          <p className="mt-4 flex gap-2 text-sm text-texto-suave">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amarelo" />
            Você moveu bastante — vamos conferir esse endereço antes da primeira entrega.
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          largura="natural"
          disabled={salvando}
          onClick={() => onConfirmar(centro)}
        >
          {salvando ? 'Salvando…' : 'Confirmar localização'}
        </Button>
        <Button variant="ghost" size="sm" largura="natural" onClick={onVoltar}>
          Voltar e corrigir o endereço
        </Button>
      </div>

      {/* design §4.7: mover mapa não é operável por teclado. Confirmar o ponto
          sugerido nunca depende do gesto — este botão é a saída explícita, e o
          endereço é salvo com o mesmo tratamento da geocodificação sem resultado. */}
      <button
        type="button"
        disabled={salvando}
        onClick={() => onConfirmar(posicao.final)}
        className="mt-3 text-sm text-texto-suave underline underline-offset-2 hover:text-branco disabled:opacity-60"
      >
        Não consigo ajustar no mapa
      </button>
    </div>
  );
}
