'use client';

import { formatarDiaMes, pizzasDisponiveis } from '../disponibilidade-view';
import { useDisponibilidade } from './disponibilidade-provider';

/**
 * A ocupação do forno como narrativa (design §4.4.5): a escassez é real — o
 * tamanho da pedra —, não urgência fabricada, e nenhum concorrente pode copiar
 * sem ter o dado. Mostra quantas pizzas ainda cabem na fornada ativa. Fala em
 * "pizzas", nunca "vagas" (critério visual 7).
 */
export function BarraFornada() {
  const { estado } = useDisponibilidade();

  if (estado.status !== 'ok') {
    return <div className="h-24 animate-pulse rounded-card bg-superficie" aria-hidden />;
  }

  const dia = estado.dias.find((d) => d.data === estado.dataAtiva);
  const restante = dia ? pizzasDisponiveis(dia) : 0;

  return (
    <div>
      <p className="font-mono text-xs tracking-[0.25em] text-texto-suave uppercase">
        A fornada de {dia ? formatarDiaMes(dia.data) : '—'}
      </p>
      <p className="mt-5 text-5xl font-extrabold tracking-tight sm:text-6xl">
        {restante}
        <span className="ml-2 text-lg font-medium text-texto-suave">pizzas ainda disponíveis</span>
      </p>
      <p className="mt-2 text-texto-suave">
        O forno assa por semana o que a pedra deixa — esgotou nesta sexta? A próxima fornada já está
        aberta.
      </p>
    </div>
  );
}
