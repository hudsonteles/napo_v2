'use client';

import { useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Info, LoaderCircle } from 'lucide-react';

import type { Coordenada } from '@napo/core';
import { Button } from '@napo/ui/components/button';
import { Card } from '@napo/ui/components/card';
import { Checkbox } from '@napo/ui/components/checkbox';
import { Input } from '@napo/ui/components/input';
import { Label } from '@napo/ui/components/label';
import { toast } from '@napo/ui/components/toaster';

import {
  esquemaEndereco,
  exigeComplemento,
  type Endereco,
  type PosicaoAvaliada,
} from '../schema';
import type { ConfigDeExibicao } from './etapa-posicao';

// A etapa 2 carrega a Maps JS API (~200 kB): fora do bundle inicial, e sem SSR
// porque a API só existe no navegador (ARCHITECTURE §7.2). Quem abre o cadastro
// e desiste na etapa 1 nunca paga esse download.
const EtapaPosicao = dynamic(() => import('./etapa-posicao').then((m) => m.EtapaPosicao), {
  ssr: false,
  loading: () => <div className="mt-6 h-96 animate-pulse rounded-card bg-superficie-alta" />,
});

/**
 * Enquanto o CEP é consultado, os campos que a resposta preenche viram esqueleto
 * (design §4.3, estado 2 do preview aprovado).
 *
 * Não é enfeite de carregamento: o campo continuar editável significa que o que
 * a pessoa digitou nos três segundos de espera é sobrescrito pela resposta sem
 * aviso — e ela reescreve o mesmo dado achando que errou.
 */
function Esqueleto() {
  return (
    <div className="h-12 w-full animate-pulse rounded-campo border border-borda bg-superficie-alta/60 motion-reduce:animate-none" />
  );
}

type Campos = {
  apelido: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  referencia: string;
  padrao: boolean;
};

const VAZIO: Campos = {
  apelido: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  referencia: '',
  padrao: false,
};

/**
 * Cadastro e edição de endereço, em duas etapas (drift.md).
 *
 * Etapa 1 é o texto; etapa 2 é a confirmação da posição. A separação não é
 * estética: apresentado como elemento opcional de uma página cheia, o mapa não
 * é usado — e pin no meio da quadra é viagem perdida numa rota de dez paradas.
 * Confirmar a posição precisa **ser a tarefa**.
 *
 * É página, não modal: em celular, mapa dentro de overlay é armadilha de scroll
 * (design §4.5).
 */
