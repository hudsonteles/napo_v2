'use client';

import { useEffect, useRef, useState } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { MapPin } from 'lucide-react';

import { deslocamentoMetros, type Coordenada } from '@napo/core';

import { publicEnv } from '@/lib/env';

/**
 * Mapa de confirmação da etapa 2 (RN6, drift.md).
 *
 * **O pin não se arrasta: ele mora no centro da tela e o mapa se move embaixo.**
 * É o padrão do iFood, do Uber e do Google Maps, e o motivo é físico — em celular
 * o alvo de arraste é pequeno e o dedo cobre exatamente o que a pessoa precisa
 * ver. O pin fixo é markup nosso, sobreposto; a API nem sabe que ele existe.
 *
 * Carrega pela chave de NAVEGADOR, restrita por referrer. A de servidor não passa
 * perto deste arquivo (T18).
 *
 * `design.md` §4.7: mover mapa não é operável por teclado. Este componente nunca
 * é o único caminho — quem não interage confirma o ponto que já está lá.
 */
export function MapaConfirmacao({
  centro,
  original,
  onMover,
}: {
  centro: Coordenada;
  /** Ponto que a geocodificação devolveu, quando houve. Desenha o traço do desvio. */
  original: Coordenada | null;
  onMover: (coordenada: Coordenada) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [erro, setErro] = useState(false);
  const jaMontou = useRef(false);

  useEffect(() => {
    let cancelado = false;
    const alvo = container.current;
    if (!alvo || jaMontou.current) return;
    jaMontou.current = true;

    setOptions({ key: publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY, v: 'weekly' });

    importLibrary('maps')
      .then(({ Map, Polyline }) => {
        if (cancelado) return;

        // Sem `mapId`: um Map ID não registrado no console faz o Google recusar o
        // estilo e a div fica em branco.
        const mapa = new Map(alvo, {
          center: centro,
          zoom: 18,
          disableDefaultUI: true,
          zoomControl: true,
          // `greedy`: aqui mover o mapa É a tarefa. `cooperative` exigiria dois
          // dedos e transformaria a ação principal em atrito.
          gestureHandling: 'greedy',
          clickableIcons: false,
        });

        const traco = new Polyline({
          map: mapa,
          path: [],
          strokeOpacity: 0,
          icons: [
            {
              icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: '#3d3d3d', scale: 2 },
              offset: '0',
              repeat: '9px',
            },
          ],
        });

        // `idle` e não `center_changed`: dispara uma vez quando o movimento para,
        // e não a cada quadro do arrasto. Cada disparo vira recálculo na tela.
        mapa.addListener('idle', () => {
          const centroAtual = mapa.getCenter();
          if (!centroAtual) return;

          const nova = { lat: centroAtual.lat(), lng: centroAtual.lng() };
          onMover(nova);
          traco.setPath(original ? [original, nova] : []);
        });
      })
      .catch(() => {
        if (!cancelado) setErro(true);
      });

    return () => {
      cancelado = true;
    };
  }, [centro, original, onMover]);

  if (erro) {
    // Falha do mapa não trava o cadastro: vale a coordenada da geocodificação e o
    // endereço nasce marcado para conferência. Mapa é conferência, não medição.
    return (
      <div className="rounded-campo border border-borda-forte bg-superficie-alta px-4 py-3 text-sm text-texto-suave">
        Não foi possível carregar o mapa agora. Pode confirmar assim mesmo — a gente confere a
        posição antes da primeira entrega.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-card border border-borda-forte">
      <div
        ref={container}
        role="application"
        aria-label="Mapa para centralizar onde a entrega chega"
        className="h-72 sm:h-80"
      />

      {/* Pin fixo no centro. `pointer-events-none` para não roubar o gesto do mapa. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
        <MapPin className="h-9 w-9 text-amarelo drop-shadow-lg" />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amarelo/60" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3">
        <span className="rounded-full bg-preto/85 px-3 py-1 text-[11px] text-texto-suave">
          arraste o mapa para centralizar na sua porta
        </span>
      </div>
    </div>
  );
}

/** Distância entre o ponto sugerido e o centro atual, em metros. `null` sem sugestão. */
export function desvioDoSugerido(
  original: Coordenada | null,
  atual: Coordenada | null,
): number | null {
  return original && atual ? deslocamentoMetros(original, atual) : null;
}
