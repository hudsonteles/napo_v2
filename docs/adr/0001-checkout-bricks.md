# 0001. Pagamento online no nosso domínio com Checkout Bricks, não Checkout Pro

---

**Status:** Proposto
**Data:** 2026-09-05
**Decisor(es):** Hudson (PM)
**Disparado por:** Requisito de produto levantado durante o `/especificar` do NAPO-023 — o cliente não deve sair do site para pagar. Detalhado em `docs/superpowers/specs/2026-09-05-espinha-cobranca-design.md` §3.2.

---

## Contexto

O `ARCHITECTURE.md` §2.1 crava **"Mercado Pago Checkout Pro (conta PJ) — Pix, crédito,
débito"**. O NAPO-006 implementou o checkout sobre essa decisão: cria uma *preferência*
via API e devolve uma URL para onde o cliente é enviado.

O checkout nunca rodou contra o Mercado Pago de verdade — o NAPO-006 fechou com
`PAGAMENTO_PROVIDER=fake`. O NAPO-023 existia para exercitar esse caminho em
desenvolvimento. Ao iniciar essa spec, o PM levantou o requisito de **manter o cliente
no site durante o pagamento**, por experiência: a identidade da Napo é premium e o
redirecionamento para uma página de terceiro quebra a narrativa no momento mais
sensível da compra.

Duas restrições tornam a decisão obrigatória agora, não adiável:

1. **O Checkout Pro não tem mais modo embutido.** O modelo modal foi descontinuado em
   **21/12/2023**, em resposta à restrição de cookies de terceiros do Google. Hoje o
   Checkout Pro oferece apenas redirect — mesma aba ou aba nova. Não existe
   configuração que o mantenha no site.
2. **Trocar depois custa duas vezes.** O NAPO-023 iria exercitar o caminho do Checkout
   Pro de ponta a ponta; fazer isso agora e migrar em seguida jogaria fora exatamente
   o que tivesse sido validado.

**Referências:**

- Seção afetada: `ARCHITECTURE.md` §2.1 (Stack Tecnológica — Pagamento)
- Itens do ROADMAP afetados: NAPO-023 (absorvido), NAPO-006 (concluído, código
  alterado), e o novo item da espinha de cobrança
- Specs afetadas: `docs/specs/006-checkout/` (spec, design e tests aprovados)
- Design de origem: `docs/superpowers/specs/2026-09-05-espinha-cobranca-design.md`

---

## Decisão

**O pagamento online da Napo passa a usar Checkout Bricks — especificamente o Payment
Brick — renderizado no nosso próprio domínio.** O `ARCHITECTURE.md` §2.1 deixa de dizer
"Checkout Pro" e passa a dizer "Checkout Bricks (Payment Brick)".

O fluxo inverte de sentido. Hoje o servidor cria uma preferência e entrega uma URL para
o cliente visitar. Passa a ser: o Brick coleta os dados e **tokeniza o cartão no
navegador**, dentro de campos isolados servidos pelo Mercado Pago; o token chega ao
nosso backend, que **cria o pagamento** via API. Dado de cartão não passa pelo nosso
servidor em nenhum momento.

A confirmação **não muda**: continua sendo por webhook, com verificação de assinatura,
consulta do valor no gateway e idempotência — as RN8, RN9, RN10 e RN11 do NAPO-006
seguem valendo palavra por palavra. A porta `PortaPagamento` criada no NAPO-006
absorve a troca; o que muda é a forma de `criarCobranca`, não o contrato de
confirmação.

Esta decisão é parte de um desenho maior (a espinha de cobrança) em que o pagamento
online é **um** entre cinco instrumentos. O ADR cobre apenas a troca do mecanismo
online; os demais instrumentos não alteram `ARCHITECTURE.md` §2.1.

---

## Alternativas consideradas

- **A — Manter Checkout Pro (redirect):** continuar como está, aceitando que o cliente
  vá para o domínio do Mercado Pago e volte. · **Descartada porque:** não atende o
  requisito de produto que originou a discussão. O ganho seria não mexer no código do
  NAPO-006 — mas esse código precisa ser exercitado de qualquer forma, e exercitá-lo
  para depois substituí-lo é trabalho jogado fora.

- **B — Checkout Pro em modal/iframe:** manter o Checkout Pro sobrepondo o nosso site.
  · **Descartada porque:** **não existe mais.** Descontinuado pelo Mercado Pago em
  21/12/2023 por causa da restrição de cookies de terceiros. Não é uma questão de
  preferência.

