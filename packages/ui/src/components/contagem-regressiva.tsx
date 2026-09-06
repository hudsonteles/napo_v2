'use client';

import * as React from 'react';
import { formatarContagem } from '@napo/core';

import { cn } from '../lib/cn';

/**
 * Contagem regressiva até um instante, em `mm:ss`.
 *
 * Existe porque um prazo escrito em prosa some da memória: "sua entrega fica
 * reservada por 30 minutos" aparece uma vez e o cliente segue digitando o
 * cartão sem noção do tempo. Com o relógio correndo, a pressa fica justificada
 * e a expiração deixa de ser surpresa — é o que torna justa a regra de não
 * reiniciar o prazo a cada tentativa recusada.
 *
 * `aoZerar` dispara **uma vez**, e é ele que manda a tela retirar o pagamento:
 * deixar o formulário de pé depois do prazo seria oferecer um pagamento que o
 * servidor vai recusar — ou, pior, aceitar sem vaga.
 */
export interface ContagemRegressivaProps extends React.HTMLAttributes<HTMLTimeElement> {
  /** Instante final, em ISO 8601. */
  ate: string;
  aoZerar?: () => void;
}

function restanteAte(ate: string): number {
  return new Date(ate).getTime() - Date.now();
}

function ContagemRegressiva({ ate, aoZerar, className, ...props }: ContagemRegressivaProps) {
  const [restante, setRestante] = React.useState(() => restanteAte(ate));
  const zerou = React.useRef(false);

  // `aoZerar` costuma ser uma função nova a cada render do pai; guardá-la em ref
  // evita que o intervalo seja destruído e recriado a cada segundo.
  const aoZerarRef = React.useRef(aoZerar);
  aoZerarRef.current = aoZerar;

  React.useEffect(() => {
    zerou.current = false;

    const tique = () => {
      const agora = restanteAte(ate);
      setRestante(agora);

      if (agora <= 0 && !zerou.current) {
        zerou.current = true;
        aoZerarRef.current?.();
      }
    };

    tique();
    const intervalo = setInterval(tique, 1000);
    return () => clearInterval(intervalo);
  }, [ate]);

  return (
    <time
      dateTime={ate}
      // Servidor e navegador leem relógios diferentes: a diferença de um
      // segundo no primeiro paint é esperada, não é bug de renderização.
      suppressHydrationWarning
      className={cn('font-mono tabular-nums', className)}
      {...props}
    >
      {formatarContagem(restante)}
    </time>
  );
}

export { ContagemRegressiva };
