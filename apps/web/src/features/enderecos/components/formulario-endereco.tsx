'use client';

import { useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Info, LoaderCircle } from 'lucide-react';

import { formatarReais, type Coordenada } from '@napo/core';
import { Button } from '@napo/ui/components/button';
import { Card } from '@napo/ui/components/card';
import { Checkbox } from '@napo/ui/components/checkbox';
import { Input } from '@napo/ui/components/input';
import { Label } from '@napo/ui/components/label';
import { toast } from '@napo/ui/components/toaster';

import { esquemaEndereco, exigeComplemento, type Endereco } from '../schema';

// O mapa carrega um script externo de ~200 kB: fora do bundle inicial, e sem
// SSR porque a Maps JS API só existe no navegador (ARCHITECTURE §7.2).
const MapaPin = dynamic(() => import('./mapa-pin').then((m) => m.MapaPin), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-campo bg-superficie-alta sm:h-64" />,
});

/** Centro de Brasília — só o enquadramento inicial quando não há coordenada ainda. */
const CENTRO_BRASILIA: Coordenada = { lat: -15.7939, lng: -47.8828 };

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
 * Cadastro e edição de endereço.
 *
 * É página, não modal: o fluxo tem CEP, sete campos e um mapa, e em celular
 * arrastar um pin dentro de overlay rola a página (design §4.5).
 *
 * O mapa entra **depois** do número, e não no topo: a coordenada só existe
 * depois que o número existe (RN4).
 */