- **C — Checkout Transparente (Checkout API):** construir o formulário inteiro,
  tokenizando com o SDK deles. · **Descartada porque:** entrega o mesmo resultado
  visual do Payment Brick com muito mais superfície nossa para manter — validações,
  parcelamento, bandeiras, 3DS, meios de pagamento novos. Assume trabalho contínuo de
  acompanhar mudanças de meios de pagamento que o Brick absorve sozinho. A liberdade
  extra de layout não paga esse custo para uma operação do tamanho da Napo.

- **D — Trocar de gateway (Stripe, Pagar.me, Asaas):** aproveitar a reescrita para
  reavaliar o provedor. · **Descartada porque:** a casa **já opera duas maquininhas
  Mercado Pago**, e o desenho da espinha depende de conciliar online e presencial na
  mesma conta. Sair do Mercado Pago no online quebraria a conciliação unificada, que é
  o maior ganho do desenho. A decisão Mercado Pago × Stripe já havia sido tomada e
  reaberta uma vez no NAPO-006.

---

## Consequências

### Positivas

- O cliente **não sai do site** — atende o requisito que originou o ADR.
- **Pix com QR na nossa página**, em vez de em página de terceiro.
- Dado de cartão **nunca toca o nosso servidor** (tokenização em campos isolados do
  Mercado Pago), então a exposição a PCI não aumenta em relação ao redirect.
- O Brick traz validações, parcelamento, bandeiras e 3DS 2.0 prontos, e absorve
  sozinho meios de pagamento novos.
- A porta `PortaPagamento` do NAPO-006 prova seu valor: a troca é escrever um
  adaptador, não reescrever o checkout.

### Negativas / trade-offs aceitos

- **O Brick é componente do Mercado Pago.** Aceita customização (cores, tipografia,
  raio), mas não fica 100% na identidade Napo como o resto do site. É o preço de não
  manter formulário de cartão próprio.
- **Pagamento em um toque com cartão salvo do Mercado Pago deixa de vir de graça.** No
  Checkout Pro o cliente logado paga com cartão salvo; com o Payment Brick isso vira o
  Wallet Brick, se e quando fizer sentido. **Risco de conversão a monitorar.**
- **Retrabalho no NAPO-006:** `criarCobranca()` muda de forma, o `PagamentoFake` muda
  junto, e a tela de checkout ganha o Brick — o que **dispara Gate Visual A**.
- Nova dependência de frontend (`@mercadopago/sdk-react`) e nova variável pública
  `NEXT_PUBLIC_MP_PUBLIC_KEY`.
- O Mercado Pago está migrando Payment Intents → **Orders API**. Adotar Bricks agora
  significa acompanhar essa migração dentro do adaptador.

### Impacto em `ARCHITECTURE.md`

- **§2.1 passa a dizer:** "Pagamento: Mercado Pago **Checkout Bricks** (Payment Brick,
  conta PJ) — Pix, crédito, débito, conta Mercado Pago. Pagamento presencial via Point
  Integration API." A menção a Checkout Pro sai.
- **§6.1** ganha `NEXT_PUBLIC_MP_PUBLIC_KEY` na lista de variáveis, e a linha "Webhook
  Mercado Pago" precisa registrar que há **dois tópicos** (`payment` e
  `point_integration_wh`/`orders`), não um.
- **Sem impacto** em §2.2 (UI & UX), §3 (Arquitetura de Código) ou §4.5 (custo).

### Impacto em itens do ROADMAP

- **NAPO-023** — cancelado por absorção. Seu escopo (exercitar o Mercado Pago real em
  dev) passa a ser parte do item da espinha de cobrança, agora sobre Bricks.
- **NAPO-025 (espinha de cobrança)** — este ADR é seu pré-requisito; a spec não começa
  antes de `Status: Aceito`.
- **NAPO-006** — concluído, mas seu código é alterado. A spec em
  `docs/specs/006-checkout/` continua válida no contrato de negócio (RN8–RN11,
  RN14, RN19) e desatualizada no mecanismo. Registrar isso na spec, não reabri-la.

### Riscos a monitorar pós-decisão

- **Conversão do checkout online.** A perda do pagamento em um toque com cartão salvo
  pode custar vendas. · **Gatilho de revisão:** queda perceptível de conversão após o
  primeiro mês com Bricks em produção → avaliar o Wallet Brick.
- **Aparência do Brick contra a identidade Napo.** · **Gatilho:** se o Gate Visual A da
  spec da espinha reprovar o resultado mesmo após customização, reabrir a alternativa C
  (Checkout Transparente) com o custo já conhecido.
- **Migração para a Orders API.** · **Gatilho:** anúncio de descontinuação da API de
  pagamentos atual, ou quebra em ambiente de teste.

---

## Aprovação

- [ ] Revisado por: Hudson · em ____-__-__
