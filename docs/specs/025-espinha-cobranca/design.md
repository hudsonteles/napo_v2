# 🏗️ Design: Espinha de cobrança (NAPO-025)

**Spec relacionado:** [`spec.md`](./spec.md)
**Testes relacionados:** [`tests.md`](./tests.md)
**ADR:** [ADR-0001 — Checkout Bricks](../../adr/0001-checkout-bricks.md)

---

## 1. Mapa de Impacto

| Arquivo / Módulo | Ação | Risco | Justificativa |
|---|---|---|---|
| `supabase/migrations/0016_cobrancas.sql` | Criar | **Alto** | Entidade `cobrancas`, enums de instrumento/situação/momento, derivação da situação de pagamento e backfill do que hoje mora em `pedidos` |
| `supabase/migrations/0017_pedido_eixo_entrega.sql` | Criar | **Alto** | Contract: derruba as colunas de pagamento do pedido, troca o enum de `status` pelo eixo de entrega e reescreve `vagas_ocupadas` |
| `supabase/tests/*.sql` (pgTAP) | Criar/Modificar | **Alto** | `vagas_ocupadas` é lida pelo site inteiro; a derivação da RN2 e as restrições da RN7/RN10 são regra de dinheiro |
| `packages/core/src/pagamento/recusa.ts` | Criar | Baixo | Famílias de motivo de recusa (RN13) — decisão pura, sem gateway |
| `packages/core/src/index.ts` | Modificar | Baixo | Barrel do novo módulo |
| `apps/web/src/lib/pagamentos/porta.ts` | Modificar | **Alto** | `criarCobranca` inverte de sentido; entram instrumento e o contrato explícito da RN14 |
| `apps/web/src/lib/pagamentos/mercado-pago.ts` | Modificar | **Alto** | `POST /v1/payments` com token e `X-Idempotency-Key` no lugar de `Preference`; correção do 404 (RN14) |
| `apps/web/src/lib/pagamentos/fake.ts` | Modificar | Médio | Acompanha a nova forma da porta; é o que mantém o fluxo fechado sem túnel |
| `apps/web/src/lib/pagamentos/assinatura.ts` | Reutilizar | — | HMAC do manifesto sobrevive intacto |
| `apps/web/src/lib/env.ts` | Modificar | Médio | `NEXT_PUBLIC_MP_PUBLIC_KEY` obrigatória quando o provider é real |
| `apps/web/src/features/pedidos/services/cobrancas-repo.ts` | Criar | **Alto** | Persistência das cobranças e leitura da situação derivada |
| `apps/web/src/features/pedidos/services/criar-cobranca.ts` | Criar | **Alto** | Recebe o token do Brick, abre a cobrança e chama a porta (RN10, RN12, RN13) |
| `apps/web/src/features/pedidos/services/criar-pedido.ts` | Modificar | **Alto** | Para de criar preferência: termina na reserva + pedido, sem tocar o gateway |
| `apps/web/src/features/pedidos/services/confirmar-pagamento.ts` | Modificar | **Alto** | Resolve o pedido **pela cobrança**; o resto do pipeline sobrevive |
| `apps/web/src/features/pedidos/services/pedidos-repo.ts` | Modificar | **Alto** | Perde a gravação de pagamento; ganha a leitura da situação derivada |
| `apps/web/src/features/pedidos/services/dependencias.ts` | Modificar | Médio | Injeta o repositório de cobranças |
| `apps/web/src/features/pedidos/schema.ts` | Modificar | Médio | Schema Zod do envio do Brick |
| `apps/web/src/features/pedidos/index.ts` | Modificar | Baixo | Barrel |
| `apps/web/app/api/pedidos/route.ts` | Modificar | **Alto** | Devolve pedido reservado em vez de URL de pagamento |
| `apps/web/app/api/pagamentos/route.ts` | Criar | **Alto** | Onde o token do Brick vira pagamento |
| `apps/web/app/api/pedidos/[numero]/route.ts` | Modificar | Médio | Passa a devolver a situação de pagamento derivada |
| `apps/web/app/api/webhook/mp/route.ts` | Modificar | **Alto** | Segue única porta de entrada de `payment`; resolve por cobrança |
| `apps/web/app/api/manutencao/pedidos-parados/route.ts` | Modificar | Médio | A varredura da RN19 passa pela cobrança |
| `apps/web/app/(loja)/checkout/page.tsx` | Modificar | Médio | 🎨 O passo 2 deixa de ser texto e vira o gesto de reservar |
| `apps/web/src/features/pedidos/components/checkout-cliente.tsx` | Modificar | **Alto** | 🎨 Deixa de redirecionar; navega para a página de pagamento |
| `apps/web/src/features/pedidos/components/resumo-pedido.tsx` | Modificar | Médio | 🎨 Microcopy e rótulo do botão mudam de "pagar" para "reservar" |
| `apps/web/app/(loja)/pedido/[numero]/pagar/page.tsx` | Criar | **Alto** | 🎨 Onde o Brick vive |
| `apps/web/src/features/pedidos/components/brick-pagamento.tsx` | Criar | **Alto** | 🎨 Ilha que monta o Payment Brick e trata a recusa |
| `apps/web/src/features/pedidos/components/estado-pagamento.tsx` | Modificar | Médio | 🎨 Lê situação derivada em vez de `status` |
| `.env.example` | Modificar | Baixo | Nova variável pública |

