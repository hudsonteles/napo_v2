'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TriangleAlert, ClockAlert, Zap } from 'lucide-react';

import { Button } from '@napo/ui/components/button';

import { formatarCentavos } from '../carrinho-view';
import {
  faltaParaFreteGratis,
  formatarFornadaBreve,
  interpretarRespostaPedido,
  type EnderecoParaCheckout,
  type ResultadoPagar,
} from '../checkout-view';
import { ResumoPedido } from './resumo-pedido';
import { SeletorEndereco } from './seletor-endereco';
import { useCarrinho } from '@/lib/carrinho/provider';

interface ItemValidado {
  produtoId: string;
  nome: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  disponivel: number;
  esgotado: boolean;
}
interface RespostaValidar {
  itens: ItemValidado[];
  dia: { data: string; determinadoPor: string } | null;
}
interface RespostaFrete {
  freteCentavos: number | null;
}

/**
 * Orquestra o checkout: revalida o carrinho (RN3), escolhe endereço e calcula o
 * frete no servidor (RN18), e cria o pedido + a cobrança (RN7). O checkout não
 * repergunta o que a conta já sabe — nome, telefone e e-mail vêm do gate do
 * NAPO-002. A confirmação de pagamento é sempre do webhook (RN8): aqui só
 * abrimos a URL do Mercado Pago.
 */
export function CheckoutCliente({
  enderecos,
  freteGratisCentavos,
  minutos,
}: {
  enderecos: EnderecoParaCheckout[];
  freteGratisCentavos: number;
  minutos: number;
}) {
  const router = useRouter();
  const { itens, pronto, limpar } = useCarrinho();
  const [validacao, setValidacao] = useState<RespostaValidar | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(
    () => enderecos.find((e) => e.padrao && e.atendido)?.id ?? enderecos.find((e) => e.atendido)?.id ?? null,
  );
  const [freteCentavos, setFreteCentavos] = useState<number | null>(null);
  const [pagando, setPagando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPagar | null>(null);
  // Vira `true` no instante em que o pedido é criado: aí o carrinho é esvaziado
  // de propósito, e o efeito abaixo NÃO pode confundir isso com "carrinho vazio"
  // e piscar a tela de vazio antes de ir para o pagamento.
  const finalizando = useRef(false);

  const chave = useMemo(() => itens.map((i) => `${i.produtoId}:${i.quantidade}`).join('|'), [itens]);

  // Carrinho vazio (sem ser por finalização) não tem checkout: volta para o carrinho.
  useEffect(() => {
    if (pronto && itens.length === 0 && !finalizando.current) router.replace('/carrinho');
  }, [pronto, itens.length, router]);

  async function revalidar() {
    if (itens.length === 0) return;
    const r = await fetch('/api/carrinho/validar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })) }),
    });
    const json = await r.json().catch(() => null);
    if (json?.success) setValidacao(json.data);
  }

  useEffect(() => {
    if (!pronto || itens.length === 0) return;
    void revalidar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, chave]);

  const subtotalCentavos = validacao
    ? validacao.itens.reduce((s, i) => s + i.precoUnitarioCentavos * i.quantidade, 0)
    : 0;
  const pizzas = validacao ? validacao.itens.reduce((s, i) => s + i.quantidade, 0) : 0;
  const temEsgotado = validacao ? validacao.itens.some((i) => i.esgotado) : false;
  const selecionado = enderecos.find((e) => e.id === selecionadoId) ?? null;

  // Frete do endereço escolhido, do servidor (RN18) — nunca do cliente.
  useEffect(() => {
    setFreteCentavos(null);
    if (!selecionadoId || subtotalCentavos === 0) return;
    let vivo = true;
    fetch('/api/frete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enderecoId: selecionadoId, subtotalCentavos }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((json: { success: boolean; data: RespostaFrete }) => {
        if (vivo && json?.success) setFreteCentavos(json.data.freteCentavos);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [selecionadoId, subtotalCentavos]);

  const totalCentavos = freteCentavos != null ? subtotalCentavos + freteCentavos : null;
  const podePagar =
    validacao != null && !temEsgotado && selecionado?.atendido === true && freteCentavos != null && subtotalCentavos > 0;

  async function pagar() {
    if (!selecionadoId || !validacao) return;
    setPagando(true);
    setResultado(null);
    try {
      const r = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enderecoId: selecionadoId,
          itens: validacao.itens.map((i) => ({
            produtoId: i.produtoId,
            quantidade: i.quantidade,
            precoUnitarioCentavos: i.precoUnitarioCentavos,
          })),
        }),
      });
      const corpo = await r.json().catch(() => null);
      const res = interpretarRespostaPedido(r.status, corpo);

      if (res.tipo === 'ok') {
        // O pedido foi criado: os itens agora vivem NELE (reserva + pedido), não
        // mais no carrinho. Esvaziar aqui evita item fantasma no carrinho depois
        // do pagamento e, principalmente, pedido duplicado por um segundo "pagar".
        // Um pagamento abandonado expira sozinho (RN13); o retry é no pedido.
        finalizando.current = true;
        limpar();
        // Mantém `pagando` durante o redirecionamento para o Mercado Pago.
        window.location.href = res.urlPagamento;
        return;
      }
      if (res.tipo === 'sessao') {
        window.location.href = '/entrar?proximo=/checkout';
        return;
      }
      setResultado(res);
      // Preço mudou ou vaga acabou: reflete o estado novo (preço/dia) na tela.
      if (res.tipo === 'divergencia' || res.tipo === 'sem_vaga') await revalidar();
    } finally {
      setPagando(false);
    }
  }

  if (!pronto || (itens.length > 0 && validacao === null)) {
    return <div className="mt-7 h-72 animate-pulse rounded-card bg-superficie" aria-hidden />;
  }

  return (
    <div className="mt-7 grid gap-8 pb-28 lg:grid-cols-[1fr_340px] lg:pb-10">
      <div className="space-y-8">
        {resultado && (
          <AvisoResultado
            resultado={resultado}
            nomePorId={new Map((validacao?.itens ?? []).map((i) => [i.produtoId, i.nome]))}
            pagando={pagando}
            onConfirmar={pagar}
          />
        )}

        <section>
          <h2 className="flex items-center gap-2.5 text-lg font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amarelo font-mono text-xs font-bold text-preto">
              1
            </span>
            Onde entregamos
          </h2>
          <SeletorEndereco
            enderecos={enderecos}
            selecionadoId={selecionadoId}
            onSelecionar={setSelecionadoId}
            freteSelecionadoCentavos={freteCentavos}
          />
        </section>

        <section>
          <h2 className="flex items-center gap-2.5 text-lg font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amarelo font-mono text-xs font-bold text-preto">
              2
            </span>
            Como você paga
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-texto-suave">
            O pagamento acontece no ambiente do Mercado Pago. Pix vem selecionado — cai na hora e a fornada é
            confirmada na hora.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-campo border border-amarelo/40 bg-amarelo/10 px-3 py-1.5 font-mono text-xs text-amarelo">
              <Zap className="h-3.5 w-3.5" /> Pix
            </span>
            <span className="rounded-campo border border-borda px-3 py-1.5 font-mono text-xs text-texto-suave">crédito</span>
            <span className="rounded-campo border border-borda px-3 py-1.5 font-mono text-xs text-texto-suave">débito</span>
          </div>
        </section>
      </div>

      <aside className="h-fit lg:sticky lg:top-20">
        <ResumoPedido
          dia={validacao?.dia?.data ?? null}
          pizzas={pizzas}
          distanciaKm={selecionado?.atendido ? selecionado.distanciaKm : null}
          subtotalCentavos={subtotalCentavos}
          freteCentavos={freteCentavos}
          totalCentavos={totalCentavos}
          faltamFreteGratisCentavos={faltaParaFreteGratis(subtotalCentavos, freteGratisCentavos)}
          minutos={minutos}
          podePagar={podePagar}
          pagando={pagando}
          onPagar={pagar}
        />
      </aside>
    </div>
  );
}