export function FormularioEndereco({ endereco }: { endereco?: Endereco }) {
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
  const [coordenada, setCoordenada] = useState<Coordenada | null>(
    endereco ? { lat: endereco.lat, lng: endereco.lng } : null,
  );
  const [salvo, setSalvo] = useState<Endereco | null>(null);

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

  function salvar() {
    const entrada = {
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
    };

    // Mesma validação que o servidor roda (RN3, T11): o schema é um só.
    const conferido = esquemaEndereco.safeParse(entrada);
    if (!conferido.success) {
      setErros(
        Object.fromEntries(
          conferido.error.issues.map((i) => [String(i.path[0] ?? 'geral'), i.message]),
        ),
      );
      return;
    }

    setErros({});

    iniciarSalvamento(async () => {
      const resposta = await fetch(
        endereco ? `/api/enderecos/${endereco.id}` : '/api/enderecos',
        {
          method: endereco ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(conferido.data),
        },
      );

      const corpo = await resposta.json();

      if (!resposta.ok || !corpo.success) {
        toast.error(corpo.error ?? 'Não foi possível salvar o endereço.');
        return;
      }

      // O resultado da medição só existe depois de salvar — é aqui que o cliente
      // descobre a distância, o frete e se a casa entrega lá (RN9).
      setSalvo(corpo.data as Endereco);
      router.refresh();
    });
  }

  if (salvo) return <ResultadoDoCadastro endereco={salvo} />;

  return (
    <Card className="mt-6 p-5 sm:p-6 sm:shadow-none">
      <div className="grid gap-4 sm:grid-cols-6">
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
          <Input
            id="logradouro"
            value={campos.logradouro}
            placeholder="Digite a quadra, rua ou rodovia"
            onChange={(e) => atualizar('logradouro', e.target.value)}
            aria-invalid={Boolean(erros.logradouro)}
          />
        </Campo>

        <Campo className="sm:col-span-2" id="numero" rotulo="Número" erro={erros.numero}>
          <Input
            id="numero"
            value={campos.numero}
            placeholder="s/n"
            onChange={(e) => atualizar('numero', e.target.value)}
            aria-invalid={Boolean(erros.numero)}
          />
        </Campo>

        <Campo
          className="sm:col-span-4"
          id="complemento"
          rotulo="Complemento"
          dica={complementoObrigatorio ? 'obrigatório em quadra' : 'opcional'}
          destacarDica={complementoObrigatorio}
          erro={erros.complemento}
        >
          <Input
            id="complemento"
            value={campos.complemento}
            placeholder="Bloco C, Apto 302"
            onChange={(e) => atualizar('complemento', e.target.value)}
            aria-invalid={Boolean(erros.complemento)}
          />
        </Campo>

        <Campo className="sm:col-span-3" id="bairro" rotulo="Bairro" erro={erros.bairro}>
          <Input
            id="bairro"
            value={campos.bairro}
            onChange={(e) => atualizar('bairro', e.target.value)}
          />
        </Campo>

        <Campo className="sm:col-span-2" id="cidade" rotulo="Cidade" erro={erros.cidade}>
          <Input
            id="cidade"
            value={campos.cidade}
            onChange={(e) => atualizar('cidade', e.target.value)}
            aria-invalid={Boolean(erros.cidade)}
          />
        </Campo>

        <Campo className="sm:col-span-1" id="uf" rotulo="UF" erro={erros.uf}>
          <Input
            id="uf"
            maxLength={2}
            className="uppercase"
            value={campos.uf}
            onChange={(e) => atualizar('uf', e.target.value)}
            aria-invalid={Boolean(erros.uf)}
          />
        </Campo>

        <Campo className="sm:col-span-6" id="apelido" rotulo="Nome deste endereço" erro={erros.apelido}>
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

      {/* O mapa vem DEPOIS do número: a coordenada só existe depois dele (RN4). */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Confirme no mapa onde a entrega chega</p>
          <span className="font-mono text-[11px] text-texto-suave">arraste o pin se precisar</span>
        </div>
        <MapaPin
          centro={coordenada ?? CENTRO_BRASILIA}
          original={endereco ? { lat: endereco.lat, lng: endereco.lng } : null}
          onMover={setCoordenada}
        />
      </div>

      <label className="mt-5 flex items-center gap-2.5 text-sm">
        <Checkbox
          checked={campos.padrao}
          onCheckedChange={(marcado) => atualizar('padrao', marcado === true)}
        />
        Usar como endereço padrão
      </label>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button size="sm" largura="natural" disabled={salvando} onClick={salvar}>
          {salvando ? 'Salvando…' : 'Salvar endereço'}
        </Button>
        <Button asChild variant="ghost" size="sm" largura="natural">
          <Link href="/conta/enderecos">Cancelar</Link>
        </Button>
      </div>
    </Card>
  );
}

/**
 * O que o cliente vê depois de salvar: a distância medida, a faixa e o frete —
 * ou o aviso honesto de que a casa ainda não chega lá (RN9).
 *
 * O endereço **já está salvo** nos dois casos: fora de área é lead, não erro, e
 * é a única fonte de dado sobre demanda em região não atendida.
 */
function ResultadoDoCadastro({ endereco }: { endereco: Endereco }) {
  return (
    <Card className="mt-6 p-5 sm:p-6 sm:shadow-none">
      {/* Barra de resumo do frete: markup cru declarado no design §4.4.4 — bloco
          de dado único que não se repete em outra tela. */}
      {endereco.atendido ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-campo border border-borda-forte bg-superficie-alta px-5 py-4">
          <div>
            <p className="font-mono text-[11px] tracking-widest text-texto-suave">
              DA COZINHA ATÉ AQUI
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {endereco.distanciaEstimada ? '~' : ''}
              {String(endereco.distanciaKm).replace('.', ',')} km
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-texto-suave">frete grátis acima de {formatarReais(15000)}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-campo border border-dashed border-borda-forte bg-superficie-alta/50 px-5 py-4">
          <div>
            <p className="font-mono text-[11px] tracking-widest text-texto-suave">
              DA COZINHA ATÉ AQUI
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-texto-suave">
              {String(endereco.distanciaKm).replace('.', ',')} km
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">ainda não entregamos aí</p>
            <p className="text-xs text-texto-suave">seu endereço fica salvo</p>
          </div>
        </div>
      )}

      {!endereco.atendido && (
        <p className="mt-4 text-sm text-texto-suave">
          Guardamos o endereço para saber onde tem gente esperando — é assim que a área de entrega
          cresce. Quando chegarmos em {endereco.bairro ?? endereco.cidade}, você é avisado.
        </p>
      )}

      {endereco.precisaConferencia && (
        <p className="mt-4 text-sm text-texto-suave">
          Vamos conferir essa posição antes da primeira entrega.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild size="sm" largura="natural">
          <Link href="/conta/enderecos">Ver meus endereços</Link>
        </Button>
        <Button asChild variant="ghost" size="sm" largura="natural">
          <Link href={`/conta/enderecos/${endereco.id}`}>Corrigir endereço</Link>
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
