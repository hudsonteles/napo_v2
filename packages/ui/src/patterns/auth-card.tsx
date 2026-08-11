import * as React from 'react';

import { Card } from '../components/card';
import { Marca } from '../components/marca';
import { cn } from '../lib/cn';

interface AuthCardProps {
  titulo: string;
  subtitulo?: React.ReactNode;
  /** Ícone lucide exibido acima do título nos estados de desfecho (ex.: link enviado). */
  icone?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Moldura compartilhada pelas telas de autenticação: marca, título, subtítulo e
 * slot de conteúdo. Existe para que a mesma composição não seja replicada em cada
 * tela (arquitetura §2.2.1) e para que a navegação entre `/entrar` e
 * `/validar-telefone` não tenha salto — critério visual 7.
 *
 * A centralização na viewport é responsabilidade da página (design §4.4.4).
 */
function AuthCard({ titulo, subtitulo, icone, children, className }: AuthCardProps) {
  return (
    <Card className={cn('w-full max-w-[420px]', className)}>
      <div className="mb-8">
        <Marca />
      </div>

      {icone ? (
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-amarelo/10 text-amarelo">
          {icone}
        </div>
      ) : null}

      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      {subtitulo ? (
        <p className="mt-2 text-sm leading-relaxed text-texto-suave">{subtitulo}</p>
      ) : null}

      <div className="mt-7">{children}</div>
    </Card>
  );
}

export { AuthCard };
