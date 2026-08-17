import Link from 'next/link';
import { Button } from '@napo/ui/components/button';

/**
 * 404 da marca (RN1). Produto inativo ou slug desconhecido cai aqui — nunca no
 * erro cru do framework — com caminho de volta para a vitrine. Renderiza dentro
 * da shell de `(site)`, então já vem com cabeçalho e rodapé.
 */
export default function NaoEncontrado() {
  return (
    <section>
      <div className="mx-auto grid max-w-6xl place-items-center px-5 py-24 text-center sm:px-8 sm:py-32">
        <p className="text-7xl font-semibold tracking-tight text-borda-forte">404</p>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
          Esse sabor não está no cardápio
        </h1>
        <p className="mt-4 max-w-md leading-relaxed text-texto-suave">
          A página que você procurou não existe — ou o sabor saiu de linha. Os que estão saindo do
          forno estão todos aqui.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Button asChild largura="natural" className="px-6">
            <Link href="/sabores">Ver os sabores</Link>
          </Button>
          <Button asChild variant="outline" largura="natural" className="px-6">
            <Link href="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