> **28 linhas — acima do limite de 15 do template.** É uma spec grande de propósito: quebrar em duas deixaria um estado intermediário em que a cobrança existe e ninguém a cria, ou o Brick existe sem entidade por trás. O `plan.md` do `/implementar` sequencia isso em blocos (§7).

---

## 2. Decisões de Schema

### 2.1 Mudanças

- **Nova entidade `cobrancas`.** Uma tentativa de receber um valor de um pedido: instrumento, valor, situação, quem criou, quem declarou (dinheiro) e o rastro do gateway. Não é campo em `pedidos` porque o pedido tem 0..n tentativas (RN1) — e porque a segunda tentativa de cartão é o caso comum, não a exceção.
- **`cobrancas.expira_em`** nasce igual ao `pedidos.expira_em` (RN11). Um relógio só, copiado no insert e não recalculado: a cobrança precisa saber quando morre sem consultar o pedido a cada leitura.
- **Índice único parcial `uma_cobranca_viva_por_pedido`** — `unique (pedido_id) where situacao = 'pendente'`. **É a RN10 aplicada pelo banco:** o segundo clique viola a restrição, o serviço captura e devolve a cobrança que já existe. Só depois de a primeira virar `recusada` é que a próxima tentativa cabe (RN12).
- **Índice único parcial em `mp_payment_id`** — migra de `pedidos` para `cobrancas`. É a idempotência da RN16, agora no lugar certo: o identificador é do pagamento, não do pedido.
- **Restrição `dinheiro_tem_operador`** — cobrança em dinheiro só chega a `aprovada` com `operador_id` preenchido. A RN7 vira erro de restrição, não convenção.
- **Restrição `aprovada_tem_rastro`** — cobrança de instrumento com gateway só chega a `aprovada` com `mp_payment_id`. Cobrança aprovada sem prova é o mesmo buraco que a `pedidos_pago_tem_pagamento` fechava, deslocado.
- **`pedidos.momento_pagamento`** (`antecipado` | `no_ato` | `na_entrega` | `a_combinar`), default `antecipado`. Nasce agora só para o NAPO-026 não precisar de backfill — mesmo padrão já usado com `atividade_fiscal`.
- **Drop de `pedidos.mp_preference_id`, `mp_payment_id`, `forma_pagamento`, `pago_em`** e da restrição `pedidos_pago_tem_pagamento`. Todos migram para a cobrança. Deixar as colunas "por segurança" seria manter dois lugares onde a verdade pode divergir — o problema que a spec existe para resolver.
- **Novo enum de `pedidos.status`** — `novo`, `em_producao`, `pronto`, `em_rota`, `entregue`, `cancelado`, `expirado`. Saem `aguardando_pagamento`, `pago` e `estornado`: viraram derivação (RN2/RN3). Postgres não remove valor de enum, então o tipo é recriado e a coluna convertida com mapa explícito (`aguardando_pagamento`→`novo`, `pago`→`novo`, `estornado`→`cancelado`).

### 2.2 Como a situação de pagamento é derivada (RN2)

