'use client';

import { useState } from 'react';
import { WifiOff } from 'lucide-react';
import { Button } from '@napo/ui/components/button';
import { SeletorQuantidade } from '@napo/ui/components/seletor-quantidade';
import { toast } from '@napo/ui/components/toaster';
import { cn } from '@napo/ui/lib/cn';

import { useCarrinho } from '@/lib/carrinho/provider';

import { estadoDoProduto, formatarDiaMes } from '../disponibilidade-view';
import { useDisponibilidade } from './disponibilidade-provider';

/**
 * Área de ação do produto, ao vivo (RN6/RN14). Quatro estados sobre a fornada
 * ativa: disponível (com número), escasso (número + "última chamada"), esgotado
 * com rota para a próxima fornada, e indeterminado (motor fora do ar — não
 * afirma disponibilidade que não confirmou, RN6/T21). Enquanto carrega, o
 * skeleton reserva a altura final desde o primeiro paint — o preço não pula
 * quando o dado chega (RN11/T20). O CTA ficou inativo até o NAPO-006 abrir o
 * canal de compra; a partir dele, adiciona ao carrinho sem pedir conta (RN1).
 */
export function EstadoDisponibilidade({ produtoId }: { produtoId: string }) {
  const { estado, trocarFornada } = useDisponibilidade();
  const { adicionar } = useCarrinho();
  const [quantidade, setQuantidade] = useState(1);

  if (estado.status === 'carregando') {
    return <div className="mt-5 h-[70px] animate-pulse rounded-campo bg-superficie-alta" aria-hidden />;
  }

  if (estado.status === 'erro') {
    return (
      <div className="mt-5">
        <Button disabled size="sm" className="w-full bg-superficie-alta font-semibold text-neutral-500">
          <WifiOff className="h-4 w-4" /> Indisponível
        </Button>
        <p className="mt-2.5 text-xs leading-relaxed text-texto-suave">
          Não foi possível conferir a disponibilidade. Recarregue ou fale no WhatsApp.
        </p>
      </div>
    );
  }

  const st = estadoDoProduto(estado.dias, estado.dataAtiva, produtoId);

  if (st.tipo === 'esgotado') {
    return st.proxima ? (
      <div className="mt-5">
        <Button
          variant="outline"
          onClick={() => trocarFornada(st.proxima!.data)}
          className="w-full border-amarelo/40 font-semibold text-amarelo hover:bg-amarelo/10"
        >
          Comprar para {formatarDiaMes(st.proxima.data)} →
        </Button>
        <p className="mt-2.5 font-mono text-xs text-texto-suave">
          esgotado nesta fornada · {st.proxima.quantidade} un. em {formatarDiaMes(st.proxima.data)}
        </p>
      </div>
    ) : (
      <div className="mt-5">
        <Button disabled size="sm" className="w-full bg-superficie-alta font-semibold text-neutral-500">
          Esgotado
        </Button>
        <p className="mt-2.5 font-mono text-xs text-texto-suave">
          esgotado em todas as fornadas do horizonte
        </p>
      </div>
    );
  }

  const aoAdicionar = () => {
    adicionar(produtoId, Math.min(quantidade, st.quantidade));
    // Confirmação passageira: o contador do cabeçalho é a prova permanente.
    toast.success('Adicionado ao carrinho', { description: 'Confira a sacola quando quiser.' });
  };

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2">
        <SeletorQuantidade
          valor={quantidade}
          max={st.quantidade}
          onChange={setQuantidade}
        />
        <Button size="sm" className="flex-1" onClick={aoAdicionar}>
          Adicionar
        </Button>
      </div>
      <p className={cn('mt-2.5 font-mono text-xs', st.escasso ? 'text-amarelo' : 'text-texto-suave')}>
        {st.quantidade} disponíveis{st.escasso ? ' — última chamada' : ''}
      </p>
    </div>
  );
}
