'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { ItemCarrinho } from '@napo/core';
import { normalizarItens } from '@napo/core';

import { gravarCarrinho, lerCarrinho } from './armazenamento';

interface CarrinhoContexto {
  itens: ItemCarrinho[];
  totalUnidades: number;
  /** `true` até a hidratação do `localStorage` — o contador espera para não piscar 0. */
  pronto: boolean;
  adicionar(produtoId: string, quantidade?: number): void;
  definirQuantidade(produtoId: string, quantidade: number): void;
  remover(produtoId: string): void;
  limpar(): void;
}

const Contexto = createContext<CarrinhoContexto | null>(null);

/**
 * Estado do carrinho como ilha cliente sobre páginas estáticas (design §5,
 * decisão 8). Mora em `lib` porque o botão "Adicionar" vive em `features/catalogo`
 * e a regra de arquitetura proíbe feature importar de feature; de `lib` o import
 * é legal para todas. As regras de dinheiro ficam em `packages/core`, não aqui.
 */
export function CarrinhoProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [pronto, setPronto] = useState(false);

  // Hidrata só no cliente, após a montagem: o servidor não tem `localStorage` e
  // ler durante o render tiraria a página do estático.
  useEffect(() => {
    setItens(lerCarrinho());
    setPronto(true);
  }, []);

  // Persiste a cada mudança — mas só depois de hidratar, senão o array vazio
  // inicial sobrescreveria um carrinho salvo antes de ele ser lido.
  useEffect(() => {
    if (pronto) gravarCarrinho(itens);
  }, [itens, pronto]);

  const adicionar = useCallback((produtoId: string, quantidade = 1) => {
    setItens((atuais) => normalizarItens([...atuais, { produtoId, quantidade }]));
  }, []);

  const definirQuantidade = useCallback((produtoId: string, quantidade: number) => {
    setItens((atuais) =>
      normalizarItens([...atuais.filter((i) => i.produtoId !== produtoId), { produtoId, quantidade }]),
    );
  }, []);

  const remover = useCallback((produtoId: string) => {
    setItens((atuais) => atuais.filter((i) => i.produtoId !== produtoId));
  }, []);

  const limpar = useCallback(() => setItens([]), []);

  const totalUnidades = useMemo(
    () => itens.reduce((total, i) => total + i.quantidade, 0),
    [itens],
  );

  const valor = useMemo<CarrinhoContexto>(
    () => ({ itens, totalUnidades, pronto, adicionar, definirQuantidade, remover, limpar }),
    [itens, totalUnidades, pronto, adicionar, definirQuantidade, remover, limpar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCarrinho(): CarrinhoContexto {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error('useCarrinho precisa de um <CarrinhoProvider> acima na árvore.');
  }
  return contexto;
}