Função estável `public.situacao_pagamento(pedido_id)` + view `public.pedidos_com_pagamento`, que é o que a aplicação lê:

| Estado das cobranças do pedido | Situação |
|---|---|
| alguma estornada | `estornado` |
| soma das aprovadas ≥ total | `pago` |
| soma das aprovadas > 0 e < total | `parcial` |
| alguma pendente não vencida | `aguardando` |
| nenhuma cobrança, ou todas recusadas/expiradas | `sem_pagamento` |

`parcial` existe desde já porque sinal e saldo de evento são duas cobranças do mesmo pedido — não custa nada agora e evitaria uma migration no R2.

**A view nasce com `security_invoker = on` e sem privilégio para `anon` e `authenticated`.** View no schema `public` é exposta pelo PostgREST automaticamente, e view comum roda com os direitos de quem a criou — ou seja, **ignoraria a RLS de `pedidos`** e devolveria pedido de qualquer pessoa a quem chamasse a API REST com uma sessão válida. Com `security_invoker` (Postgres 15+, e o projeto está em 15.6) a RLS das tabelas de baixo passa a valer para quem chama; o `revoke` é a segunda camada, no mesmo padrão adotado no NAPO-005 — privilégio revogado, não apenas política ausente, para que uma política acrescentada por descuido amanhã não reabra o caminho. A aplicação lê pelo cliente de servidor (`service_role`), que ignora RLS por construção, então não perde nada.

**Alternativas de modelagem descartadas:**

- **A — Coluna `situacao_pagamento` mantida por trigger.** Leitura barata, sem view. · **Descartada porque:** é o campo que alguém esquece de atualizar, com um trigger no lugar do alguém. O desenho da espinha nomeia esse erro (§3); trocar o esquecimento humano pelo esquecimento de um trigger não muda o resultado — muda quem é culpado.
- **B — Derivar em `packages/core` e não no banco.** Regra pura, testável rápido. · **Descartada porque:** as consultas de operação (listagem do admin, varredura da RN19, conciliação do NAPO-028) precisam filtrar por situação em SQL. Derivar nos dois lugares é a mesma regra escrita duas vezes, livre para divergir — e é regra de dinheiro. O que vai para `packages/core` é só o que **não** é consultável: a tradução do motivo de recusa (RN13).
- **C — Uma tabela de eventos e nenhuma entidade de cobrança.** `pagamento_eventos` já existe; bastaria projetar. · **Descartada porque:** evento é o que o gateway disse; cobrança é o que **nós** decidimos cobrar. Cobrança em dinheiro não tem evento nenhum, e cobrança criada e nunca respondida também não — as duas sumiriam.

### 2.3 Índices

- `cobrancas (pedido_id, situacao)` — a agregação da view. Sem ele, cada leitura de pedido varre a tabela.
- `cobrancas (mp_payment_id) unique where not null` — idempotência (RN16) e caminho do webhook.
- `cobrancas (pedido_id) unique where situacao = 'pendente'` — RN10.
- `cobrancas (situacao, expira_em) where situacao = 'pendente'` — varredura de vencimento.
- **`pedidos_dia_status` é preservado**, mas seu significado simplifica: ver §2.5.

### 2.4 Migration

- **Estratégia: expand → contract, em duas migrations.** `0016` cria a casa nova e move o dado; `0017` derruba a antiga. Rodar tudo numa migration só significa que uma falha no meio deixa a tabela sem ter para onde voltar.
- **Backfill:** `0016` gera uma cobrança `online` por pedido que hoje tem `mp_payment_id`, com situação derivada do `status` atual. Não há produção (o NAPO-021 é o último item do R1), mas as máquinas de desenvolvimento têm pedidos de teste — sem o backfill, quem der `git pull` é obrigado a `db:reset`.
- **Rollback:** destrutiva e sem volta na `0017`. Recuperação em desenvolvimento é `db:reset` + seed. Em staging e produção não se aplica porque ainda não existem.

### 2.5 O efeito colateral bom: `vagas_ocupadas` simplifica

Hoje a função soma reserva viva **e** pedido ativo, e "ativo" é uma lista de status que mistura pagamento com entrega. Com a RN4, ativo passa a ser **pedido não encerrado** — qualquer status exceto `cancelado` e `expirado`. A função deixa de saber o que é pagamento.

