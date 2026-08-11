import { cn } from '../lib/cn';

/**
 * Logotipo da Napo — o "O" da palavra é a pizza vista de cima.
 *
 * `escura` é a arte para **fundo escuro** (traço claro), padrão do app;
 * `clara` é para fundo claro, e existe para e-mail, impresso e futuras
 * superfícies brancas.
 *
 * Serve o PNG direto de `/public` em vez de passar pelo `next/image`: são 44 KB
 * já otimizados, e a cota de transformação de imagem da Vercel é custo real
 * (arquitetura §4.5). `width`/`height` intrínsecos evitam CLS mesmo assim.
 */
export function Marca({
  variante = 'escura',
  className,
}: {
  variante?: 'escura' | 'clara';
  className?: string;
}) {
  return (
    // <img> e não `next/image`: packages/ui não depende do Next (ARCHITECTURE §3.2).
    <img
      src={variante === 'escura' ? '/marca/logo-dark.png' : '/marca/logo-light.png'}
      alt="Napo"
      width={846}
      height={252}
      className={cn('h-9 w-auto', className)}
    />
  );
}
