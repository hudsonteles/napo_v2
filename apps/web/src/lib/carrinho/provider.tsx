'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { type ItemCarrinho, normalizarItens } from '@napo/core';

import { gravarCarrinho, lerCarrinho, limparCarrinho } from './armazenamento';

/**
 * Estado do carrinho no navegador (RN1).
 *
 * Mora em `lib`, não em `features`: o botão "Adicionar" vive dentro de
 * `features/catalogo` e feature não importa de feature (design §5 decisão 1).
 * As regras que valem dinheiro ficam em `packages/core` — aqui só há estado.
 */
interface Carrinho {
  itens: ItemCarrinho[];
  quantidadeTotal: number;
  /**
   * `false` até o navegador devolver o que estava guardado. O contador espera
   * por isso: renderizar 0 no servidor e 3 logo depois é remonta visível, e
   * assumir 3 no servidor é erro de hidratação.
   */
  pronto: boolean;
  adicionar: (produtoId: string, quantidade: number) => void;
  definirQuantidade: (produtoId: string, quantidade: number) => void;
  remover: (produtoId: string) => void;
  limpar: () => void;
}

const ContextoCarrinho = createContext<Carrinho | null>(null);

export function ProvedorCarrinho({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [pronto, setPronto] = useState(false);

  // Ler no efeito, e não no estado inicial, é o que mantém a primeira
  // renderização igual à do servidor — o `(site)` é estático (ARCHITECTURE §4.5).
  useEffect(() => {
    setItens(lerCarrinho());
    setPronto(true);
  }, []);

  const aplicar = useCallback((proximos: ItemCarrinho[]) => {
    const normalizados = normalizarItens(proximos);
    setItens(normalizados);
    gravarCarrinho(normalizados);
  }, []);

  const valor = useMemo<Carrinho>(
    () => ({
      itens,
      quantidadeTotal: itens.reduce((total, item) => total + item.quantidade, 0),
      pronto,
      adicionar: (produtoId, quantidade) => aplicar([...itens, { produtoId, quantidade }]),
      // Mapear em vez de remover e reinserir: trocar a quantidade não pode
      // fazer a linha pular para o fim da lista debaixo do dedo de quem clicou.
      definirQuantidade: (produtoId, quantidade) =>
        aplicar(
          itens.map((item) => (item.produtoId === produtoId ? { ...item, quantidade } : item)),
        ),
      remover: (produtoId) => aplicar(itens.filter((item) => item.produtoId !== produtoId)),
      limpar: () => {
        setItens([]);
        limparCarrinho();
      },
    }),
    [itens, pronto, aplicar],
  );

  return <ContextoCarrinho.Provider value={valor}>{children}</ContextoCarrinho.Provider>;
}

export function useCarrinho(): Carrinho {
  const carrinho = useContext(ContextoCarrinho);
  if (!carrinho) throw new Error('useCarrinho precisa estar dentro de <ProvedorCarrinho>.');
  return carrinho;
}
