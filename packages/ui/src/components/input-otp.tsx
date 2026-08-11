'use client';

import * as React from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';

import { cn } from '../lib/cn';

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
  <OTPInput
    ref={ref}
    containerClassName={cn(
      'flex w-full items-center gap-2.5 has-[:disabled]:opacity-60',
      containerClassName,
    )}
    className={cn('disabled:cursor-not-allowed', className)}
    {...props}
  />
));
InputOTP.displayName = 'InputOTP';

const InputOTPGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex w-full gap-2.5', className)} {...props} />
  ),
);
InputOTPGroup.displayName = 'InputOTPGroup';

interface InputOTPSlotProps extends React.HTMLAttributes<HTMLDivElement> {
  index: number;
  /** Pinta a casa de vermelho quando o código conferido não bate (design §4.3). */
  invalido?: boolean;
}

const InputOTPSlot = React.forwardRef<HTMLDivElement, InputOTPSlotProps>(
  ({ index, invalido = false, className, ...props }, ref) => {
    const contexto = React.useContext(OTPInputContext);
    const casa = contexto.slots[index];

    return (
      <div
        ref={ref}
        className={cn(
          'relative grid h-14 w-full place-items-center rounded-campo border border-borda-forte bg-superficie-alta text-xl font-semibold transition',
          casa?.isActive && 'border-2 border-amarelo',
          invalido && 'border-erro bg-erro/5 text-erro',
          className,
        )}
        {...props}
      >
        {casa?.char}
        {casa?.hasFakeCaret ? (
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="h-6 w-px animate-caret-blink bg-branco duration-1000" />
          </span>
        ) : null}
      </div>
    );
  },
);
InputOTPSlot.displayName = 'InputOTPSlot';

export { InputOTP, InputOTPGroup, InputOTPSlot };
