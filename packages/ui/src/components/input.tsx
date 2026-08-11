import * as React from 'react';

import { cn } from '../lib/cn';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'min-h-12 w-full rounded-campo border border-borda-forte bg-superficie-alta px-4 py-3 text-[15px] outline-none transition placeholder:text-neutral-500 focus:border-amarelo focus:ring-2 focus:ring-amarelo/30 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-erro',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
