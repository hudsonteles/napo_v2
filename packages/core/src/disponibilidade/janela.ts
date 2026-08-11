import { diaDaSemanaEmBrasilia, hojeEmBrasilia, somarDias } from '../tempo';
import { calcularCutoff } from './cutoff';
import type { DataCalendario, Snapshot } from './tipos';

/** O dia entrega? `entrega_extra` abre uma data fora do dia da semana; `sem_entrega` fecha. */
export function ehDiaDeEntrega(dia: DataCalendario, snapshot: Snapshot): boolean {
  const excecao = snapshot.excecoes.find((e) => e.data === dia);
  if (excecao?.tipo === 'sem_entrega') return false;
  if (excecao?.tipo === 'entrega_extra') return true;

  const diaSemana = diaDaSemanaEmBrasilia(dia);
  return snapshot.diasEntrega.some((d) => d.diaSemana === diaSemana && d.entrega);
}

/**
 * Dias de entrega oferecidos no horizonte deslizante (RN3, RN4).
 *
 * O buffer remove o dia apenas na faixa que **antecede** o cutoff — é ali que
 * o cliente correria contra o relógio durante o pagamento. Depois do cutoff o
 * dia volta a ser oferecido, agora em ATP: vender lote pronto não depende de
 * prazo de fermentação (RN6).
 */
export function diasDeEntregaDoHorizonte(snapshot: Snapshot): DataCalendario[] {
  const hoje = hojeEmBrasilia(snapshot.agora);
  const totalDias = 7 * snapshot.config.horizonteSemanas;
  const bufferMs = snapshot.config.bufferCutoffMin * 60 * 1000;
  const agoraMs = snapshot.agora.getTime();

  const dias: DataCalendario[] = [];
  for (let i = 0; i <= totalDias; i += 1) {
    const dia = somarDias(hoje, i);
    if (!ehDiaDeEntrega(dia, snapshot)) continue;

    const cutoffMs = calcularCutoff(dia, snapshot).getTime();
    const dentroDoBuffer = agoraMs >= cutoffMs - bufferMs && agoraMs <= cutoffMs;
    if (dentroDoBuffer) continue;

    dias.push(dia);
  }
  return dias;
}
