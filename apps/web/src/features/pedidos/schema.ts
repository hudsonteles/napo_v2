import { z } from 'zod';

/**
 * Entrada do checkout (RN3).
 *
 * `.strict()` não é preciosismo: é o que faz `total`, `frete`, `distancia` ou
 * `formaPagamento` vindos do navegador serem **recusados** em vez de ignorados
 * em silêncio (T13, T21). Campo ignorado é campo que alguém tenta de novo.
 */
export const esquemaCriarPedido = z
  .object({
    itens: z
      .array(
        z
          .object({
            produtoId: z.string().uuid(),
            quantidade: z.number().int().positive(),
            /**
             * O preço que o cliente **viu**, nunca o que ele paga. Serve só para
             * a comparação da RN3: se mudou entre a vitrine e o pagamento, a
             * resposta é 409 com os dois valores, não uma cobrança surpresa.
             */
            precoVistoCentavos: z.number().int().min(0),
          })
          .strict(),
      )
      .min(1),
    enderecoId: z.string().uuid(),
  })
  .strict();

export type EntradaCriarPedido = z.infer<typeof esquemaCriarPedido>;

/** Revalidação da tela do carrinho — sem sessão, porque o carrinho é anônimo (RN1). */
export const esquemaValidarCarrinho = z
  .object({
    itens: z
      .array(z.object({ produtoId: z.string().uuid(), quantidade: z.number().int().positive() }).strict())
      .min(1),
  })
  .strict();

export type EntradaValidarCarrinho = z.infer<typeof esquemaValidarCarrinho>;
