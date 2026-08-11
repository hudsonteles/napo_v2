'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

import { cn } from '../lib/cn';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded-[4px] border border-borda-forte bg-superficie-alta outline-none transition focus-visible:ring-2 focus-visible:ring-amarelo/40 focus-visible:ring-offset-2 focus-visible:ring-offset-superficie disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:border-amarelo data-[state=checked]:bg-amarelo data-[state=checked]:text-preto',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="grid place-items-center text-current">
      <Check className="h-3 w-3" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
