import { z } from 'zod';

/**
 * Contratos de entrada da feature de pedidos (NAPO-006).
 *
 * O princípio das RN3/RN18 vira `.strict()`: tudo que vale dinheiro — total,
 * frete, distância, dia — é DERIVADO no servidor, nunca recebido. Um campo extra
 * no corpo não é ignorado, é recusado: aceitar calado seria deixar o cliente
 * escolher o próprio preço por um caminho lateral (T13, T21).
 */

/**
 * Um item do checkout. O cliente manda id, quantidade e o preço que VIU na
 * vitrine — este último serve só à conferência de divergência (RN3), e o
 * servidor recalcula o que cobra a partir do catálogo atual.
 */
export const itemCheckoutSchema = z
  .object({
    produtoId: z.string().uuid(),
    quantidade: z.number().int().positive(),
    precoUnitarioCentavos: z.number().int().min(0),
  })
  .strict();

/**
 * Corpo do `POST /api/pedidos`. Só itens e endereço: nenhum valor, nenhum frete,
 * nenhuma forma de pagamento (o pagamento online é obrigatório, RN5 — declarar
 * "na entrega" é justamente o que o `.strict()` recusa em T21).
 */
export const criarPedidoSchema = z
  .object({
    itens: z.array(itemCheckoutSchema).min(1),
    enderecoId: z.string().uuid(),
  })
  .strict();

/**
 * Corpo do `POST /api/carrinho/validar`. Sem sessão (RN1) e sem preço: a
 * revalidação existe para o servidor DIZER o preço atual, não para recebê-lo.
 */
export const validarCarrinhoSchema = z
  .object({
    itens: z
      .array(
        z
          .object({
            produtoId: z.string().uuid(),
            quantidade: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

/**
 * Corpo da notificação do Mercado Pago (RN8, RN10) — consumido pelo webhook do
 * bloco H. Nasce aqui porque schema é o lugar do contrato de entrada; do corpo
 * só o `data.id` é confiável, e é o único campo que o webhook lê antes de buscar
 * a verdade na API. `passthrough` porque o Mercado Pago acrescenta campos sem
 * aviso e derrubar a notificação por um campo novo seria transformar melhoria
 * deles em pedido nosso que não confirma.
 */
export const notificacaoMpSchema = z
  .object({
    type: z.string().optional(),
    action: z.string().optional(),
    data: z.object({ id: z.union([z.string(), z.number()]) }),
  })
  .passthrough();

export type ItemCheckout = z.infer<typeof itemCheckoutSchema>;
export type EntradaCriarPedido = z.infer<typeof criarPedidoSchema>;
export type EntradaValidarCarrinho = z.infer<typeof validarCarrinhoSchema>;
export type NotificacaoMp = z.infer<typeof notificacaoMpSchema>;