Isso não é elegância: é o que torna o NAPO-026 possível. Um pedido de balcão a ser pago na entrega precisa ocupar vaga de forno sem ter pago nada, e na modelagem de hoje esse pedido não tem status que o expresse.

**Risco assumido e coberto por pgTAP antes de qualquer código de aplicação:** é a função que a vitrine lê. Errar aqui quebra o site inteiro, não só o checkout.

---

## 3. Decisões de Contrato

### 3.1 Endpoints sem decisão nova

- `GET /api/pedidos/[numero]` — passa a ler `pedidos_com_pagamento`; resposta ganha `situacaoPagamento`. Padrão da arch.
- `POST /api/pedidos/[numero]/cancelar` — inalterado no contrato; a devolução de capacidade agora depende só do eixo de entrega.

### 3.2 Endpoints com decisão

#### `POST /api/pedidos` (modificado)

- **Decisão:** termina na reserva. Devolve `{ pedidoId, numero, totalCentavos, expiraEm }` e **não toca o gateway**.
- **Motivo:** a ordem do NAPO-006 (revalida → reserva → grava → cobra) foi deliberada, e o Brick não muda o porquê: vaga vendida duas vezes continua pior que cobrança não criada. O que muda é que o passo "cobra" saiu desta requisição e virou a próxima tela.
- **Consequência:** o caminho `gateway_indisponivel` **sai daqui** — não há mais gateway nesta requisição. Ele reaparece no `POST /api/pagamentos`, e a liberação da reserva ali é diferente: o pedido já existe e o cliente ainda está nele, então a vaga **não** é devolvida na hora (ver abaixo).

#### `POST /api/pagamentos` (novo)

- **Decisão:** recebe o que o `onSubmit` do Brick entrega (token, método, parcelas, e-mail do pagador), abre a cobrança e chama o gateway.
- **Idempotência:** dupla. O índice parcial garante uma cobrança pendente por pedido (RN10); o `id` dessa cobrança vai como `X-Idempotency-Key` na `POST /v1/payments`, então mesmo um retry nosso depois da linha existir não duplica no Mercado Pago.
- **Auth:** sessão + dono do pedido. Pedido de outra pessoa responde igual a pedido inexistente.
- **Erros:** `409` pedido já pago ou vencido · `422` recusa (com a **família** do motivo, nunca o texto do gateway — RN13) · `503` gateway fora do ar, cobrança marcada `expirada` e o cliente pode tentar de novo enquanto a reserva viver.
- **Alternativa rejeitada:** deixar o Brick criar o pagamento sozinho pelo `preferenceId`. Rejeitada porque volta a exigir preferência — isto é, manter o Checkout Pro vivo em paralelo, exatamente o que o ADR-0001 descartou.

#### `POST /api/webhook/mp` (modificado)

- **Decisão:** `external_reference` passa a ser o **id da cobrança**, não o do pedido. O pedido vem da cobrança.
- **Motivo:** a notificação diz qual *tentativa* foi paga. Com a referência apontando para o pedido, duas tentativas do mesmo pedido chegariam indistinguíveis — e é justamente o cenário que a entidade existe para representar.
- **O que não muda:** verificação de assinatura antes de tocar o banco, consulta ativa ao gateway, conferência de valor em centavos, idempotência por restrição do banco e a resposta 5xx deliberada em erro nosso.
- **Fora de escopo aqui:** o tópico `point_integration_wh` (NAPO-027). Esta rota continua atendendo só `payment`.

---

## 4. Decisões de UI

### 4.1 Auditoria de Reuso

