'use client';

import { useEffect, useState } from 'react';
import { FlaskConical, Lock, ShieldCheck, TriangleAlert } from 'lucide-react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { Button } from '@napo/ui/components/button';
import { Card } from '@napo/ui/components/card';

import { publicEnv } from '@/lib/env';

/**
 * O Payment Brick dentro da nossa moldura (ADR-0001).
 *
 * O miolo é componente do Mercado Pago: campos, bandeiras, parcelamento e a
 * tokenização do cartão são deles, e é isso que faz número, validade e código
 * de segurança **não passarem pelo nosso servidor** (RN9). O que é nosso é a
 * moldura, o tema e o tratamento da resposta.
 *
 * Sem chave pública o Brick **não é oferecido**: `ARCHITECTURE.md` §2.2.3 —
 * caminho que depende de configuração externa só aparece onde a configuração
 * existe. No lugar dele entra o painel de simulação, que é o que mantém o fluxo
 * inteiro fechado sem túnel e sem credencial.
 */

export interface PagamentoEnviado {
  token?: string;
  metodo: string;
  parcelas: number;
  emailPagador: string;
}

export interface BrickPagamentoProps {
  valorCentavos: number;
  emailPadrao: string;
  /** Devolve a mensagem de recusa quando a tentativa não passa. */
  aoPagar: (dados: PagamentoEnviado) => Promise<{ ok: boolean; mensagem?: string }>;
}

const reais = (centavos: number) => centavos / 100;

export function BrickPagamento({ valorCentavos, emailPadrao, aoPagar }: BrickPagamentoProps) {
  const chave = publicEnv.NEXT_PUBLIC_MP_PUBLIC_KEY;
  const [recusa, setRecusa] = useState<string | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);

  if (!chave) {
    return <PainelSimulado valorCentavos={valorCentavos} emailPadrao={emailPadrao} aoPagar={aoPagar} />;
  }

  return (
    <div className="space-y-4">
      {recusa && (
        <Card className="border-erro/40 bg-erro/5 p-4">
          <div className="flex gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-erro" />
            <div className="min-w-0">
              <p className="font-semibold">O cartão não passou</p>
              <p className="mt-1 text-sm leading-relaxed text-texto-suave">{recusa}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setRecusa(null)}
              >
                Tentar outro cartão
              </Button>
            </div>
          </div>
        </Card>
      )}

      {indisponivel && (
        <Card className="border-amarelo/50 bg-amarelo/5 p-4">
          <p className="text-sm leading-relaxed">
            Não conseguimos abrir o pagamento agora. Sua entrega continua reservada — é só tentar
            de novo.
          </p>
        </Card>
      )}

      {!recusa && (
        <Card className="overflow-hidden p-0">
          {/* Markup cru declarado em design.md §4.4.4: faixa de cabeçalho do
              card. O catálogo não tem `CardHeader`, e criar um primitivo para
              uma única ocorrência seria inflar o catálogo, não reusá-lo. */}
          <div className="flex items-center justify-between border-b border-borda px-5 py-3.5">
            <p className="text-sm font-semibold">Como você quer pagar</p>
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-texto-suave">
              <Lock className="h-3 w-3" /> conexão segura
            </span>
          </div>

          <div className="p-5">
            <Brick
              chave={chave}
              valorCentavos={valorCentavos}
              emailPadrao={emailPadrao}
              onResultado={async (dados) => {
                setIndisponivel(false);
                const resposta = await aoPagar(dados);
                if (!resposta.ok) setRecusa(resposta.mensagem ?? null);
              }}
              onFalha={() => setIndisponivel(true)}
            />
          </div>
        </Card>
      )}

      <p className="flex items-start gap-2 text-xs leading-relaxed text-texto-suave">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Número, validade e código são digitados em campos do Mercado Pago e não passam pelos
        servidores da Napo em nenhum momento.
      </p>
    </div>
  );
}

/**
 * O SDK só pode ser inicializado depois de o componente montar, e uma única vez
 * por carregamento — inicializar no corpo do módulo quebra o build de servidor,
 * e reinicializar a cada render foi a categoria de defeito que o Gate Visual B
 * do NAPO-005 pegou.
 */
function Brick({
  chave,
  valorCentavos,
  emailPadrao,
  onResultado,
  onFalha,
}: {
  chave: string;
  valorCentavos: number;
  emailPadrao: string;
  onResultado: (dados: PagamentoEnviado) => Promise<void>;
  onFalha: () => void;
}) {
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    initMercadoPago(chave, { locale: 'pt-BR' });
    setPronto(true);
  }, [chave]);

  // Esqueleto do tamanho do Brick enquanto o SDK monta (design §4.3): sem ele
  // a página salta quando o formulário de terceiro aparece.
  if (!pronto) return <div className="h-64 animate-pulse rounded-campo bg-superficie-alta" />;

  return (
    <Payment
      initialization={{
        amount: reais(valorCentavos),
        payer: { email: emailPadrao },
      }}
      customization={{
        // Boleto e carteira ficam de fora por decisão de produto (spec §5): um
        // compensa em dias contra uma reserva de 30 minutos, a outra
        // redireciona o cliente — o oposto do que o ADR-0001 decidiu.
        paymentMethods: { creditCard: 'all', debitCard: 'all', bankTransfer: 'all' },
        visual: {
          style: { theme: 'dark' },
          hideFormTitle: true,
        },
      }}
      onSubmit={async ({ formData }) => {
        const dados = formData as {
          token?: string;
          payment_method_id: string;
          installments?: number;
          payer?: { email?: string };
        };

        await onResultado({
          token: dados.token,
          metodo: dados.payment_method_id,
          parcelas: dados.installments ?? 1,
          emailPagador: dados.payer?.email ?? emailPadrao,
        });
      }}
      onError={onFalha}
    />
  );
}

/**
 * Ambiente sem credencial. Não é atalho de teste: é o que impede a tela de
 * oferecer um caminho que vai quebrar (`ARCHITECTURE.md` §2.2.3), e é o que
 * permite exercitar recusa e pendência sem túnel — o adaptador falso lê o
 * método para escolher o desfecho.
 */
function PainelSimulado({
  valorCentavos,
  emailPadrao,
  aoPagar,
}: Omit<BrickPagamentoProps, 'aoPagar'> & { aoPagar: BrickPagamentoProps['aoPagar'] }) {
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  async function simular(metodo: string) {
    setProcessando(true);
    setMensagem(null);
    const resposta = await aoPagar({ metodo, parcelas: 1, emailPagador: emailPadrao, token: 'tok-simulado' });
    if (!resposta.ok) setMensagem(resposta.mensagem ?? 'Não foi possível concluir.');
    setProcessando(false);
  }

  return (
    <Card className="border-dashed p-5">
      <div className="flex gap-3">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-texto-suave" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Pagamento simulado</p>
          <p className="mt-1 text-sm leading-relaxed text-texto-suave">
            Este ambiente não tem gateway configurado. Escolha o desfecho para seguir o fluxo de{' '}
            {(valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={processando} onClick={() => simular('master')}>
              aprovar
            </Button>
            <Button variant="outline" size="sm" disabled={processando} onClick={() => simular('recusar')}>
              recusar
            </Button>
            <Button variant="outline" size="sm" disabled={processando} onClick={() => simular('pendente')}>
              deixar pendente
            </Button>
            <Button variant="outline" size="sm" disabled={processando} onClick={() => simular('pix')}>
              Pix
            </Button>
          </div>

          {mensagem && <p className="mt-3 text-sm leading-relaxed text-erro">{mensagem}</p>}
        </div>
      </div>
    </Card>
  );
}