export function FormularioEndereco({
  endereco,
  config,
}: {
  endereco?: Endereco;
  config: ConfigDeExibicao;
}) {
  const router = useRouter();
  const [salvando, iniciarSalvamento] = useTransition();

  const [campos, setCampos] = useState<Campos>(
    endereco
      ? {
          apelido: endereco.apelido,
          cep: endereco.cep,
          logradouro: endereco.logradouro,
          numero: endereco.numero,
          complemento: endereco.complemento ?? '',
          bairro: endereco.bairro ?? '',
          cidade: endereco.cidade,
          uf: endereco.uf,
          referencia: endereco.referencia ?? '',
          padrao: endereco.padrao,
        }
      : VAZIO,
  );

  const [buscandoCep, setBuscandoCep] = useState(false);
  const [modoManual, setModoManual] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  // `null` = etapa 1 (texto). Preenchido = etapa 2 (confirmar no mapa).
  const [posicao, setPosicao] = useState<PosicaoAvaliada | null>(null);
  const [avancando, iniciarAvanco] = useTransition();

  const atualizar = (campo: keyof Campos, valor: string | boolean) =>
    setCampos((atual) => ({ ...atual, [campo]: valor }));

  const complementoObrigatorio = exigeComplemento(campos.logradouro);

  async function buscarCep() {
    const digitos = campos.cep.replace(/\D/g, '');
    if (digitos.length !== 8) {
      // T8: erro inline, e nenhuma chamada externa sai daqui.
      setErros((e) => ({ ...e, cep: 'CEP tem 8 dígitos.' }));
      return;
    }

    setErros((e) => ({ ...e, cep: '' }));
    setBuscandoCep(true);

    try {
      const resposta = await fetch(`/api/cep/${digitos}`);
      const corpo = await resposta.json();

      if (!resposta.ok || !corpo.success) {
        // RN2: CEP não encontrado não é erro do cliente — libera a digitação.
        setModoManual(true);
        return;
      }

      setModoManual(false);
      setCampos((atual) => ({
        ...atual,
        cep: corpo.data.cep,
        // O logradouro devolvido pelo CEP é sempre editável (RN3).
        logradouro: corpo.data.logradouro ?? atual.logradouro,
        bairro: corpo.data.bairro ?? atual.bairro,
        cidade: corpo.data.cidade,
        uf: corpo.data.uf,
      }));
    } catch {
      setModoManual(true);
    } finally {
      setBuscandoCep(false);
    }
  }

  /** Campos → contrato validado, ou `null` com os erros já na tela. */
  function entradaValidada(coordenada: Coordenada | null) {
    const conferido = esquemaEndereco.safeParse({
      apelido: campos.apelido,
      cep: campos.cep.replace(/\D/g, ''),
      logradouro: campos.logradouro,
      numero: campos.numero,
      complemento: campos.complemento || null,
      bairro: campos.bairro || null,
      cidade: campos.cidade,
      uf: campos.uf.toUpperCase(),
      referencia: campos.referencia || null,
      lat: coordenada?.lat ?? null,
      lng: coordenada?.lng ?? null,
      padrao: campos.padrao,
    });

    if (!conferido.success) {
      setErros(
        Object.fromEntries(
          conferido.error.issues.map((i) => [String(i.path[0] ?? 'geral'), i.message]),
        ),
      );
      return null;
    }

    setErros({});
    return conferido.data;
  }

  /**
   * Etapa 1 → 2: o servidor geocodifica e mede **sem gravar** (drift.md).
   *
   * A coordenada não vai daqui: quem decide onde o endereço fica é a
   * geocodificação, e é dela que a etapa 2 parte.
   */
  function avancar() {
    const entrada = entradaValidada(null);
    if (!entrada) return;

    iniciarAvanco(async () => {
      const resposta = await fetch('/api/enderecos/posicao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entrada),
      });

      const corpo = await resposta.json();

      if (!resposta.ok || !corpo.success) {
        toast.error(corpo.error ?? 'Não foi possível localizar esse endereço.');
        return;
      }

      setPosicao(corpo.data as PosicaoAvaliada);
    });
  }

  /** Etapa 2: grava com a coordenada confirmada. O servidor remede — RN6. */
  function confirmar(coordenada: Coordenada) {
    const entrada = entradaValidada(coordenada);
    if (!entrada) return;

    iniciarSalvamento(async () => {
      const resposta = await fetch(
        endereco ? `/api/enderecos/${endereco.id}` : '/api/enderecos',
        {
          method: endereco ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entrada),
        },
      );

      const corpo = await resposta.json();

      if (!resposta.ok || !corpo.success) {
        toast.error(corpo.error ?? 'Não foi possível salvar o endereço.');
        return;
      }

      const salvo = corpo.data as Endereco;
      toast.success(
        salvo.atendido
          ? 'Endereço salvo.'
          : 'Endereço salvo — ainda não entregamos nessa região, mas guardamos ele.',
      );
      router.push('/conta/enderecos');
      router.refresh();
    });
  }

  const enderecoEmUmaLinha = [
    campos.logradouro,
    campos.complemento,
    campos.bairro && `— ${campos.bairro}`,
    campos.cep,
  ]
    .filter(Boolean)
    .join(' · ');

  if (posicao) {
    return (
      <EtapaPosicao
        endereco={enderecoEmUmaLinha}
        posicao={posicao}
        config={config}
        salvando={salvando}
        onConfirmar={confirmar}
        onVoltar={() => setPosicao(null)}
      />
    );
  }

  return (
    <Card className="mt-6 p-5 sm:p-6 sm:shadow-none">
      <div className="grid gap-4 sm:grid-cols-6" aria-busy={buscandoCep}>
        <Campo className="sm:col-span-2" id="cep" rotulo="CEP" erro={erros.cep}>
          <div className="relative">
            <Input
              id="cep"
              inputMode="numeric"
              className="font-mono"
              value={campos.cep}
              onChange={(e) => atualizar('cep', e.target.value)}
              onBlur={buscarCep}
              aria-invalid={Boolean(erros.cep)}
            />
            {buscandoCep && (
              <LoaderCircle
                className="absolute right-3 top-4 h-4 w-4 animate-spin text-amarelo motion-reduce:animate-none"
                aria-label="Buscando CEP"
              />
            )}
          </div>
        </Campo>

        <Campo
          className="sm:col-span-4"
          id="logradouro"
          rotulo="Logradouro"
          dica="editável"
          erro={erros.logradouro}
        >
          {buscandoCep ? (
            <Esqueleto />
          ) : (
            <Input
              id="logradouro"
              value={campos.logradouro}
              placeholder="Digite a quadra, rua ou rodovia"
              onChange={(e) => atualizar('logradouro', e.target.value)}
              aria-invalid={Boolean(erros.logradouro)}
            />
          )}
        </Campo>

        <Campo className="sm:col-span-2" id="numero" rotulo="Número" erro={erros.numero}>
          {buscandoCep ? (
            <Esqueleto />
          ) : (
            <Input
              id="numero"
              value={campos.numero}
              placeholder="s/n"
              onChange={(e) => atualizar('numero', e.target.value)}
              aria-invalid={Boolean(erros.numero)}
            />
          )}
        </Campo>

        <Campo
          className="sm:col-span-4"
          id="complemento"
          rotulo="Complemento"
          dica={complementoObrigatorio ? 'obrigatório em quadra' : 'opcional'}
          destacarDica={complementoObrigatorio}
          erro={erros.complemento}
        >
          {buscandoCep ? (
            <Esqueleto />
          ) : (
            <Input
              id="complemento"
              value={campos.complemento}
              placeholder="Bloco C, Apto 302"
              onChange={(e) => atualizar('complemento', e.target.value)}
              aria-invalid={Boolean(erros.complemento)}
            />
          )}
        </Campo>

        <Campo className="sm:col-span-3" id="bairro" rotulo="Bairro" erro={erros.bairro}>
          {buscandoCep ? (
            <Esqueleto />
          ) : (
            <Input
              id="bairro"
              value={campos.bairro}
              onChange={(e) => atualizar('bairro', e.target.value)}
            />
          )}
        </Campo>

        <Campo className="sm:col-span-2" id="cidade" rotulo="Cidade" erro={erros.cidade}>
          {buscandoCep ? (
            <Esqueleto />
          ) : (
            <Input
              id="cidade"
              value={campos.cidade}
              onChange={(e) => atualizar('cidade', e.target.value)}
              aria-invalid={Boolean(erros.cidade)}
            />
          )}
        </Campo>

        <Campo className="sm:col-span-1" id="uf" rotulo="UF" erro={erros.uf}>
          {buscandoCep ? (
            <Esqueleto />
          ) : (
            <Input
              id="uf"
              maxLength={2}
              className="uppercase"
              value={campos.uf}
              onChange={(e) => atualizar('uf', e.target.value)}
              aria-invalid={Boolean(erros.uf)}
            />
          )}
        </Campo>

        <Campo
          className="sm:col-span-6"
          id="apelido"
          rotulo="Nome deste endereço"
          erro={erros.apelido}
        >
          <Input
            id="apelido"
            value={campos.apelido}
            placeholder="Casa, Trabalho, Sítio…"
            onChange={(e) => atualizar('apelido', e.target.value)}
            aria-invalid={Boolean(erros.apelido)}
          />
        </Campo>

        <Campo
          className="sm:col-span-6"
          id="referencia"
          rotulo="Ponto de referência"
          dica="opcional, ajuda o entregador"
        >
          <Input
            id="referencia"
            value={campos.referencia}
            placeholder="Portaria do bloco C, ao lado da quadra de tênis"
            onChange={(e) => atualizar('referencia', e.target.value)}
          />
        </Campo>
      </div>

      {/* Markup cru consciente: o catálogo não tem primitivo de aviso, e este é
          informativo, não erro — o cliente não fez nada errado (RN2). Criar um
          <Alerta> agora seria inventar componente fora do §4.4.3 do design; se um
          terceiro aviso aparecer no projeto, aí ele sobe para packages/ui. */}
      {modoManual && (
        <div className="mt-5 flex gap-3 rounded-campo border border-borda-forte bg-superficie-alta px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amarelo" />
          <p className="text-sm text-texto-suave">
            Não encontramos esse CEP nas bases públicas — CEP novo demora a ser indexado.{' '}
            <span className="text-branco">Pode preencher o endereço à mão</span> que a gente
            continua daqui.
          </p>
        </div>
      )}

      <label className="mt-5 flex items-center gap-2.5 text-sm">
        <Checkbox
          checked={campos.padrao}
          onCheckedChange={(marcado) => atualizar('padrao', marcado === true)}
        />
        Usar como endereço padrão
      </label>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button size="sm" largura="natural" disabled={avancando || buscandoCep} onClick={avancar}>
          {avancando ? 'Localizando…' : 'Continuar'}
        </Button>
        <Button asChild variant="ghost" size="sm" largura="natural">
          <Link href="/conta/enderecos">Cancelar</Link>
        </Button>
      </div>
    </Card>
  );
}

/** Rótulo + campo + erro. Existe para os nove campos não repetirem a mesma tripa. */
function Campo({
  id,
  rotulo,
  dica,
  destacarDica,
  erro,
  className,
  children,
}: {
  id: string;
  rotulo: string;
  dica?: string;
  destacarDica?: boolean;
  erro?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 text-xs text-texto-suave">
        {rotulo}
        {dica && (
          <span className={destacarDica ? ' text-amarelo' : ' text-texto-suave/70'}> · {dica}</span>
        )}
      </Label>
      {children}
      {erro && <p className="mt-1 text-xs text-erro">{erro}</p>}
    </div>
  );
}
