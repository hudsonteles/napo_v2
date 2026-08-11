'use client';

import { useEffect, useState } from 'react';
import { MailCheck } from 'lucide-react';

import { Button } from '@napo/ui/components/button';
import { Input } from '@napo/ui/components/input';
import { Label } from '@napo/ui/components/label';
import { toast } from '@napo/ui/components/toaster';
import { AuthCard } from '@napo/ui/patterns/auth-card';

import { caminhoInternoSeguro } from '@/features/auth/destino';
import { publicEnv } from '@/lib/env';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { IconeGoogle } from './icone-google';

const SEGUNDOS_PARA_REENVIAR = 60;

const MENSAGEM_POR_ERRO: Record<string, string> = {
  'link-invalido': 'Este link expirou ou já foi usado. Peça outro.',
  'perfil-indisponivel': 'Não conseguimos abrir sua conta agora. Tente de novo em instantes.',
};

function urlDeRetorno(proximo: string | null): string {
  const callback = new URL('/api/auth/callback', publicEnv.NEXT_PUBLIC_SITE_URL);
  const interno = caminhoInternoSeguro(proximo);
  if (interno) callback.searchParams.set('proximo', interno);
  return callback.toString();
}

function contagem(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

export function FormEntrar({ proximo, erro }: { proximo: string | null; erro: string | null }) {
  const [email, setEmail] = useState('');
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [restam, setRestam] = useState(0);

  useEffect(() => {
    const mensagem = erro ? MENSAGEM_POR_ERRO[erro] : null;
    if (mensagem) toast.error(mensagem);
  }, [erro]);

  useEffect(() => {
    if (restam <= 0) return;
    const relogio = setTimeout(() => setRestam((s) => s - 1), 1000);
    return () => clearTimeout(relogio);
  }, [restam]);

  async function enviarLink(destinatario: string) {
    setCarregando(true);
    setErroEmail(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: destinatario,
      options: { emailRedirectTo: urlDeRetorno(proximo) },
    });

    setCarregando(false);

    if (error) {
      setErroEmail('Não conseguimos enviar o link agora. Tente de novo em instantes.');
      return;
    }

    setEnviadoPara(destinatario);
    setRestam(SEGUNDOS_PARA_REENVIAR);
  }

  async function entrarComGoogle() {
    setCarregando(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: urlDeRetorno(proximo) },
    });

    if (error) {
      setCarregando(false);
      toast.error('Não foi possível entrar com o Google. Tente de novo.');
    }
  }

  if (enviadoPara) {
    return (
      <AuthCard
        titulo="Link enviado"
        icone={<MailCheck className="h-[22px] w-[22px]" />}
        subtitulo={
          <>
            Mandamos um link de acesso para{' '}
            <span className="font-medium text-branco">{enviadoPara}</span>. Abra pelo mesmo
            aparelho — ele vale por 1 hora.
          </>
        }
      >
        <div className="space-y-3">
          <Button
            variant="outline"
            disabled={restam > 0 || carregando}
            onClick={() => void enviarLink(enviadoPara)}
          >
            {restam > 0 ? `Reenviar em ${contagem(restam)}` : 'Reenviar link'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEnviadoPara(null)}>
            Usar outro e-mail
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      titulo="Entrar ou criar conta"
      subtitulo="Sem senha. A gente manda um link para o seu e-mail."
    >
      <form
        className="space-y-4"
        onSubmit={(evento) => {
          evento.preventDefault();
          void enviarLink(email);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="voce@email.com"
            value={email}
            aria-invalid={erroEmail !== null}
            aria-describedby={erroEmail ? 'erro-email' : undefined}
            onChange={(evento) => setEmail(evento.target.value)}
          />
          {erroEmail ? (
            <p id="erro-email" role="alert" className="text-sm text-erro">
              {erroEmail}
            </p>
          ) : null}
        </div>

        <Button type="submit" disabled={carregando}>
          {carregando ? 'Enviando…' : 'Receber link de acesso'}
        </Button>
      </form>

      {/* Markup cru declarado em design.md §4.4.4: divisor sem estado nem lógica. */}
      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-borda" />
        <span className="text-xs uppercase tracking-widest text-neutral-500">ou</span>
        <span className="h-px flex-1 bg-borda" />
      </div>

      <Button variant="outline" disabled={carregando} onClick={() => void entrarComGoogle()}>
        <IconeGoogle />
        Entrar com Google
      </Button>

      <p className="mt-7 text-xs leading-relaxed text-neutral-500">
        Ao continuar você concorda com os{' '}
        <a href="/termos" className="underline underline-offset-2 hover:text-neutral-300">
          Termos de Uso
        </a>{' '}
        e a{' '}
        <a href="/privacidade" className="underline underline-offset-2 hover:text-neutral-300">
          Política de Privacidade
        </a>
        .
      </p>
    </AuthCard>
  );
}