| Elemento | Decisão | Componente alvo | Justificativa |
|---|---|---|---|
| Ficha da entrega / resumo | ♻️ REUSAR | `<ResumoPedido>` | Contrato visual aprovado no Gate Visual A do NAPO-006; muda só microcopy e rótulo do botão |
| Seletor de endereço | ♻️ REUSAR | `<SeletorEndereco>` | Inalterado |
| Cards de aviso e bloqueio | ♻️ REUSAR | `<Card>` + `<TriangleAlert>` | Padrão já estabelecido no checkout |
| Botão primário | ♻️ REUSAR | `<Button>` | — |
| Selo de forma de pagamento | ♻️ REUSAR | `<Badge>` | O passo 2 hoje usa `<span>` com classes soltas; passa a usar o primitivo que já existe |
| Cronômetro da reserva | ✨ CRIAR NOVO | `<ContagemRegressiva>` em `packages/ui/src/components/` | Sem análogo no catálogo. Existe porque a janela de 30 minutos deixa de ser uma frase ("fica reservada por 30 minutos") e passa a ser um fato visível enquanto o cliente digita o cartão — é o que dá sentido a não reiniciar o relógio (RN12) |
| Contêiner do Payment Brick | ✨ CRIAR NOVO | `<BrickPagamento>` em `features/pedidos/components/` | É montagem de componente de terceiro com ciclo de vida próprio (`initialization`, `onSubmit`, `onError`) e não pode virar primitivo genérico do catálogo: é específico do domínio de pagamento |

**Sem componente novo além desses dois.** O Brick traz a própria interface de cartão, parcelamento e Pix — a auditoria de reuso do que está *dentro* dele não nos pertence, e é exatamente o trade-off que o ADR-0001 aceitou.

### 4.2 Composição

```
/checkout  (modificado — o pagamento sai daqui)
┌──────────────────────────────────────────┬─────────────────┐
│ Finalizar pedido                         │  ┌───────────┐  │
│                                          │  │ ENTREGA   │  │
│ ① Onde entregamos                        │  │ sexta 12/09│  │
│   [ SeletorEndereco ]                    │  ├───────────┤  │
│                                          │  │ 3 pizzas  │  │
│ ② Como você paga                         │  │ frete     │  │
│   [Pix] [crédito] [débito]               │  │ TOTAL     │  │
│   "Você paga na próxima tela, aqui no    │  │[ Reservar │  │
│    site. Nada de página de terceiro."    │  │  e pagar ]│  │
│                                          │  └───────────┘  │
└──────────────────────────────────────────┴─────────────────┘
                          ↓ reserva a vaga
/pedido/[numero]/pagar  (novo — onde o Brick vive)
┌──────────────────────────────────────────┬─────────────────┐
│ Pedido #1042        ⏱ 28:14 restantes    │  ┌───────────┐  │
│                                          │  │ ENTREGA   │  │
│ ┌──── Payment Brick (Mercado Pago) ────┐ │  │ ...       │  │
│ │  ○ Pix    ○ Cartão de crédito        │ │  │ TOTAL     │  │
│ │  [ campos isolados do MP ]           │ │  └───────────┘  │
│ │  [ Pagar R$ 139,70 ]                 │ │                 │
│ └──────────────────────────────────────┘ │  "Seus dados de │
│ ⚠ recusa: mensagem nossa + tentar outro  │   cartão não    │
│                                          │   passam por    │
│                                          │   nós."         │
└──────────────────────────────────────────┴─────────────────┘
                          ↓ webhook confirma
/pedido/[numero]  (modificado — lê situação derivada)
```

### 4.3 Estados visuais

| Região | default | loading | error | success |
|---|---|---|---|---|
| Passo 2 do checkout | selos Pix/crédito/débito + frase de que o pagamento é aqui no site | — | — | — |
| Botão do resumo | "Reservar e pagar R$ X" | "Reservando sua entrega…" + desabilitado | toast com a nossa mensagem; carrinho intacto | navega para `/pedido/[n]/pagar` |
| Brick de pagamento | formulário do Mercado Pago com tema escuro | esqueleto do tamanho do Brick até o SDK montar | card nosso: "Não conseguimos abrir o pagamento agora. Sua entrega está reservada até [hora]." + botão de tentar de novo | navega para `/pedido/[n]` |
| Recusa de cartão | — | — | card **permanente** (não toast) com a família do motivo + "tentar outro cartão" reabrindo o Brick limpo | — |
| Cronômetro | `⏱ 28:14 restantes` | — | aos 00:00 o Brick é desmontado e o card diz que a entrega deixou de estar reservada, com link para o carrinho | — |
| Tela do pedido | situação derivada (aguardando / pago / estornado) | consulta com espaçamento crescente, como hoje | mantém o comportamento da RN19 | "Pedido confirmado" |

