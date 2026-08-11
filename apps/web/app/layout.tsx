import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { Toaster } from '@napo/ui/components/toaster';

import './globals.css';

// `next/font` fixa a fonte no build e emite a variável que `tokens.css` consome —
// sem requisição a terceiros em runtime e sem CLS (arquitetura §7.1).
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Napo',
  description: 'Pizza napolitana congelada premium em Brasília.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-dvh bg-preto font-sans text-branco antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
