import { Info } from 'lucide-react';

import { lerCatalogo, VitrineFiltravel } from '@/features/catalogo';

// SSG com revalidação longa (design §4.5): o catálogo muda por deploy, a
// revalidação é rede de segurança. `force-static` garante que a página sai do
// CDN — zero render por visita (KPI de custo / T19).
export const dynamic = 'force-static';
export const revalidate = 3600;

export default async function VitrinePage() {
  const { categorias, produtos } = await lerCatalogo();

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <h1 className="text-[clamp(2rem,6vw,3.75rem)] leading-[1.02] font-extrabold tracking-[-0.03em] text-balance">
        Cardápio de pizza congelada
      </h1>
      <p className="mt-5 max-w-lg leading-relaxed text-texto-suave">
        Doze opções, todas assadas na pedra e congeladas prontas. Escolha a fornada e monte seu
        pedido — preços sem frete.
      </p>

      <VitrineFiltravel produtos={produtos} categorias={categorias} />

      <p className="mt-14 flex items-start gap-3 border-t border-borda pt-8 text-sm leading-relaxed text-texto-suave">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Todos os produtos são feitos na mesma cozinha, onde também se manipula{' '}
          <strong className="font-medium text-branco">glúten, leite, soja e avelã</strong>. Pode
          conter traços mesmo quando o ingrediente não está na receita.
        </span>
      </p>
    </main>
  );
}
