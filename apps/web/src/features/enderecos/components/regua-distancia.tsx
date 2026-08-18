import { centavosParaReais } from '@napo/core';
import type { FaixaFrete } from '@napo/core';

/**
 * Trilho de 0 até o raio, com as faixas marcadas e o endereço na posição
 * proporcional à distância.
 *
 * É a direção aprovada pelo PM em 2026-08-17, e reaproveita a linguagem da régua
 * da home (NAPO-003). A alternativa "etiqueta de remessa" foi rejeitada: é o
 * vocabulário do estoque, não o do cliente — quem cadastra endereço quer saber
 * quanto custa, não conferir uma etiqueta.
 *
 * Fora da área o trilho não estica: o ponto aparece **além** do fim, que é o que
 * comunica "está fora" sem pintar de vermelho quem não errou nada.
 */
export function ReguaDistancia({
  distanciaKm,
  raioKm,
  faixas,
  atendido,
}: {
  distanciaKm: number | null;
  raioKm: number;
  faixas: FaixaFrete[];
  atendido: boolean;
}) {
  if (distanciaKm === null) return null;

  const foraDaRegua = !atendido || distanciaKm > raioKm;

  if (foraDaRegua) {
    return (
      <div className="mt-6">
        <div className="relative h-1.5 w-full rounded-full bg-superficie-alta">
          <div className="absolute inset-y-0 left-0 right-6 rounded-full bg-borda" />
          <div className="absolute -top-1 right-0 flex items-center gap-1">
            <span className="h-3.5 w-3.5 rounded-full border border-borda-forte bg-preto" />
          </div>
        </div>
        <div className="mt-2 flex justify-between font-mono text-[11px] text-texto-suave">
          <span>0</span>
          <span>limite: {raioKm} km</span>
          <span className="text-borda-forte">{formatarKm(distanciaKm)} km ↗</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="relative h-1.5 w-full rounded-full bg-superficie-alta">
        {faixas.map((faixa, indice) => (
          <div
            key={faixa.kmDe}
            className={[
              'absolute inset-y-0',
              indice === 0 ? 'rounded-l-full bg-borda-forte' : 'bg-borda',
              indice === faixas.length - 1 ? 'rounded-r-full' : '',
            ].join(' ')}
            style={{
              left: `${(faixa.kmDe / raioKm) * 100}%`,
              width: `${((faixa.kmAte - faixa.kmDe) / raioKm) * 100}%`,
            }}
          />
        ))}
        <div
          className="absolute -top-1.5 h-4.5 w-1 rounded-full bg-amarelo"
          style={{ left: `${Math.min((distanciaKm / raioKm) * 100, 100)}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-texto-suave">
        <span>0</span>
        {faixas.map((faixa) => (
          <span key={faixa.kmDe}>
            {faixa.kmAte} km · {reaisCompacto(faixa.valorCentavos)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** "3.4" vira "3,4" e "12" continua "12" — vírgula decimal, sem casa inventada. */
function formatarKm(km: number): string {
  return String(km).replace('.', ',');
}

/**
 * "R$ 6" na régua, não "R$ 6,00": são quatro rótulos de 11px lado a lado, e o
 * centavo que nunca varia só rouba espaço. O valor cheio fica no card, onde é
 * preço de verdade.
 */
function reaisCompacto(centavos: number): string {
  return `R$ ${centavosParaReais(centavos).replace(/,00$/, '')}`;
}

export { formatarKm };
