import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Napo — verificação da fundação',
  description: 'Tela crua de verificação (NAPO-001). O site nasce no NAPO-003.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#0a0a0a',
          color: '#ffffff',
        }}
      >
        {children}
      </body>
    </html>
  );
}