**Microcopy literal das recusas (RN13):**

| Família | Texto |
|---|---|
| `saldo` | "O cartão não tinha limite suficiente para este valor. Tente outro cartão ou pague com Pix." |
| `dados` | "Confira o número, a validade e o código de segurança do cartão." |
| `emissor` | "O banco recusou a compra. Costuma resolver ligando para ele — ou você pode pagar com Pix agora." |
| `duplicado` | "Esse pagamento já foi feito. Confira a tela do seu pedido antes de tentar de novo." |
| `outro` | "Não foi possível concluir com este cartão. Tente outro ou pague com Pix." |

Nenhuma delas repete texto, código ou `status_detail` do Mercado Pago.

### 4.4 Preview Visual Aprovado

#### 4.4.1 Arquivo

- Caminho: [`./preview.html`](./preview.html)
- **Modelo:** Único (Modelo A) — três telas da mesma jornada compartilhando a shell de `(loja)`, com navegação interna por âncora
- **Mecanismo:** HTML standalone + Tailwind v4 via CDN + `@theme` espelhando `packages/ui/src/tokens.css` (linha 1 da matriz: React/Next + Tailwind)
- **Aprovado por:** Hudson em 2026-09-05

#### 4.4.2 Componentes do catálogo usados

| Elemento da tela | Componente | Origem | Decisão |
|---|---|---|---|
| Cabeçalho e rodapé | `<CabecalhoSite>` · `<RodapeSite>` | `packages/ui/src/patterns/` | ♻️ REUSAR |
| Logotipo | `<Marca>` | `packages/ui/src/components/` | ♻️ REUSAR |
| Ficha da entrega / resumo | `<ResumoPedido>` | `features/pedidos/components/` | ♻️ REUSAR (microcopy e rótulo do botão mudam) |
| Lista de endereços | `<SeletorEndereco>` | `features/pedidos/components/` | ♻️ REUSAR |
| Selos de forma de pagamento | `<Badge>` | `packages/ui/src/components/` | ♻️ REUSAR — hoje são `<span>` com classes soltas |
| Cards de aviso, recusa e vencimento | `<Card>` | `packages/ui/src/components/` | ♻️ REUSAR |
| Botões | `<Button>` | `packages/ui/src/components/` | ♻️ REUSAR |
| Selo de situação na tela do pedido | `<Badge>` | `packages/ui/src/components/` | ♻️ REUSAR — alimentado pela situação derivada |

#### 4.4.3 Componentes novos a criar

| Componente novo | Caminho destino | Por que existentes não servem |
|---|---|---|
| `<ContagemRegressiva>` | `packages/ui/src/components/` | Cronômetro decrescente com formatação `mm:ss` tabular e evento de término. Nenhum primitivo do catálogo tem noção de tempo; `<Badge>` mostraria o número mas não o faria correr nem avisaria a página quando zerar — e é o zerar que desmonta o Brick |
| `<BrickPagamento>` | `features/pedidos/components/` | Montagem de componente de terceiro com ciclo de vida próprio (`initialization`, `onSubmit`, `onError`, desmontagem no vencimento). É específico do domínio de pagamento e não pode virar primitivo genérico do catálogo |

#### 4.4.4 Markup cru aceito

- Container raiz das páginas (`<main className="mx-auto max-w-6xl px-4 py-10">`) — layout de página.
- Grid de duas colunas do checkout e da tela de pagar (`lg:grid-cols-[1fr_340px]`) — layout puro.
- Espaçamento entre as seções numeradas do checkout — spacing entre primitivos.
- Cabeçalho da tela de pagar (título + cronômetro em `flex justify-between`) — composição de dois elementos do catálogo, sem lógica visual própria.
- Faixa de cabeçalho dentro do `<Card>` do Brick (`border-b` + título + selo de conexão segura) — o catálogo não tem `CardHeader`, e criar o primitivo para uma única ocorrência infla o catálogo em vez de reusá-lo. Reavaliar quando surgir a segunda.
- Esqueleto de carregamento do Brick (`h-64 animate-pulse`) — placeholder de altura, não conteúdo.

#### 4.4.5 Critérios visuais de aceite

Ver a seção **"Critérios visuais de aceite"** de [`tests.md`](./tests.md) — verificados no Gate Visual B do `/implementar`.

