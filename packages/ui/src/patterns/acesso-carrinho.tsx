import { ShoppingBag } from 'lucide-react';

import { cn } from '../lib/cn';

export interface AcessoCarrinhoProps {
  /** `0` esconde o contador: bolinha zerada é ruído, não informação. */
  quantidade: number;
  href?: string;
  className?: string;
}

/**
 * Acesso ao carrinho no cabeçalho (design §4.4.4).
 *
 * Nasce como componente novo porque nenhum primitivo do catálogo compõe ícone
 * com contador sobreposto, estado vazio e alvo de toque de 44 px. Mora em
 * `patterns` porque o cabeçalho é do catálogo e não pode importar de uma feature
 * do app (ARCHITECTURE §3.2).
 *
 * Não sabe contar: quem sabe quantos itens há é a ilha cliente que o envolve.
 */
export function AcessoCarrinho({ quantidade, href = '/carrinho', className }: AcessoCarrinhoProps) {
  const vazio = quantidade <= 0;

  return (
    <a
      href={href}
      aria-label={vazio ? 'Carrinho vazio' : `Carrinho com ${quantidade} ${quantidade === 1 ? 'item' : 'itens'}`}
      className={cn(
        'relative ml-1 flex h-11 w-11 items-center justify-center rounded-campo text-texto-suave transition hover:bg-superficie-alta hover:text-branco',
        className,
      )}
    >
      <ShoppingBag className="h-5 w-5" />
      {!vazio && (
        <span
          className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amarelo px-1 font-mono text-[10px] font-bold text-preto"
          aria-hidden
        >
          {quantidade}
        </span>
      )}
    </a>
  );
}
