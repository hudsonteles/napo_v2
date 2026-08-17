import Link from 'next/link';
import { Button } from '@napo/ui/components/button';
import { CabecalhoSite } from '@napo/ui/patterns/cabecalho-site';
import { RodapeSite } from '@napo/ui/patterns/rodape-site';

/**
 * 404 da marca (RN1), GLOBAL. Fica na raiz e não em `(site)` de propósito: com
 * `dynamicParams=false`, o slug de produto desconhecido (ou inativo, que a RLS
 * esconde) 404 no ROTEAMENTO e o Next resolve isso pelo not-found da raiz, não
 * pelo do grupo. Como o layout raiz não tem cabeçalho/rodapé, a shell é composta
 * aqui — o 404 nunca aparece como erro cru do framework.
 */
export default function NaoEncontrado() {
  return (
    <>
      <CabecalhoSite />
      <main>
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
      </main>
      <RodapeSite />
    </>
  );
}
