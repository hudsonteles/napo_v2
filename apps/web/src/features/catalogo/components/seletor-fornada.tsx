'use client';

import { cn } from '@napo/ui/lib/cn';

import { formatarDiaMes, pizzasDisponiveis } from '../disponibilidade-view';
import { useDisponibilidade } from './disponibilidade-provider';

/**
 * Escolha da data de entrega (RN13). Governa a disponibilidade da página inteira
 * pelo provider. O motor (NAPO-004) já devolve todas as fornadas do horizonte;
 * aqui elas viram botões. A ativa é visível o tempo todo — o cliente nunca
 * descobre no checkout para quando está comprando.
 */
function rotuloRelativo(indice: number): string {
  if (indice === 0) return 'esta sexta';
  if (indice === 1) return 'próxima';
  return 'sexta';
}

export function SeletorFornada() {
  const { estado, trocarFornada } = useDisponibilidade();

  if (estado.status !== 'ok') {
    return (
      <div className="mt-10 h-28 animate-pulse rounded-card border border-borda bg-superficie" aria-hidden />
    );
  }

  return (
    <section
      className="mt-10 rounded-card border border-borda bg-superficie p-5 sm:p-6"
      aria-label="Escolha da fornada"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-mono text-xs tracking-[0.25em] text-texto-suave uppercase">Entregar em</p>
      </div>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {estado.dias.map((dia, i) => {
          const ativo = dia.data === estado.dataAtiva;
          return (
            <button
              key={dia.data}
              type="button"
              aria-pressed={ativo}
              onClick={() => trocarFornada(dia.data)}
              className={cn(
                'min-w-[8.5rem] shrink-0 rounded-campo px-4 py-3 text-left transition',
                ativo
                  ? 'bg-amarelo text-preto'
                  : 'border border-borda-forte text-texto-suave hover:bg-superficie-alta hover:text-branco',
              )}
            >
              <span
                className={cn(
                  'font-mono text-[10px] tracking-widest uppercase',
                  ativo ? 'opacity-70' : 'text-texto-suave',
                )}
              >
                {rotuloRelativo(i)}
              </span>
              <span className="mt-0.5 block text-lg leading-none font-extrabold">
                {formatarDiaMes(dia.data)}
              </span>
              <span className={cn('mt-1.5 block font-mono text-[11px]', ativo ? 'opacity-80' : 'text-texto-suave')}>
                {pizzasDisponiveis(dia)} pizzas disponíveis
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
