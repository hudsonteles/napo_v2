'use client';

import { useEffect, useRef, useState } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { Maximize2, Minimize2 } from 'lucide-react';

import { deslocamentoMetros, type Coordenada } from '@napo/core';

import { PinNapo } from './pin-napo';

import { publicEnv } from '@/lib/env';

declare global {
  interface Window {
    /** Callback que a Maps JS API chama quando recusa a chave. */
    gm_authFailure?: () => void;
  }
}

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
/**
 * Basemap na paleta do produto.
 *
 * O mapa claro padrão é um retângulo cinza no meio de uma interface preta — a
 * emenda aparece, e o pin some no cinza. Escurecer o mapa resolve as duas coisas
 * de uma vez: a tela vira uma só, e o amarelo passa a ser a coisa mais clara na
 * área depois do próprio pin.
 *
 * Aplicado por `styles` (JS) e não por Map ID em nuvem: Map ID exigiria passo de
 * console e viraria dependência externa (drift.md).
 */
const TEMA_ESCURO: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#141414' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a1a1a1' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#3d3d3d' }] },
  // Vias principais mais claras: é por elas que a pessoa se orienta para achar
  // a própria quadra.
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4a4a4a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#191919' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

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
  // A tela cheia é do CONTÊINER, não da div do mapa: o pin é um elemento irmão
  // dela, e o controle nativo do Google deixaria o pin para trás.
  const moldura = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<google.maps.Map | null>(null);
  const [erro, setErro] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);

  // `onMover` chega novo a cada render do pai. Guardado em ref, ele sai da lista
  // de dependências e para de remontar o mapa a cada digitação.
  const aoMover = useRef(onMover);
  aoMover.current = onMover;

  // Dependências primitivas, não os objetos `{lat,lng}`: literal novo a cada
  // render remontaria o mapa sem parar. E **sem** guarda de "já montei": com o
  // StrictMode do dev, React monta → desmonta → monta, e uma guarda que não se
  // desfaz no cleanup faz a montagem real sair pela porta dos fundos — o mapa
  // nunca é criado e só o pin sobreposto aparece.
  const { lat, lng } = centro;
  const origemLat = original?.lat ?? null;
  const origemLng = original?.lng ?? null;

  useEffect(() => {
    let cancelado = false;
    const alvo = container.current;
    if (!alvo) return;

    setOptions({ key: publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY, v: 'weekly' });

    // Chave recusada (referrer errado, faturamento desligado, API não habilitada)
    // não rejeita a promise: o Google chama este callback global e deixa a área
    // cinza. Sem isto, a falha mais provável em produção é a mais silenciosa.
    window.gm_authFailure = () => {
      if (!cancelado) setErro(true);
    };

    const inicial = { lat, lng };
    const sugerido = origemLat !== null && origemLng !== null ? { lat: origemLat, lng: origemLng } : null;

    importLibrary('maps')
      .then(async ({ Map, Polyline, MapTypeControlStyle }) => {
        const { ControlPosition, SymbolPath } = await importLibrary('core');
        const { Marker } = await importLibrary('marker');
        if (cancelado) return;

        // Sem `mapId`: um Map ID não registrado no console faz o Google recusar o
        // estilo e a div fica em branco.
        const mapa = new Map(alvo, {
          center: inicial,
          zoom: 18,
          // Híbrido por padrão: telhado, portão e muro identificam a casa melhor
          // que o nome da rua — que é justamente o que estava ambíguo quando a
          // pessoa chegou até aqui. O tema escuro abaixo vale quando ela troca
          // para "Mapa"; imagem de satélite não é estilizável.
          mapTypeId: 'hybrid',
          disableDefaultUI: true,
          zoomControl: true,
          // Tela cheia: em celular, conferir a porta numa faixa de 288px é o que
          // faz a pessoa desistir de conferir.
          // Nosso, não o nativo — ver `moldura` acima.
          fullscreenControl: false,
          // Satélite não é enfeite aqui: telhado e portão identificam a casa
          // melhor que o nome da rua, que é justamente o que estava ambíguo.
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: MapTypeControlStyle.HORIZONTAL_BAR,
            position: ControlPosition.TOP_LEFT,
            mapTypeIds: ['roadmap', 'hybrid'],
          },
          styles: TEMA_ESCURO,
          // `greedy`: aqui mover o mapa É a tarefa. `cooperative` exigiria dois
          // dedos e transformaria a ação principal em atrito.
          gestureHandling: 'greedy',
          clickableIcons: false,
        });

        // Duas linhas sobre o mesmo caminho. Traço único não sobrevive a imagem
        // de satélite: cinza some no asfalto, branco some no telhado claro. O
        // halo escuro embaixo dá borda ao branco de cima, e o par lê em qualquer
        // fundo — é o mesmo princípio do contorno do pin.
        const halo = new Polyline({
          map: mapa,
          path: [],
          strokeColor: '#0a0a0a',
          strokeOpacity: 0.65,
          strokeWeight: 5,
        });

        const traco = new Polyline({
          map: mapa,
          path: [],
          strokeOpacity: 0,
          icons: [
            {
              icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: '#ffffff', scale: 2.4 },
              offset: '0',
              repeat: '10px',
            },
          ],
        });

        // O ponto que a geocodificação sugeriu, para o desvio ter origem visível.
        new Marker({
          map: sugerido ? mapa : null,
          position: sugerido ?? undefined,
          clickable: false,
          icon: {
            path: SymbolPath.CIRCLE,
            scale: 5,
            fillColor: '#ffffff',
            fillOpacity: 1,
            strokeColor: '#0a0a0a',
            strokeWeight: 2,
          },
        });

        mapaRef.current = mapa;

        // `idle` e não `center_changed`: dispara uma vez quando o movimento para,
        // e não a cada quadro do arrasto. Cada disparo vira recálculo na tela.
        mapa.addListener('idle', () => {
          const centroAtual = mapa.getCenter();
          if (!centroAtual) return;

          const nova = { lat: centroAtual.lat(), lng: centroAtual.lng() };
          aoMover.current(nova);
          const caminho = sugerido ? [sugerido, nova] : [];
          halo.setPath(caminho);
          traco.setPath(caminho);
        });
      })
      .catch(() => {
        if (!cancelado) setErro(true);
      });

    return () => {
      cancelado = true;
      delete window.gm_authFailure;
    };
  }, [lat, lng, origemLat, origemLng]);

  // Sair da tela cheia por `Esc` não passa pelo nosso botão: o estado tem de vir
  // do navegador, senão o ícone mente.
  useEffect(() => {
    function aoTrocar() {
      const cheia = document.fullscreenElement === moldura.current;
      setTelaCheia(cheia);
      // O contêiner mudou de tamanho; recentralizar mantém a porta no pin.
      const mapa = mapaRef.current;
      const centroAtual = mapa?.getCenter();
      if (mapa && centroAtual) requestAnimationFrame(() => mapa.setCenter(centroAtual));
    }

    document.addEventListener('fullscreenchange', aoTrocar);
    return () => document.removeEventListener('fullscreenchange', aoTrocar);
  }, []);

  async function alternarTelaCheia() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await moldura.current?.requestFullscreen().catch(() => setErro(false));
  }

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
    <div
      ref={moldura}
      className={
        telaCheia
          ? 'relative h-screen w-screen bg-preto'
          : 'relative overflow-hidden rounded-card border border-borda-forte'
      }
    >
      <div
        ref={container}
        role="application"
        aria-label="Mapa para centralizar onde a entrega chega"
        className={telaCheia ? 'h-full w-full' : 'h-72 sm:h-80'}
      />

      <button
        type="button"
        onClick={alternarTelaCheia}
        aria-label={telaCheia ? 'Sair da tela cheia' : 'Ver em tela cheia'}
        className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-campo border border-borda-forte bg-preto/85 text-branco transition hover:bg-superficie-alta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amarelo/40"
      >
        {telaCheia ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>

      {/* Pin fixo no centro. `pointer-events-none` para não roubar o gesto do mapa. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
        <PinNapo />
      </div>

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