/**
 * Avisos que BLOQUEIAM o fluxo (preço mudou, fornada encheu, gateway) — cards que
 * permanecem em tela até a ação do cliente, nunca toast (critério visual 6): um
 * toast some sozinho e o cliente pagaria sem ter visto.
 */
function AvisoResultado({
  resultado,
  nomePorId,
  pagando,
  onConfirmar,
}: {
  resultado: ResultadoPagar;
  nomePorId: Map<string, string>;
  pagando: boolean;
  onConfirmar: () => void;
}) {
  if (resultado.tipo === 'divergencia') {
    return (
      <div className="rounded-card border border-amarelo/50 bg-amarelo/5 p-4">
        <div className="flex gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amarelo" />
          <div className="min-w-0">
            <p className="font-semibold">O preço de um item mudou</p>
            <ul className="mt-1.5 space-y-1 text-sm text-texto-suave">
              {resultado.divergencias.map((d) => (
                <li key={d.produtoId}>
                  {nomePorId.get(d.produtoId) ?? 'Item'}:{' '}
                  <span className="font-mono text-texto-suave line-through">{formatarCentavos(d.deCentavos)}</span>
                  <span className="ml-1 font-mono text-branco">{formatarCentavos(d.paraCentavos)}</span>
                </li>
              ))}
            </ul>
            <Button size="sm" largura="natural" className="mt-3" onClick={onConfirmar} disabled={pagando}>
              Confirmar e seguir
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (resultado.tipo === 'sem_vaga') {
    return (
      <div className="rounded-card border border-erro/40 bg-erro/5 p-4">
        <div className="flex gap-3">
          <ClockAlert className="mt-0.5 h-5 w-5 shrink-0 text-erro" />
          <div className="min-w-0">
            <p className="font-semibold">Esta fornada encheu enquanto você decidia</p>
            <p className="mt-1.5 text-sm leading-relaxed text-texto-suave">
              {resultado.dia
                ? `A próxima com todos os seus sabores é ${formatarFornadaBreve(resultado.dia)}. `
                : 'A próxima fornada com todos os seus sabores foi atualizada acima. '}
              Nada foi cobrado.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const copia =
    resultado.tipo === 'gateway'
      ? 'Pagamento indisponível no momento. Seu carrinho continua aqui — tente de novo em instantes.'
      : resultado.tipo === 'fora_area'
        ? 'Este endereço está fora da área de entrega. Escolha outro para seguir.'
        : 'Não foi possível criar o pedido agora. Tente de novo.';

  return (
    <div className="rounded-card border border-erro/40 bg-erro/5 p-4 text-sm leading-relaxed text-texto-suave">
      {copia}
    </div>
  );
}
