'use client';

import { useState } from 'react';
import type { Categoria } from '@napo/core';
import { cn } from '@napo/ui/lib/cn';

import type { ProdutoVitrine } from '../tipos';
import { CardProduto } from './card-produto';

/**
 * Vitrine com filtro por categoria (RN3 da tela). Ilha cliente: o estado do
 * filtro vive no navegador, mas os cards já vêm renderizados do build (SSG). Só
 * mostra categorias que têm produto — filtro vazio não faz sentido na tela.
 */
export function VitrineFiltravel({
  produtos,
  categorias,
}: {
  produtos: ProdutoVitrine[];
  categorias: Categoria[];
}) {
  const [ativa, setAtiva] = useState<string | null>(null);

  const contar = (categoriaId: string) =>
    produtos.filter((p) => p.categoria.id === categoriaId).length;
  const comProdutos = categorias.filter((c) => contar(c.id) > 0);
  const visiveis = ativa ? produtos.filter((p) => p.categoria.id === ativa) : produtos;

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-2">
        <Chip ativo={ativa === null} onClick={() => setAtiva(null)}>
          Todos <span className="opacity-60">{produtos.length}</span>
        </Chip>
        {comProdutos.map((c) => (
          <Chip key={c.id} ativo={ativa === c.id} onClick={() => setAtiva(c.id)}>
            {c.nome} <span className="opacity-60">{contar(c.id)}</span>
          </Chip>
        ))}
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visiveis.map((item) => (
          <CardProduto key={item.produto.id} item={item} />
        ))}
      </div>
    </>
  );
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'rounded-full px-4 py-2 text-sm transition',
        ativo
          ? 'bg-branco font-semibold text-preto'
          : 'border border-borda-forte text-texto-suave hover:bg-superficie-alta hover:text-branco',
      )}
    >
      {children}
    </button>
  );
}
