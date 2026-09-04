'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert } from 'lucide-react';

import Link from 'next/link';

import { caminhoInternoSeguro } from '@/features/auth/destino';

import { Button } from '@napo/ui/components/button';
import { Checkbox } from '@napo/ui/components/checkbox';
import { Input } from '@napo/ui/components/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@napo/ui/components/input-otp';
import { Label } from '@napo/ui/components/label';
import { toast } from '@napo/ui/components/toaster';
import { AuthCard } from '@napo/ui/patterns/auth-card';

const CASAS_DO_CODIGO = 6;

interface RespostaApi {
  error?: string;
  data?: { destino?: string; podeReenviarEm?: number };
}

/** `61991504477` vira `(61) 99150-4477` conforme a pessoa digita. */
function mascaraDeCelular(entrada: string): string {
  const digitos = entrada.replace(/\D/g, '').slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 7) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

function contagem(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

async function enviarJson(
  url: string,
  corpo: unknown,
): Promise<{ ok: boolean; corpo: RespostaApi }> {
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  });

  return { ok: resposta.ok, corpo: (await resposta.json().catch(() => ({}))) as RespostaApi };
}

/**
 * Uma tela em dois passos, não duas telas: trocar de URL entre pedir e conferir
 * o código quebraria o botão voltar e perderia o contador de reenvio.
 */
