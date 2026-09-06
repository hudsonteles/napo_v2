import { NextResponse } from 'next/server';

import { calcularDisponibilidade } from '@napo/core';

import { lerCatalogo } from '@/features/catalogo';
import { carregarSnapshot } from '@/features/disponibilidade';
import { calcularFreteDoEndereco, listarEnderecos } from '@/features/enderecos';
import { criarPedido, esquemaCriarPedido, repositorioDePedidos } from '@/features/pedidos';
import type { FontesDoPedido } from '@/features/pedidos';
import { exigirClienteValidado } from '@/lib/guarda-api';

export const dynamic = 'force-dynamic';

/**
 * Um endpoint para revalidar, reservar e gravar: três passos que só têm sentido
 * juntos, e expor cada um deixaria o cliente parar no meio com uma vaga
 * reservada e nenhum pedido dono dela. **Cobrar é a próxima tela** (NAPO-025):
 * o gateway saiu daqui para o cliente não esperar o terceiro com o cartão na
 * mão antes de ter vaga garantida.
 *
 * A composição das fontes mora **aqui**, e não no serviço: catálogo,
 * disponibilidade e endereços são features distintas, e só a camada `app` pode
 * importar de várias (ARCHITECTURE §3.2).
 */
function fontesDoPedido(): FontesDoPedido {
  return {
    async precos(produtoIds) {
      const { produtos } = await lerCatalogo();

      // A RLS anônima já devolve só o ativo: produto descontinuado simplesmente
      // não aparece, e o pedido morre em "fora do catálogo" antes de reservar.
      return produtos
        .filter((item) => produtoIds.includes(item.produto.id))
        .map((item) => ({
          produtoId: item.produto.id,
          nome: item.produto.nome,
          precoUnitarioCentavos: item.precoEfetivoCentavos,
          ehMassa: item.categoria.ehMassa,
        }));
    },

    async disponibilidade(produtos) {
      const snapshot = await carregarSnapshot(produtos);
      return { dias: calcularDisponibilidade(snapshot), consumos: snapshot.consumos };
    },

    async endereco(enderecoId) {
      // A RLS por dono é quem garante que o endereço é de quem está pagando —
      // conferir `profile_id` aqui seria repetir a regra num lugar a mais.
      const enderecos = await listarEnderecos();
      const escolhido = enderecos.find((endereco) => endereco.id === enderecoId);

      return escolhido
        ? { id: escolhido.id, atendido: escolhido.atendido, snapshot: escolhido }
        : null;
    },

    frete: calcularFreteDoEndereco,
  };
}

export async function POST(request: Request) {
  const guarda = await exigirClienteValidado();
  if ('resposta' in guarda) return guarda.resposta;

  const corpo = esquemaCriarPedido.safeParse(await request.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json(
      { success: false, error: 'Requisição inválida.' },
      { status: 400 },
    );
  }

  const resultado = await criarPedido(corpo.data, guarda.perfil.id, {
    fontes: fontesDoPedido(),
    repo: repositorioDePedidos(),
  });

  if (!resultado.ok) {
    const { status, ...falha } = resultado.falha;
    return NextResponse.json({ success: false, error: falha }, { status });
  }

  return NextResponse.json({ success: true, data: resultado.pedido });
}
