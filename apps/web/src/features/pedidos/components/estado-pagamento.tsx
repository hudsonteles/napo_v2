'use client';

import { useEffect, useState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';

import { Badge } from '@napo/ui/components/badge';
import { Button } from '@napo/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@napo/ui/components/dialog';

import { formatarCentavos, formatarFornadaExtenso } from '../carrinho-view';

export interface PedidoView {
  numero: number;
  status: string;
  diaEntrega: string;
  subtotalCentavos: number;
  freteCentavos: number;
  totalCentavos: number;
  veredito: string | null;
  criadoEm: string;
  enderecoSnapshot: { logradouro?: string; complemento?: string | null } | null;
  itens: Array<{ produtoId: string; nome: string; quantidade: number; precoUnitarioCentavos: number }>;
}

/**
 * A página do pedido (RN19). Se o webhook ainda não chegou, mostra "confirmando"
 * e **consulta o pagamento na hora**, com espaçamento crescente e um teto — a
 * confirmação normal chega em segundos, e insistir para sempre aquece servidor à
 * toa quando o pagamento simplesmente não foi feito. Sem linha do tempo de
 * status: o estado é um `<Badge>` com a data ao lado (critério visual 5) — no R1
 * não existe admin que mova status, então uma timeline mostraria etapas que
 * nunca acontecem (cortada no Gate Visual A).
 */
export function EstadoPagamento({
  pedidoInicial,
  numero,
  paymentId,
}: {
  pedidoInicial: PedidoView;
  numero: number;
  paymentId: string | null;
}) {
  const [pedido, setPedido] = useState<PedidoView>(pedidoInicial);

  useEffect(() => {
    if (pedidoInicial.status !== 'aguardando_pagamento' || !paymentId) return;
    let vivo = true;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const atrasos = [1500, 2500, 4000, 6000, 8000, 10000];

    const consultar = async () => {
      const r = await fetch(`/api/pedidos/${numero}?payment_id=${encodeURIComponent(paymentId)}`);
      const json = await r.json().catch(() => null);
      if (!vivo) return;
      if (json?.success) setPedido(json.data);
      if (json?.data?.status && json.data.status !== 'aguardando_pagamento') return;
      if (i >= atrasos.length) return;
      timer = setTimeout(consultar, atrasos[i++]!);
    };

    timer = setTimeout(consultar, atrasos[i++]!);
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [numero, paymentId, pedidoInicial.status]);

  if (pedido.status === 'aguardando_pagamento') {
    return (
      <div className="rounded-card border border-borda bg-superficie p-6">
        <div className="flex items-center gap-3">
          <LoaderCircle className="h-5 w-5 animate-spin text-amarelo" />
          <h1 className="text-lg font-bold">Confirmando seu pagamento</h1>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-texto-suave">
          Pode fechar esta página — o pedido continua valendo. Assim que o Mercado Pago confirmar, ele aparece
          aqui e na sua conta.
        </p>
        <p className="mt-4 font-mono text-xs text-texto-suave">
          Pedido #{pedido.numero} · {formatarCentavos(pedido.totalCentavos)}
        </p>
      </div>
    );
  }

  const selo = seloDoStatus(pedido.status);
  const encerrado = ['cancelado', 'expirado', 'estornado'].includes(pedido.status);
  const endereco = pedido.enderecoSnapshot;

  return (
    <div className="rounded-card border border-amarelo/30 bg-superficie p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amarelo">
          <Check className="h-5 w-5 text-preto" />
        </span>
        <div>
          <h1 className="text-lg font-bold leading-tight">{tituloDoStatus(pedido.status)}</h1>
          <p className="font-mono text-xs text-texto-suave">#{pedido.numero}</p>
        </div>
      </div>

      <div className="mt-5 rounded-campo border border-borda-forte bg-superficie-alta p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-texto-suave">Sua fornada</p>
        <p className="mt-1 text-xl font-extrabold capitalize tracking-tight">
          {formatarFornadaExtenso(pedido.diaEntrega)}
        </p>
        <p className="mt-1.5 text-xs text-texto-suave">
          entre 14h e 20h
          {endereco?.logradouro
            ? ` · ${endereco.logradouro}${endereco.complemento ? `, ${endereco.complemento}` : ''}`
            : ''}
        </p>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <Badge variant={selo.variant} size="sm" className="font-mono font-bold">
          {selo.label}
        </Badge>
        <span className="font-mono text-[11px] text-texto-suave">{formatarData(pedido.criadoEm)}</span>
      </div>

      <dl className="mt-5 space-y-1.5 border-t border-borda pt-4 text-sm">
        {pedido.itens.map((item) => (
          <div key={item.produtoId} className="flex justify-between gap-3">
            <dt className="text-texto-suave">
              {item.quantidade}× {item.nome}
            </dt>
            <dd className="font-mono">{formatarCentavos(item.precoUnitarioCentavos * item.quantidade)}</dd>
          </div>
        ))}
        <div className="flex justify-between">
          <dt className="text-texto-suave">Frete</dt>
          <dd className="font-mono">{formatarCentavos(pedido.freteCentavos)}</dd>
        </div>
        <div className="mt-2 flex justify-between border-t border-borda pt-2">
          <dt className="font-bold">Total</dt>
          <dd className="font-mono font-extrabold">{formatarCentavos(pedido.totalCentavos)}</dd>
        </div>
      </dl>

      {pedido.status === 'pago' && (
        <CancelarPedido numero={numero} onCancelado={() => setPedido((p) => ({ ...p, status: 'cancelado' }))} />
      )}

      {encerrado && pedido.status === 'estornado' && (
        <p className="mt-4 text-center text-[11px] leading-relaxed text-texto-suave">
          O estorno é processado pelo Mercado Pago e pode levar alguns dias para aparecer na sua fatura.
        </p>
      )}
    </div>
  );
}

function CancelarPedido({ numero, onCancelado }: { numero: number; onCancelado: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function cancelar() {
    setCancelando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/pedidos/${numero}/cancelar`, { method: 'POST' });
      if (r.ok) {
        onCancelado();
        setAberto(false);
        return;
      }
      const corpo = await r.json().catch(() => null);
      setErro(
        corpo?.error ??
          'Este pedido já entrou na produção do dia. Fale com a gente no WhatsApp para resolver.',
      );
    } finally {
      setCancelando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <Button
        variant="ghost"
        size="sm"
        className="mt-4 w-full text-xs hover:text-erro"
        onClick={() => setAberto(true)}
      >
        Cancelar pedido
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar este pedido?</DialogTitle>
          <DialogDescription>
            A vaga volta para a fila da fornada. O estorno do pagamento é feito manualmente pelo Mercado Pago
            — a gente resolve com você.
          </DialogDescription>
        </DialogHeader>
        {erro && <p className="mt-3 text-sm leading-relaxed text-erro">{erro}</p>}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm" largura="natural">
              Voltar
            </Button>
          </DialogClose>
          <Button variant="outline" size="sm" largura="natural" className="text-erro" onClick={cancelar} disabled={cancelando}>
            {cancelando ? 'Cancelando…' : 'Cancelar pedido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function seloDoStatus(status: string): { label: string; variant: 'sucesso' | 'neutro' } {
  const rotulos: Record<string, string> = {
    pago: 'pago',
    em_producao: 'em produção',
    pronto: 'pronto',
    em_rota: 'a caminho',
    entregue: 'entregue',
    cancelado: 'cancelado',
    expirado: 'expirado',
    estornado: 'estornado',
  };
  const encerrado = ['cancelado', 'expirado', 'estornado'].includes(status);
  return { label: rotulos[status] ?? status, variant: encerrado ? 'neutro' : 'sucesso' };
}

function tituloDoStatus(status: string): string {
  if (status === 'cancelado') return 'Pedido cancelado';
  if (status === 'expirado') return 'Pedido expirado';
  if (status === 'estornado') return 'Pedido estornado';
  return 'Pedido confirmado';
}

function formatarData(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
