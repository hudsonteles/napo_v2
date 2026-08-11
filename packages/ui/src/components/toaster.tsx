'use client';

import { Toaster as Sonner } from 'sonner';

/**
 * Container de toasts do projeto — arquitetura §4.4 exige Toast para info e
 * sucesso e proíbe `alert()`. Tema fixo escuro: o Napo não tem modo claro.
 */
function Toaster(props: React.ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            'flex items-start gap-3 rounded-campo border border-borda-forte bg-superficie-alta px-4 py-3 text-sm text-texto-suave shadow-xl',
          title: 'text-branco font-medium',
          description: 'text-texto-suave',
          icon: 'text-amarelo',
          error: 'text-erro',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
export { toast } from 'sonner';
