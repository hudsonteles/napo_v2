import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn';

const botaoVariantes = cva(
  'inline-flex w-full items-center justify-center gap-3 whitespace-nowrap rounded-campo font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amarelo/40 focus-visible:ring-offset-2 focus-visible:ring-offset-superficie disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default:
          'bg-amarelo font-semibold text-preto hover:bg-amarelo-escuro disabled:bg-superficie-alta disabled:text-neutral-500 disabled:hover:bg-superficie-alta',
        outline:
          'border border-borda-forte bg-transparent hover:bg-superficie-alta disabled:border-borda disabled:text-neutral-500 disabled:hover:bg-transparent',
        ghost: 'text-texto-suave hover:bg-superficie-alta hover:text-branco',
        link: 'text-texto-suave underline underline-offset-2 hover:text-branco',
      },
      size: {
        default: 'min-h-12 px-4 py-3 text-[15px]',
        sm: 'min-h-11 px-4 py-2.5 text-sm',
        // Alvo de toque de 44px sem caixa visível — o link precisa passar no T40
        // sem virar botão (design §4.5: caminho de exceção não compete com a ação).
        link: 'min-h-11 w-auto px-0 text-sm',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof botaoVariantes> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(botaoVariantes({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, botaoVariantes };
