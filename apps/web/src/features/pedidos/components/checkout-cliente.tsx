'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { TriangleAlert, Zap } from 'lucide-react';
import { calcularFrete, type FaixaFrete } from '@napo/core';
import { toast } from '@napo/ui/components/toaster';

import { useCarrinho } from '@/lib/carrinho/provider';

import { ResumoPedido } from './resumo-pedido';
import { SeletorEndereco, type EnderecoDoCheckout } from './seletor-endereco';

/**
 * O checkout inteiro em uma ilha cliente: o carrinho mora no navegador e o
 * endereço escolhido muda o total na hora.
 *
 * Nada aqui decide dinheiro. Preço e disponibilidade vêm de
 * `POST /api/carrinho/validar`; o total cobrado é recalculado de novo no
 * servidor na criação da cobrança (RN3) — o que a tela mostra é previsão.
 */

interface ItemValidado {
  produtoId: string;
  nome: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  disponivel: number;
}

interface CarrinhoValidado {
  itens: ItemValidado[];
  ajustes: { produtoId: string; tipo: 'esgotado' | 'reduzido' }[];
  bloqueado: boolean;
  dia: { data: string; determinadoPor: string } | null;
}

export function CheckoutCliente({
  enderecos,
  faixas,
  freteGratisCentavos,
  minutosDeReserva,
}: {
  enderecos: EnderecoDoCheckout[];
  faixas: FaixaFrete[];
  freteGratisCentavos: number;
  minutosDeReserva: number;
}) {
  const { itens, pronto } = useCarrinho();
  const [validado, setValidado] = useState<CarrinhoValidado | null>(null);
  const [escolhido, setEscolhido] = useState<string | null>(
    enderecos.find((endereco) => endereco.padrao && endereco.atendido)?.id ??
      enderecos.find((endereco) => endereco.atendido)?.id ??
      null,
  );
  const [processando, setProcessando] = useState(false);
  /**
   * Bloqueio que exige ação do cliente fica em card, nunca em toast (critério
   * visual 6): toast some sozinho, e quem não viu pagaria o que não conferiu.
   */
  const [aviso, setAviso] = useState<{ titulo: string; texto: string } | null>(null);

  useEffect(() => {
    if (!pronto || itens.length === 0) return;

    let vivo = true;

    fetch('/api/carrinho/validar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        itens: itens.map(({ produtoId, quantidade }) => ({ produtoId, quantidade })),
      }),
    })
      .then((resposta) => resposta.json())
      .then((corpo) => {
        if (vivo && corpo?.success) setValidado(corpo.data);
      })
      .catch(() => undefined);

    return () => {
      vivo = false;
    };
  }, [itens, pronto]);

  const subtotalCentavos = useMemo(
    () =>
      (validado?.itens ?? []).reduce(
        (total, item) => total + item.precoUnitarioCentavos * item.quantidade,
        0,
      ),
    [validado],
  );

  const endereco = enderecos.find((candidato) => candidato.id === escolhido) ?? null;

  const frete = endereco
    ? calcularFrete({
        distanciaKm: endereco.distanciaKm,
        subtotalCentavos,
        atendido: endereco.atendido,
        motivoNaoAtendido: endereco.motivoNaoAtendido,
        faixas,
        freteGratisCentavos,
      })
    : null;

  const quantidadeItens = (validado?.itens ?? []).reduce(
    (total, item) => total + item.quantidade,
    0,
  );

  const bloqueio = decidirBloqueio({
    carregando: !validado,
    vazio: pronto && itens.length === 0,
    bloqueado: validado?.bloqueado ?? false,
    semDia: validado ? validado.dia === null : false,
    semEndereco: endereco === null,
    freteCentavos: frete?.freteCentavos ?? null,
  });

  async function pagar() {
    if (!endereco || !validado) return;

    setProcessando(true);
    setAviso(null);

    try {
      const resposta = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enderecoId: endereco.id,
          // O preço visto viaja só para a conferência da RN3: o servidor
          // recalcula tudo e recusa se mudou entre a vitrine e o pagamento.
          itens: validado.itens.map((item) => ({
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            precoVistoCentavos: item.precoUnitarioCentavos,
          })),
        }),
      });

      const corpo = await resposta.json();

      if (resposta.ok && corpo?.data?.urlPagamento) {
        window.location.href = corpo.data.urlPagamento;
        return;
      }

      const motivo = corpo?.error?.motivo;
      const permanente = AVISOS_PERMANENTES[motivo];

      if (permanente) setAviso(permanente);
      else toast.error(mensagemDeFalha(motivo));

      setProcessando(false);
    } catch {
      toast.error('Não conseguimos abrir o pagamento. Seu carrinho continua aqui.');
      setProcessando(false);
    }
  }

  return (
    <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        {aviso && (
          <div className="rounded-card border border-amarelo/50 bg-amarelo/5 p-4">
            <div className="flex gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amarelo" />
              <div className="min-w-0">
                <p className="font-semibold">{aviso.titulo}</p>
                <p className="mt-1 text-sm leading-relaxed text-texto-suave">{aviso.texto}</p>
                <Link
                  href="/carrinho"
                  className="mt-3 inline-block font-mono text-xs text-amarelo underline underline-offset-2"
                >
                  voltar ao carrinho
                </Link>
              </div>
            </div>
          </div>
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
            escolhido={escolhido}
            onEscolher={setEscolhido}
            subtotalCentavos={subtotalCentavos}
            faixas={faixas}
            freteGratisCentavos={freteGratisCentavos}
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
            O pagamento acontece no ambiente do Mercado Pago. Pix vem selecionado — cai na hora e
            a fornada é confirmada na hora.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-campo border border-amarelo/40 bg-amarelo/10 px-3 py-1.5 font-mono text-xs text-amarelo">
              <Zap className="h-3.5 w-3.5" /> Pix
            </span>
            <span className="rounded-campo border border-borda px-3 py-1.5 font-mono text-xs text-texto-suave">
              crédito
            </span>
            <span className="rounded-campo border border-borda px-3 py-1.5 font-mono text-xs text-texto-suave">
              débito
            </span>
          </div>
        </section>
      </div>

      <ResumoPedido
        diaEntrega={validado?.dia?.data ?? null}
        quantidadeItens={quantidadeItens}
        subtotalCentavos={subtotalCentavos}
        freteCentavos={frete?.freteCentavos ?? null}
        distanciaKm={endereco?.distanciaKm ?? null}
        faltamParaFreteGratisCentavos={
          frete && !frete.gratis && freteGratisCentavos > subtotalCentavos
            ? freteGratisCentavos - subtotalCentavos
            : null
        }
        minutosDeReserva={minutosDeReserva}
        processando={processando}
        bloqueio={bloqueio}
        onPagar={pagar}
      />
    </div>
  );
}

function decidirBloqueio({
  carregando,
  vazio,
  bloqueado,
  semDia,
  semEndereco,
  freteCentavos,
}: {
  carregando: boolean;
  vazio: boolean;
  bloqueado: boolean;
  semDia: boolean;
  semEndereco: boolean;
  freteCentavos: number | null;
}): string | null {
  if (vazio) return 'Seu carrinho está vazio.';
  if (carregando) return 'Conferindo preços e disponibilidade…';
  if (bloqueado) return 'Ajuste os itens do carrinho para seguir.';
  if (semDia) return 'Nenhuma fornada comporta este carrinho inteiro.';
  if (semEndereco) return 'Escolha um endereço para ver o total.';
  if (freteCentavos === null) return 'Ainda não entregamos neste endereço.';
  return null;
}

/** Bloqueios que exigem reconfirmação: card que permanece, nunca toast. */
const AVISOS_PERMANENTES: Record<string, { titulo: string; texto: string }> = {
  sem_vaga: {
    titulo: 'Esta fornada encheu enquanto você decidia',
    texto:
      'A vaga foi para outro pedido. Volte ao carrinho para ver a próxima fornada que assa todos os seus sabores.',
  },
  preco_mudou: {
    titulo: 'O preço de um item mudou',
    texto:
      'Um sabor do seu carrinho mudou de preço desde que você o adicionou. Confira o valor no carrinho antes de pagar.',
  },
};

function mensagemDeFalha(motivo: string | undefined): string {
  switch (motivo) {
    case 'fora_de_area':
      return 'Ainda não entregamos neste endereço.';
    case 'gateway_indisponivel':
      return 'O pagamento está fora do ar neste momento. Seu carrinho continua aqui.';
    default:
      return 'Não conseguimos abrir o pagamento. Seu carrinho continua aqui.';
  }
}
