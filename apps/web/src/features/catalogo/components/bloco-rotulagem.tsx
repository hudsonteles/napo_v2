import { AlertTriangle } from 'lucide-react';
import type { ProdutoCatalogo } from '@napo/core';

import { rotuloAlergeno } from '../alergenos';

/**
 * Rotulagem obrigatória (RN2/RN4) em vocabulário de etiqueta, monoespaçada. Duas
 * declarações distintas: "Contém" (composição) e "Pode conter" (risco de contato
 * na cozinha compartilhada). O aviso fica junto do preço/CTA, nunca em rodapé
 * (design §4.5) — quem tem alergia decide antes de comprar, não quando a caixa
 * chega. Alérgeno sempre em texto, não só cor (§4.7).
 */
export function BlocoRotulagem({ produto }: { produto: ProdutoCatalogo }) {
  const contem = produto.alergenosContem.map(rotuloAlergeno).join(', ');
  const podeConter = produto.alergenosPodeConter.map(rotuloAlergeno).join(' e ');

  return (
    <section className="mt-10">
      <h2 className="font-mono text-xs tracking-[0.25em] text-texto-suave uppercase">
        Informação obrigatória
      </h2>

      <div className="mt-4 rounded-card border border-erro/30 bg-erro/[0.06] p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-erro">
          <AlertTriangle className="h-4 w-4" />
          Contém: {contem}
        </p>
        <p className="mt-2.5 text-sm leading-relaxed text-texto-suave">
          <strong className="font-medium text-branco">Pode conter</strong>{' '}
          {podeConter ? `traços de ${podeConter}: ` : 'traços de outros alérgenos: '}a mesma cozinha
          manipula glúten, leite, soja e avelã, e não há linha separada.
        </p>
      </div>

      <dl className="mt-4 divide-y divide-dashed divide-borda-forte rounded-card border border-borda bg-superficie px-5 font-mono text-[13px]">
        <Linha rotulo="Peso líquido" valor={`${produto.pesoLiquidoG} g`} />
        <Linha rotulo="Validade" valor={`${produto.validadeDias} dias congelada`} />
        <Linha rotulo="Conservação" valor={produto.conservacao ?? ''} />
        {produto.diametroCm ? (
          <Linha
            rotulo="Diâmetro"
            valor={`${produto.diametroCm} cm${produto.porcoes ? ` · serve ${produto.porcoes}` : ''}`}
          />
        ) : null}
      </dl>
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 py-3.5">
      <dt className="text-texto-suave uppercase">{rotulo}</dt>
      <dd className="max-w-[60%] text-right">{valor}</dd>
    </div>
  );
}
