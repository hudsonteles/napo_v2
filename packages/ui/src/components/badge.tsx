import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn';

/**
 * Rótulo compacto — primitivo que o NAPO-002 não precisou. É o veículo do
 * alérgeno na vitrine (RN3), do rótulo de categoria/faixa e de avisos curtos.
 * Os selos elaborados (ranking circular, carimbo de esgotado) são composições da
 * feature de catálogo, não deste primitivo (design §4.4.5).
 */
const badgeVariantes = cva(
  'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-amarelo text-preto',
        neutro: 'bg-superficie-alta text-texto-suave',
        contorno: 'border border-borda-forte text-texto-suave',
        // Alérgeno é informação crítica: cor é reforço, o texto carrega o sinal
        // (design §4.7). O vermelho não é o único indicador — o "Contém …" é.
        alergeno: 'bg-erro/[0.08] text-erro',
        // Estado do pedido (NAPO-006 §4.1): tom suave para "pago" — o selo diz o
        // estado sem gritar. Encerrados (cancelado/expirado/estornado) usam `neutro`.
        sucesso: 'bg-amarelo/[0.15] text-amarelo',
      },
      size: {
        default: 'px-2.5 py-1 text-xs',
        sm: 'px-2 py-0.5 text-[11px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariantes> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariantes({ variant, size, className }))} {...props} />;
}

export { Badge, badgeVariantes };
