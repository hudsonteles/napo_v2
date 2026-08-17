'use client';

import { Minus, Plus } from 'lucide-react';

import { cn } from '../lib/cn';

export interface SeletorQuantidadeProps {
  valor: number;
  /** Opcional: no R1 o seletor nasce desabilitado, então um Server Component pode
   *  renderizá-lo sem passar handler (função não cruza a fronteira server→client). */
  onChange?: (valor: number) => void;
  /** Teto de estoque da fornada — o controle nunca oferece além do disponível. */
  max: number;
  min?: number;
  /** No R1 nasce desabilitado: o canal de compra abre no NAPO-006. */
  disabled?: boolean;
  className?: string;
}

/**
 * Controle −/n/+ com teto de estoque. Nasce aqui limitado ao disponível da
 * fornada e é o MESMO controle que o carrinho do NAPO-006 vai reusar — por isso
 * mora em `packages/ui`, não na feature. Alvo de toque de 44px em cada botão; um
 * `<input>` numérico não entrega nem o alvo nem o limite (design §4.4.3).
 */
export function SeletorQuantidade({
  valor,
  onChange,
  max,
  min = 1,
  disabled = false,
  className,
}: SeletorQuantidadeProps) {
  const decrementar = () => onChange?.(Math.max(min, valor - 1));
  const incrementar = () => onChange?.(Math.min(max, valor + 1));

  return (
    <div
      className={cn(
        'flex items-center rounded-campo border border-borda',
        disabled && 'text-neutral-500',
        className,
      )}
    >
      <button
        type="button"
        onClick={decrementar}
        disabled={disabled || valor <= min}
        aria-label="Diminuir quantidade"
        className="px-3 py-2.5 transition hover:text-branco disabled:cursor-not-allowed disabled:hover:text-inherit"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
        {valor}
      </span>
      <button
        type="button"
        onClick={incrementar}
        disabled={disabled || valor >= max}
        aria-label="Aumentar quantidade"
        className="px-3 py-2.5 transition hover:text-branco disabled:cursor-not-allowed disabled:hover:text-inherit"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
