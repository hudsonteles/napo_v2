'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { fornadaAtiva, type DiaDisponibilidade } from '../disponibilidade-view';

/**
 * Disponibilidade é ilha cliente sobre página estática (design §4.5): a página
 * inteira sai do CDN e SÓ este bloco busca `/api/disponibilidade` depois da
 * montagem. Uma busca só, compartilhada por seletor de fornada, barra e cards —
 * o motor governa a página inteira (RN13). A fornada ativa vive na querystring
 * (`?entrega=`), atualizada por `history` para o link ser compartilhável sem
 * recarregar e sem tornar a página dinâmica.
 */
export type EstadoDisponibilidadeGlobal =
  | { status: 'carregando' }
  | { status: 'erro' }
  | { status: 'ok'; dias: DiaDisponibilidade[]; dataAtiva: string };

interface Contexto {
  estado: EstadoDisponibilidadeGlobal;
  trocarFornada: (data: string) => void;
}

const DisponibilidadeContext = createContext<Contexto | null>(null);

export function DisponibilidadeProvider({ children }: { children: ReactNode }) {
  const [dias, setDias] = useState<DiaDisponibilidade[] | null>(null);
  const [erro, setErro] = useState(false);
  const [dataAtiva, setDataAtiva] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const entrega = new URLSearchParams(window.location.search).get('entrega');

    fetch('/api/disponibilidade')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((json) => {
        if (!vivo) return;
        if (!json?.success) {
          setErro(true);
          return;
        }
        const ds: DiaDisponibilidade[] = json.data.dias;
        setDias(ds);
        setDataAtiva(fornadaAtiva(ds, entrega));
      })
      .catch(() => {
        if (vivo) setErro(true);
      });

    return () => {
      vivo = false;
    };
  }, []);

  const trocarFornada = (data: string) => {
    setDataAtiva(data);
    const url = new URL(window.location.href);
    url.searchParams.set('entrega', data);
    window.history.replaceState(null, '', url.toString());
  };

  const estado: EstadoDisponibilidadeGlobal = erro
    ? { status: 'erro' }
    : dias && dataAtiva
      ? { status: 'ok', dias, dataAtiva }
      : { status: 'carregando' };

  return (
    <DisponibilidadeContext.Provider value={{ estado, trocarFornada }}>
      {children}
    </DisponibilidadeContext.Provider>
  );
}

export function useDisponibilidade(): Contexto {
  const ctx = useContext(DisponibilidadeContext);
  if (!ctx) throw new Error('useDisponibilidade precisa estar dentro de <DisponibilidadeProvider>');
  return ctx;
}
