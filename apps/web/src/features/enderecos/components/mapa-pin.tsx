'use client';

import { useEffect, useRef, useState } from 'react';
// API funcional da v2 do loader; a classe `Loader` está deprecada.
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

import type { Coordenada } from '@napo/core';

import { publicEnv } from '@/lib/env';

/**
 * Mapa com pin arrastável (RN6).
 *
 * Encapsula a Maps JS API e emite só `{lat, lng}` — o resto da feature não sabe
 * que existe Google aqui. Carrega pela chave de NAVEGADOR, restrita por
 * referrer; a de servidor não passa nem perto deste arquivo (T18).
 *
 * **O mapa não é o único caminho** (design §4.7): arrastar pin não é operável
 * por teclado, e um cadastro que exige mouse exclui. O endereço é válido sem
 * tocar aqui — o que o pin faz é corrigir geocodificação ruim.
 */
export function MapaPin({
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
  const [posicao, setPosicao] = useState<Coordenada>(centro);

  // `centro` só reposiciona o mapa quando a geocodificação chega; depois disso
  // quem manda é o arrasto do cliente, senão o pin pula de volta a cada render.
  const jaMontou = useRef(false);

  useEffect(() => {
    let cancelado = false;
    const alvo = container.current;
    if (!alvo || jaMontou.current) return;
    jaMontou.current = true;

    setOptions({ key: publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY, v: 'weekly' });

    importLibrary('maps')
      .then(async ({ Map }) => {
        const { AdvancedMarkerElement } = await importLibrary('marker');
        if (cancelado) return;

        const mapa = new Map(alvo, {
          center: centro,
          zoom: 17,
          mapId: 'napo-enderecos',
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
        });

        const marcador = new AdvancedMarkerElement({ map: mapa, position: centro, gmpDraggable: true });

        // Traço até o ponto original: é o que mostra ao cliente o tamanho do
        // desvio que ele acabou de criar, antes de ele salvar.
        const traco = new google.maps.Polyline({
          map: mapa,
          path: original ? [original, centro] : [],
          strokeOpacity: 0,
          icons: [
            {
              icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: '#3d3d3d', scale: 2 },
              offset: '0',
              repeat: '9px',
            },
          ],
        });

        marcador.addListener('dragend', () => {
          const p = marcador.position as google.maps.LatLngLiteral | null;
          if (!p) return;

          const nova = { lat: p.lat, lng: p.lng };
          setPosicao(nova);
          onMover(nova);
          if (original) traco.setPath([original, nova]);
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
    // Falha do mapa não trava o cadastro: a coordenada da geocodificação vale, e
    // o endereço nasce marcado para conferência. Mapa é conferência, não medição.
    // Markup cru consciente, mesma razão do aviso de CEP no formulário: aviso
    // informativo não tem primitivo no catálogo, e a superfície do mapa já é
    // exceção declarada no design §4.4.4.
    return (
      <div className="rounded-campo border border-borda-forte bg-superficie-alta px-4 py-3 text-sm text-texto-suave">
        Não foi possível carregar o mapa agora. Você pode salvar assim mesmo — a gente confere a
        posição antes da primeira entrega.
      </div>
    );
  }

  return (
    <div>
      <div
        ref={container}
        role="application"
        aria-label="Mapa para conferir onde a entrega chega"
        className="h-56 overflow-hidden rounded-campo border border-borda-forte sm:h-64"
      />
      <p className="mt-2 font-mono text-[11px] text-texto-suave">
        {posicao.lat.toFixed(6)}, {posicao.lng.toFixed(6)}
      </p>
    </div>
  );
}