export function FormValidarTelefone({
  nomeInicial,
  telefoneInicial,
  proximo,
}: {
  nomeInicial: string;
  telefoneInicial: string;
  /** Para onde voltar: quem chegou aqui no meio de uma compra volta para ela. */
  proximo?: string | null;
}) {
  const router = useRouter();

  const [passo, setPasso] = useState<'dados' | 'codigo'>('dados');
  const [nome, setNome] = useState(nomeInicial);
  const [telefone, setTelefone] = useState(mascaraDeCelular(telefoneInicial));
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [aceiteMarketing, setAceiteMarketing] = useState(false);

  const [codigo, setCodigo] = useState('');
  const [enviadoPara, setEnviadoPara] = useState('');
  const [restam, setRestam] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [erroCampo, setErroCampo] = useState<string | null>(null);

  // O contador aparece sempre, mesmo antes de esgotar: sem ele a pessoa clica em
  // reenviar três vezes em dez segundos e queima o teto diário (design §4.5).
  useEffect(() => {
    if (restam <= 0) return;
    const relogio = setTimeout(() => setRestam((s) => s - 1), 1000);
    return () => clearTimeout(relogio);
  }, [restam]);

  async function pedirCodigo() {
    setCarregando(true);
    setErroCampo(null);

    const { ok, corpo } = await enviarJson('/api/otp/enviar', { telefone, nome });
    setCarregando(false);

    if (!ok) {
      // Teto diário é aviso de sistema, não erro de campo (design §4.3).
      if (corpo.error?.startsWith('Limite')) toast.warning(corpo.error);
      else setErroCampo(corpo.error ?? 'Não foi possível enviar o código agora.');
      return;
    }

    setEnviadoPara(telefone);
    setCodigo('');
    setRestam(corpo.data?.podeReenviarEm ?? 60);
    setPasso('codigo');
  }

  async function confirmarCodigo() {
    setCarregando(true);
    setErroCampo(null);

    const { ok, corpo } = await enviarJson('/api/otp/validar', {
      codigo,
      aceiteTermos,
      aceiteMarketing,
    });

    if (!ok) {
      setCarregando(false);
      setErroCampo(corpo.error ?? 'Não foi possível confirmar o código.');
      return;
    }

    toast.success('WhatsApp confirmado.');

    // O destino pedido vence o padrão por papel: validar o telefone foi um
    // desvio no caminho de quem estava fechando pedido, não o objetivo dele.
    router.replace(caminhoInternoSeguro(proximo) ?? corpo.data?.destino ?? '/conta');
  }

  if (passo === 'codigo') {
    return (
      <AuthCard
        titulo="Digite o código"
        subtitulo={
          <>
            Enviamos 6 dígitos no WhatsApp{' '}
            <span className="font-medium text-branco">{enviadoPara}</span>.
          </>
        }
      >
        <InputOTP
          maxLength={CASAS_DO_CODIGO}
          value={codigo}
          onChange={(valor) => {
            setCodigo(valor);
            setErroCampo(null);
          }}
          aria-label="Código de 6 dígitos"
        >
          <InputOTPGroup>
            {Array.from({ length: CASAS_DO_CODIGO }, (_, casa) => (
              <InputOTPSlot key={casa} index={casa} invalido={erroCampo !== null} />
            ))}
          </InputOTPGroup>
        </InputOTP>

        {erroCampo ? (
          <p
            role="alert"
            aria-live="polite"
            className="mt-3 flex items-center gap-2 text-sm text-erro"
          >
            <CircleAlert className="h-[15px] w-[15px] shrink-0" />
            {erroCampo}
          </p>
        ) : null}

        <div className="mt-6 space-y-3">
          <Button
            disabled={carregando || codigo.length < CASAS_DO_CODIGO}
            onClick={() => void confirmarCodigo()}
          >
            {carregando ? 'Confirmando…' : 'Confirmar'}
          </Button>

          <div className="flex items-center justify-between text-sm">
            {restam > 0 ? (
              <span className="text-neutral-500">Reenviar em {contagem(restam)}</span>
            ) : (
              <Button
                variant="link"
                size="link"
                className="text-amarelo hover:text-amarelo"
                disabled={carregando}
                onClick={() => void pedirCodigo()}
              >
                Reenviar código
              </Button>
            )}

            <Button variant="link" size="link" onClick={() => setPasso('dados')}>
              Trocar número
            </Button>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      titulo="Confirme seu WhatsApp"
      subtitulo="É por ele que a gente avisa quando sua pizza sai para entrega — e é o número que o entregador liga se não achar a portaria."
    >
      <form
        className="space-y-4"
        onSubmit={(evento) => {
          evento.preventDefault();
          void pedirCodigo();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="nome">Seu nome</Label>
          <Input
            id="nome"
            required
            autoComplete="name"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefone">Celular com WhatsApp</Label>
          <Input
            id="telefone"
            required
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(61) 99999-9999"
            className="tracking-wide"
            value={telefone}
            aria-invalid={erroCampo !== null}
            aria-describedby={erroCampo ? 'erro-telefone' : undefined}
            onChange={(evento) => setTelefone(mascaraDeCelular(evento.target.value))}
          />
          {erroCampo ? (
            <p id="erro-telefone" role="alert" className="text-sm text-erro">
              {erroCampo}
            </p>
          ) : null}
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-start gap-3">
            <Checkbox
              id="termos"
              className="mt-0.5"
              checked={aceiteTermos}
              onCheckedChange={(marcado) => setAceiteTermos(marcado === true)}
            />
            <Label htmlFor="termos" className="cursor-pointer font-normal text-texto-suave">
              Li e aceito os{' '}
              <a href="/termos" className="text-branco underline underline-offset-2">
                Termos de Uso
              </a>{' '}
              e a{' '}
              <a href="/privacidade" className="text-branco underline underline-offset-2">
                Política de Privacidade
              </a>
              .
            </Label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="marketing"
              className="mt-0.5"
              checked={aceiteMarketing}
              onCheckedChange={(marcado) => setAceiteMarketing(marcado === true)}
            />
            <Label htmlFor="marketing" className="cursor-pointer font-normal text-texto-suave">
              Quero receber novidades e promoções pelo WhatsApp.{' '}
              <span className="text-neutral-500">(opcional)</span>
            </Label>
          </div>
        </div>

        {/* Desabilitado até o aceite: deixar clicar para depois reclamar é
            fricção sem informação nova (design §4.5). */}
        <Button type="submit" disabled={!aceiteTermos || carregando}>
          {carregando ? 'Enviando código…' : 'Enviar código no WhatsApp'}
        </Button>

        <p className="text-center text-xs text-neutral-500">
          Você recebe um código de 6 dígitos. Não cobramos nada por isso.
        </p>
      </form>

      {/* Saída para o site, não para a área logada: sem telefone validado não há
          área logada a voltar. Continuar navegando e comprar depois é um
          caminho legítimo — beco sem saída faz a pessoa fechar a aba, e aí a
          conta fica pela metade e ninguém consegue avisar. */}
      <Link
        href="/"
        className="mt-6 block text-center text-xs text-neutral-500 underline underline-offset-2 transition hover:text-neutral-300"
      >
        Deixar para depois e voltar ao site
      </Link>
    </AuthCard>
  );
}
