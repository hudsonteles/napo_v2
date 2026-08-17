import { Marca } from '@napo/ui/components/marca';
import { cn } from '@napo/ui/lib/cn';

/**
 * A pizza vista de cima é o sistema visual do site: produto em disco, não em
 * retângulo (design §4.4.5). O recorte circular apara o fundo inconsistente das
 * fotos (tábua, granito, xadrez). Sem foto ainda, o placeholder ocupa a MESMA
 * proporção — sem salto de layout quando o ensaio chegar (RN11).
 *
 * `<img>` sem `next/image`: fotos pré-otimizadas, custo zero por visita (design §5).
 */
export function Disco({
  fotoUrl,
  alt,
  className,
  esmaecido = false,
}: {
  fotoUrl: string | null;
  alt: string;
  className?: string;
  /** Esgotado: a foto perde cor, e o carimbo entra por cima (design §4.4.5). */
  esmaecido?: boolean;
}) {
  return (
    <div
      className={cn(
        'mx-auto aspect-square w-[74%] overflow-hidden rounded-full shadow-2xl shadow-black/50',
        className,
      )}
    >
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto pré-otimizada servida do CDN, sem transformação da Vercel (design §5)
        <img
          src={fotoUrl}
          alt={alt}
          className={cn(
            'h-full w-full object-cover transition duration-500 group-hover:scale-105',
            esmaecido && 'opacity-40 grayscale',
          )}
        />
      ) : (
        <div className="grid h-full place-items-center bg-preto/40">
          <Marca className="h-7 opacity-20" />
          <span className="sr-only">Foto em produção</span>
        </div>
      )}
    </div>
  );
}