### 4.5 Decisões de UX não-óbvias

- **Página dedicada para pagar, não passo revelado no próprio checkout.** A janela é de 30 minutos e o cliente recarrega, volta, abre em outra aba. Uma rota endereçável (`/pedido/[numero]/pagar`) sobrevive a tudo isso e mostra o mesmo estado; um passo revelado por `useState` no checkout perderia o pedido a cada F5 e convidaria à criação de um segundo pedido — segunda vaga consumida pela mesma pessoa. **Alternativa rejeitada:** revelar o passo 3 na mesma tela; mais fluido em tela, frágil em uso real. Bônus não perseguido, mas registrado: é a superfície que o instrumento `link` do NAPO-026 reaproveita.
- **O cronômetro entra agora.** Hoje a frase "sua vaga na fornada fica reservada por 30 minutos" aparece no resumo e some da memória. Enquanto o cliente digita o cartão, o tempo restante é a informação que justifica a pressa e explica a recusa por vencimento sem precisar de suporte.
- **Recusa é card permanente, nunca toast.** Mesmo critério aprovado no NAPO-006 para bloqueios que exigem ação: toast some sozinho, e quem não viu tenta de novo achando que travou.
- **O Brick não é oferecido quando o provider é `fake`.** `ARCHITECTURE.md` §2.2.3 é explícito: caminho que depende de configuração externa só aparece quando a configuração existe naquele ambiente. Com `PAGAMENTO_PROVIDER=fake` a tela mostra um painel nosso de simulação — é o que mantém o fluxo inteiro fechado sem túnel e sem credencial.

### 4.6 Responsividade

| Breakpoint | Decisão |
|---|---|
| < 768px | O Brick ocupa a largura inteira e o resumo colapsa para o topo, em vez da barra fixa do rodapé: com o Brick em tela, a barra fixa disputaria espaço com o teclado do celular sobre um campo de cartão |

---

## 5. Decisões Técnicas Gerais

- **Decisão:** a cobrança nasce no nosso banco **antes** de o gateway ser chamado.
  **Alternativa rejeitada:** chamar o gateway e gravar a cobrança com a resposta.
  **Motivo:** é o que dá uma chave estável para a `X-Idempotency-Key` e o que faz a cobrança existir mesmo quando a resposta se perde no meio do caminho. Cobrança sem resposta é um fato que precisa ser investigável, não um registro que nunca chegou a existir.

- **Decisão:** `packages/core` recebe só a tradução do motivo de recusa.
  **Alternativa rejeitada:** mover a derivação da situação de pagamento para o núcleo puro.
  **Motivo:** a derivação precisa ser consultável em SQL (§2.2 alternativa B). O núcleo fica com o que é decisão e não é consulta.

- **Decisão:** o adaptador falso continua sendo o caminho padrão de desenvolvimento.
  **Alternativa rejeitada:** exigir credencial real para rodar o checkout local.
  **Motivo:** foi o que permitiu o NAPO-006 fechar sem túnel, e continua sendo o que permite alguém clonar o repositório e ver o fluxo funcionar. A RN20 exige o gateway real **uma vez, na validação**, não a cada `pnpm dev`.

- **Decisão:** cartão vai ao gateway com `binary_mode`, Pix não.
  **Alternativa rejeitada:** aceitar o comportamento padrão, com pagamento "em análise".
  **Motivo:** a vaga fica reservada 30 minutos, e uma análise que resolve em horas não
  cabe nessa janela — o cliente ficaria sem resposta na tela e a vaga presa. Com a flag
  ele leva um não imediato e ainda dá tempo de tentar outro cartão ou Pix dentro do prazo,
  que é exatamente o que a RN12 permite. Custo aceito: perde-se a venda que a análise
  aprovaria depois. Decisão do PM em 2026-09-06, a partir do que apareceu ao exercitar o
  gateway real — sem a flag, **todo** cartão daquela conta parou em `pending_contingency` e
  continuava lá 2h30 depois. Pix fica de fora: pendente é a natureza do meio.

