import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * Recipiente visual do projeto. Sem sombra abaixo de 640px — em tela pequena a
 * sombra sugere modal e induz a procurar o botão de fechar (design §4.6).
 */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-card border border-borda bg-superficie p-8 sm:shadow-2xl sm:shadow-black/40',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export { Card };