- **Decisão:** a reserva **não** é devolvida quando o gateway falha na `POST /api/pagamentos`.
  **Alternativa rejeitada:** repetir o comportamento do NAPO-006, que libera a vaga na hora.
  **Motivo:** lá o cliente ainda não tinha pedido e ia embora; aqui ele está na tela, com o cartão na mão, e vai tentar de novo em segundos. Derrubar a vaga dele por uma falha nossa seria punir o cliente pelo erro do terceiro. A vaga volta pelo vencimento normal, se ele desistir.

---

## 6. Dependências Novas

### 6.1 Bibliotecas

- `@mercadopago/sdk-react@^1` — monta o Payment Brick. Alternativa avaliada: carregar o `sdk-js` por `<script>` e montar à mão. Descartada porque o wrapper React já resolve montagem, desmontagem e StrictMode — e ciclo de vida de componente foi exatamente a categoria de defeito que o Gate Visual B do NAPO-005 pegou.

### 6.2 Variáveis de ambiente

- `NEXT_PUBLIC_MP_PUBLIC_KEY` — chave pública do Mercado Pago, exposta ao navegador por construção. Obrigatória quando `PAGAMENTO_PROVIDER=mercado_pago`, ignorada quando `fake`. Vai para `.env.example`.

### 6.3 Integrações externas

- `POST /v1/payments` do Mercado Pago — autenticação por `MP_ACCESS_TOKEN`, `X-Idempotency-Key` obrigatória. Falha → `503` nosso, cobrança `expirada`, reserva mantida (§5).
- Webhook `payment` — assinatura HMAC do manifesto, já implementada. O tópico do Point fica para o NAPO-027.

---

## 7. Plano de Blocos

**Spec GRANDE** — o `plan.md` é criado no `/implementar` (Etapa 3.5). Sequência sugerida, do banco para a tela:

```
A (schema 0016 + pgTAP da derivação)
      ↓
B (schema 0017 + vagas_ocupadas + pgTAP)     ← o bloco de maior risco
      ↓
C (porta + adaptador MP + RN14 + fake)  ──┐
      ↓                                    │ paralelizáveis: Mapas disjuntos
D (repos + criar-cobranca + confirmar) ────┘
      ↓
E (rotas de API)
      ↓
F (UI: checkout, página de pagar, Brick, cronômetro)  → Gate Visual B
      ↓
G (RN20: os seis caminhos contra o Mercado Pago real, pelo túnel)
```

---

## 8. Riscos Conhecidos

- **Risco:** `vagas_ocupadas` reescrita quebra a vitrine inteira, não só o checkout.
  **Mitigação:** pgTAP cobrindo a função antes de qualquer código de aplicação, como foi feito no NAPO-006.
  **Gatilho de revisão:** qualquer divergência entre disponibilidade exibida e vagas reais em desenvolvimento.

- **Risco:** cobrança `pendente` órfã (gateway não respondeu) bloqueia a nova tentativa pelo índice único.
  **Mitigação:** o `503` marca a cobrança como `expirada` no mesmo caminho de erro; a varredura da RN19 resolve o que escapar disso consultando o gateway.
  **Gatilho de revisão:** aparecer cobrança pendente vencida com pedido ainda vivo.

- **Risco:** o Brick não fica na identidade Napo mesmo customizado.
  **Mitigação:** customização por tokens no Gate Visual A, antes de qualquer código.
  **Gatilho de revisão:** reprovação no Gate Visual A → reabrir a alternativa C do ADR-0001 (Checkout Transparente), com o custo já documentado lá.

- **Risco:** conversão do checkout cai por perder o cartão salvo do Mercado Pago.
  **Mitigação:** nenhuma nesta spec — é o trade-off aceito no ADR-0001.
  **Gatilho de revisão:** queda perceptível no primeiro mês com Bricks em produção → avaliar o Wallet Brick (💡 no ROADMAP, depende do NAPO-009).

- **Risco:** o serviço de cobrança nasce dentro de `features/pedidos`, e o NAPO-026 vai precisar dele a partir do admin — feature não importa de feature (`ARCHITECTURE.md` §3.2).
  **Mitigação:** nenhuma agora, de propósito (`AGENTS.md` §2.2 — não antecipar trabalho). A costura é conhecida: a composição sobe para a camada `app`, que pode importar as duas.
  **Gatilho de revisão:** o `/especificar` do NAPO-026.
