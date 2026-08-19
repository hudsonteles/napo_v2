# 🏗️ Design: Carrinho e checkout com Mercado Pago

**Spec relacionado:** [`spec.md`](./spec.md)
**Testes relacionados:** [`tests.md`](./tests.md)

> 📌 Este documento define o **COMO** — focado em **DECISÕES**, não em restatement.
> Dono primário: **Agente / Tech Lead**.

---

## 1. Mapa de Impacto

> ⚠️ **Este mapa tem 32 linhas** — bem acima das 15 que o template usa como sinal de alerta. Não é sinal de spec mal cortada: carrinho sem checkout não entrega valor e separá-los duplicaria o contrato de snapshot (spec §7). A consequência prática é que o `/implementar` **obrigatoriamente cria `plan.md`** com ~8 blocos, e não usa o plano inline da §7 deste documento.

### Núcleo puro

| Arquivo / Módulo | Ação | Risco | Justificativa |
|---|---|---|---|
| `packages/core/src/carrinho/carrinho.ts` | Criar | Médio | Normalização de itens, teto por disponibilidade, subtotal e total. É a regra que o servidor usa para desautorizar o valor do cliente (RN3) |
| `packages/core/src/carrinho/dia.ts` | Criar | Médio | Resolve o dia único do pedido pelo mais tardio entre os itens (RN2) |
| `packages/core/src/carrinho/tipos.ts` · `index.ts` | Criar | Baixo | Tipos e barrel da nova área |
| `packages/core/src/index.ts` | Modificar | Baixo | Exporta `carrinho` |
| `packages/core/src/disponibilidade/conflito.ts` | Reutilizar | — | `avaliarViabilidade` (RN11) e `devolucaoPorCancelamento` (RN14) — escritas em NAPO-004 e nunca chamadas; é aqui que passam a ser |
| `packages/core/src/frete/frete.ts` | Reutilizar | — | `calcularFrete` (RN18) |

### Banco

| Arquivo / Módulo | Ação | Risco | Justificativa |
|---|---|---|---|
| `supabase/migrations/0013_pedidos.sql` | Criar | Alto | Enums, `pedidos`, `pedido_itens`, `pagamento_eventos`, sequência do número, RLS por comando, `config_operacao.pagamento_minutos` |
| `supabase/migrations/0014_pedidos_funcoes.sql` | Criar | Alto | `reservar_carrinho`, `confirmar_pagamento`, `expirar_pedidos`, `cancelar_pedido` e `vagas_ocupadas` reescrita para contar pedido pago |

### Infra do app (`src/lib`)

| Arquivo / Módulo | Ação | Risco | Justificativa |
|---|---|---|---|
| `apps/web/src/lib/carrinho/provider.tsx` | Criar | Médio | Contexto do carrinho + persistência no navegador. Mora em `lib`, não em `features` — ver §5 decisão 1 |
| `apps/web/src/lib/carrinho/armazenamento.ts` | Criar | Baixo | Leitura/escrita versionada no `localStorage`, tolerante a lixo |
| `apps/web/src/lib/pagamentos/porta.ts` | Criar | Médio | Interface `PortaPagamento` — o gateway vira detalhe substituível (§5 decisão 6) |
| `apps/web/src/lib/pagamentos/mercado-pago.ts` | Criar | Alto | Adaptador real: cria preferência e consulta pagamento |
| `apps/web/src/lib/pagamentos/fake.ts` | Criar | Baixo | Adaptador de desenvolvimento — destrava o ambiente local sem túnel (§5 decisão 7) |
| `apps/web/src/lib/pagamentos/assinatura.ts` | Criar | Alto | Verificação HMAC da notificação. Superfície pública: erro aqui é pedido confirmado sem pagamento |
| `apps/web/src/lib/env.ts` | Modificar | Médio | `getPagamentoEnv()` em escopo próprio, no padrão do `getGoogleEnv()` |

### Feature de pedidos

| Arquivo / Módulo | Ação | Risco | Justificativa |
|---|---|---|---|
| `apps/web/src/features/pedidos/schema.ts` | Criar | Médio | Zod de entrada do checkout e do corpo da notificação |
| `apps/web/src/features/pedidos/services/pedidos-repo.ts` | Criar | Médio | Acesso ao banco, isolado das rotas |
| `apps/web/src/features/pedidos/services/criar-pedido.ts` | Criar | Alto | Orquestra revalidação → reserva → pedido → preferência, com compensação em cada falha |
| `apps/web/src/features/pedidos/services/confirmar-pagamento.ts` | Criar | Alto | Consulta o pagamento na fonte, confere valor, calcula veredito e chama a RPC |
| `apps/web/src/features/pedidos/components/*.tsx` | Criar | Médio | Lista do carrinho, resumo, seletor de endereço, estado do pagamento |
| `apps/web/src/features/pedidos/index.ts` | Criar | Baixo | Barrel |

### Rotas

| Arquivo / Módulo | Ação | Risco | Justificativa |
|---|---|---|---|
| `apps/web/app/(loja)/layout.tsx` | Criar | Baixo | Grupo de rota previsto na "Arquitetura de Código" e ainda inexistente |
| `apps/web/app/(loja)/carrinho/page.tsx` | Criar | Médio | Tela do carrinho |
| `apps/web/app/(loja)/checkout/page.tsx` | Criar | Alto | Endereço, dia, frete, total e ida para o pagamento |
| `apps/web/app/(loja)/pedido/[numero]/page.tsx` | Criar | Médio | Retorno do pagamento e consulta do pedido |
| `apps/web/app/api/carrinho/validar/route.ts` | Criar | Médio | Revalida preço e disponibilidade sem exigir sessão (carrinho é anônimo) |
| `apps/web/app/api/pedidos/route.ts` | Criar | Alto | `POST` cria pedido e cobrança |
| `apps/web/app/api/pedidos/[numero]/route.ts` | Criar | Médio | `GET` status — consumido pelo retorno (RN19) |
| `apps/web/app/api/pedidos/[numero]/cancelar/route.ts` | Criar | Alto | Cancelamento pelo cliente antes do cutoff (RN15) |
| `apps/web/app/api/webhook/mp/route.ts` | Criar | Alto | Única rota pública sem sessão do sistema (RN8, RN9, RN10) |
| `apps/web/app/api/manutencao/pedidos-parados/route.ts` | Criar | Médio | Varredura da RN19 + expiração da RN13 |
| `apps/web/app/api/disponibilidade/reserva/route.ts` | Modificar | Alto | Passa a chamar `reservar_carrinho` — evita duas implementações do mesmo lock (§5 decisão 3) |
| `apps/web/middleware.ts` | Modificar | Alto | `(loja)/checkout` e `(loja)/pedido` entram no matcher de sessão; `/carrinho` fica fora de propósito (RN1) |

### Superfícies existentes tocadas

| Arquivo / Módulo | Ação | Risco | Justificativa |
|---|---|---|---|
| `apps/web/src/features/catalogo/components/estado-disponibilidade.tsx` | Modificar | Médio | O botão "Adicionar" e o `SeletorQuantidade` nasceram desabilitados em NAPO-003 esperando esta spec |
| `apps/web/src/features/disponibilidade/services/snapshot.ts` | Modificar | Alto | `consumos` passa a somar pedido pago às reservas vivas (RN12). Sem isso o motor reoferece vaga vendida |
| `packages/ui/src/patterns/cabecalho-site.tsx` | Modificar | Médio | Acesso ao carrinho com contador. Primeira vez que o cabeçalho estático lê estado de cliente |
| `packages/ui/src/components/seletor-quantidade.tsx` | Reutilizar | — | Construído em NAPO-003 já declarando que o carrinho o reusaria |
| `apps/web/app/api/frete/route.ts` | Reutilizar | — | Contrato escrito em NAPO-005 para ser consumido aqui |

---

## 2. Decisões de Schema

### 2.1 Mudanças

- **`pedidos`** — campos conforme a spec do R1 §4, mais quatro que ela não previa: `expira_em` (RN13), `veredito` (RN11), `mp_preference_id` e `reserva_id`. `mp_payment_id` recebe **índice único parcial** — é a chave de idempotência da RN9 aplicada pelo banco, não pela aplicação: duas notificações simultâneas viram uma violação de constraint, não dois consumos de capacidade.
- **`pedido_itens`** — `custo_unitario_snapshot` nasce **nullable** e permanece nulo até o BOM do NAPO-008 existir. Nulo desde o nascimento é a única forma honesta de dizer "nunca soubemos este custo"; se a coluna só aparecesse no NAPO-008, o caminho tentador seria preencher pedidos antigos com o custo daquele momento — exatamente a mentira que a RN4 existe para impedir.
- **`pagamento_eventos`** — toda notificação recebida, verificada ou não, com corpo bruto e resultado. Dá endereço físico ao "registra e alerta" das RN10/RN19 antes de o admin do NAPO-008 existir, e é a única evidência disponível quando alguém perguntar por que um pedido não confirmou.
- **`status_pedido`** ganha dois valores além dos sete da spec do R1: `expirado` (RN13 — distinguir de `cancelado` importa, porque um é abandono e o outro é decisão) e `estornado` (RN14 — estorno e chargeback chegam por notificação e precisam de destino).
- **`config_operacao.pagamento_minutos`** (default 30) — o prazo que a RN7 iguala entre reserva e cobrança. Coluna própria em vez de reusar `reserva_minutos`: a reserva da vitrine e a reserva de quem está pagando têm motivos diferentes para durar o que duram, e amarrá-las faria mexer numa mexer na outra.
- **Número do pedido** — `bigint` de sequência dedicada, começando em 1000. Exibido como `#1042`.

### 2.2 Alternativas de modelagem descartadas

- **A — Idempotência só na aplicação (`select` antes do `insert`):** descartada porque duas notificações simultâneas passam as duas pelo `select` antes de qualquer `insert`. O índice único é a única garantia que não depende de temporização.
- **B — Número aleatório curto (tipo `NAP-7F3K`):** descartada porque exige tratamento de colisão e não ordena. O argumento a favor era não revelar volume de vendas — irrelevante num número que só o próprio cliente e a equipe veem, atrás de RLS.
- **C — Carrinho persistido em tabela:** descartada porque o carrinho é anônimo (RN1). Persistir exigiria identificar quem não se identificou — cookie próprio, linha órfã e um problema de LGPD criado do nada. Recuperação de carrinho abandonado é não-objetivo declarado.
- **D — `pedido_itens` referenciando preço por FK à faixa:** descartada porque é o oposto da RN4. Snapshot é cópia, não referência: FK aponta para um valor que muda.

### 2.3 Decisões de índice

- `pedidos (mp_payment_id) where mp_payment_id is not null` **único** — idempotência (RN9).
- `pedidos (profile_id, criado_em desc)` — listagem da conta (prepara o NAPO-007).
- `pedidos (dia_entrega, status)` — é a leitura do `vagas_ocupadas` reescrito; sem ele o motor faz varredura a cada consulta de disponibilidade, que é a rota mais quente do site.
- `pedidos (status, expira_em) where status = 'aguardando_pagamento'` — parcial, para a varredura da RN13/RN19 não ler pedido nenhum já resolvido.

### 2.4 Migration

- **Estratégia:** aditiva. Nenhum `drop`, nenhum backfill — não há pedido em nenhum ambiente.
- **`vagas_ocupadas` é substituída por `create or replace`**, mantendo assinatura. É o único ponto de risco real da migration: a função é lida pelo `reservar_capacidade` do NAPO-004, e errar aqui quebra o motor de disponibilidade inteiro, não só o checkout. Coberto por pgTAP antes de qualquer outra coisa.

---

## 3. Decisões de Contrato

### 3.1 Endpoints triviais

- `GET /api/pedidos/[numero]` — status do pedido do próprio cliente. Padrão da seção "Padrões de API e Dados" do `ARCHITECTURE.md`.
- `POST /api/carrinho/validar` — devolve preço e disponibilidade atuais dos ids enviados. **Sem sessão** (RN1).

### 3.2 Endpoints com decisão

#### `POST /api/pedidos`

- **Decisão:** um único endpoint faz revalidação, reserva, criação do pedido e criação da cobrança, e devolve a URL do Mercado Pago. **Motivo:** são quatro passos que só têm sentido juntos; expor cada um deixaria o cliente parar no meio com uma vaga reservada e nenhum pedido dono dela.
- **Ordem obrigatória e por quê:** revalida → **reserva** → grava pedido → cria preferência. A reserva vem antes da cobrança (RN7) e a preferência vem por último porque é o único passo irreversível fora do nosso banco.
- **Compensação:** falha ao criar a preferência libera a reserva e marca o pedido `expirado` na mesma requisição. Sem isso, indisponibilidade do Mercado Pago vira vaga presa por 30 minutos — o gargalo do negócio parado por erro de terceiro.
- **Não aceita:** valor, frete, total, distância ou dia de entrega. Só `itens[] {produtoId, quantidade}` e `enderecoId`. Todo o resto é derivado no servidor (RN3, RN18).
- **Auth:** sessão + telefone validado, via `exigirClienteValidado` (NAPO-005).
- **Erros:** `409` sem vaga (com o dia recalculado no corpo), `409` preço divergente (com a diferença), `422` endereço fora de área, `503` gateway indisponível.

#### `POST /api/webhook/mp`

- **Decisão:** rota pública que **não confia em nada do corpo recebido além do id**. Verifica a assinatura, busca o pagamento na API do Mercado Pago e usa **essa** resposta como fonte de valor e status (RN10).
- **Alternativa rejeitada:** processar `data.status` e `transaction_amount` do corpo. Rejeitada porque o corpo é atacável: uma notificação forjada com valor alto confirmaria pedido nunca pago. A assinatura sozinha não basta — protege a origem, não o conteúdo, e o segredo dela vaza como qualquer outro.
- **Idempotência:** sim, garantida pelo índice único (§2.3). Notificação repetida devolve `200` sem reprocessar.
- **Códigos:** `200` processado ou já conhecido · `401` assinatura inválida · `5xx` erro interno — **deliberadamente**, para o Mercado Pago reenviar. Devolver `200` num erro nosso transforma falha temporária em pedido pago que nunca confirma.
- **Ordem de resposta:** assinatura e deduplicação são baratas e vêm antes de qualquer I/O pesado; a confirmação roda dentro da requisição porque é uma chamada de RPC, não um job.

#### `POST /api/pedidos/[numero]/cancelar`

- **Decisão:** endpoint dedicado, não `PATCH` de status. **Motivo:** cancelar dispara devolução de capacidade ou lote (RN14) e é barrado pelo cutoff (RN15) — transição de estado com regra, não edição de campo. `PATCH {status}` genérico convidaria o cliente a tentar `{status:'pago'}`.
- **Auth:** dono do pedido. Equipe cancela pelo admin do NAPO-008; aqui só o cliente.

#### `POST /api/manutencao/pedidos-parados`

- **Decisão:** rota protegida por segredo em header, não por sessão — quem chama é agendador, não pessoa. Expira pedidos vencidos (RN13) e reconsulta os que passaram do prazo sem notificação (RN19).
- **Alternativa rejeitada:** `pg_cron`. Rejeitada pelo mesmo motivo do NAPO-004 (que resolveu expiração de reserva por filtro de leitura, sem job): manter o mecanismo de agendamento fora do banco enquanto não houver ambiente publicado. Enquanto o NAPO-021 não existe, a rota é chamada à mão; quando existir, vira Vercel Cron sem mudar código.
- **Idempotência:** sim — rodar duas vezes seguidas não muda nada além da primeira.

---

## 4. Decisões de UI

### 4.1 Auditoria de Reuso

| Elemento | Decisão | Componente alvo | Justificativa |
|---|---|---|---|
| Quantidade por item no carrinho | ♻️ **REUSAR** | `<SeletorQuantidade>` | Nasceu em NAPO-003 declarando no próprio JSDoc que o carrinho o reusaria; só perde o `disabled` |
| Botão "Adicionar", "Finalizar pedido", "Pagar" | ♻️ **REUSAR** | `<Button>` | Variantes e estado de loading já cobrem |
| Card de item, resumo, card de pedido | ♻️ **REUSAR** | `<Card>` | Contêiner padrão do projeto |
| Escolha do endereço no checkout | ♻️ **REUSAR** | `<CardEndereco>` (`features/enderecos`) | Já renderiza endereço com faixa de frete; a página compõe, sem import cruzado entre features (§5 decisão 1) |
| Selo de status do pedido | 🔧 **ESTENDER** | `<Badge>` + `tone` | O catálogo tem `<Badge>`, mas não tem a escala de tom que oito status exigem (aguardando/pago/em rota/cancelado) |
| Confirmação de cancelamento | ♻️ **REUSAR** | `<Dialog>` | `confirm()` nativo é proibido (`AGENTS.md` §7) |
| Aviso de mudança de preço ou item esgotado | 🔧 **ESTENDER** | `<Card>` + variante de aviso | É bloqueio de fluxo que exige reconfirmação, não notificação passageira: `<Toaster>` some sozinho e o cliente pagaria sem ter visto |
| Contador de itens no cabeçalho | ✨ **CRIAR NOVO** | `<AcessoCarrinho>` em `packages/ui/src/patterns/` | Sem análogo: ícone com contador, estado vazio e alvo de toque. Vive em `patterns` porque o cabeçalho é do catálogo |
| Estado atual do pedido | 🔧 **ESTENDER** | `<Badge tone>` | Cortado no Gate Visual A: a linha do tempo de quatro etapas foi descartada porque no R1 não existe admin que mova status — mostraria três etapas que nunca acontecem. Nasce no NAPO-008 |
| Passo a passo do checkout | ♻️ **REUSAR** | markup de layout | Duas etapas não justificam componente de stepper |

> Contagem: 6 reusar · 3 estender · 1 criar novo. Bem abaixo do limite de alerta de 50%.

### 4.2 Composição

```
/carrinho                                  /checkout
┌────────────────────────────────┐        ┌───────────────────┬────────────┐
│ CabecalhoSite      [🛒 3]      │        │ 1. Onde entregamos│ ╭────────╮ │
├────────────────────────────────┤        │ ┌───────────────┐ │ │FORNADA │ │
│ Seu carrinho                   │        │ │ ● SQN 210 C   │ │ │sex,    │ │
│ ┌────────────────────────────┐ │        │ │   3,2 km ·R$6 │ │ │22/08   │ │
│ │ [foto] Calabresa           │ │        │ │ ○ SHIS QI 15  │ │ ╰┈┈┈┈┈┈┈┈╯ │
│ │        [− 2 +]  R$ 79,80   │ │        │ │   fora da área│ │  3 pizzas  │
│ └────────────────────────────┘ │        │ └───────────────┘ │  R$ 129,70 │
│ ┌────────────────────────────┐ │        │ + Cadastrar novo  │  frete 6,00│
│ │ [foto] Peito de Peru…      │ │        │                   │  ────────  │
│ │        [− 1 +]  R$ 49,90   │ │        │ 2. Como você paga │  R$ 135,70 │
│ └────────────────────────────┘ │        │   [Pix] créd. déb.│            │
│                                │        │                   │ [ Pagar ]  │
│ ENTREGA sexta, 22 de agosto    │        │                   │  vaga por  │
│ primeira fornada com todos     │        │                   │  30 min    │
│ subtotal            R$ 129,70  │        │                   │            │
│ [ Finalizar pedido ]           │        │                   │            │
└────────────────────────────────┘        └───────────────────┴────────────┘
```

Duas decisões visíveis no esqueleto: o **frete não aparece no carrinho** (depende do endereço, escolhido só no checkout — "a calcular" é honesto, um valor que muda depois não é), e o **bloco da fornada é o topo do resumo**, não uma linha dele (direção A, §4.4.2).

### 4.3 Estados visuais

| Região | default | loading | empty | error | success |
|---|---|---|---|---|---|
| Lista do carrinho | itens com foto, preço e quantidade | skeleton de 2 linhas na revalidação | "Seu carrinho está vazio" + CTA "Ver sabores" | aviso de item indisponível dentro do próprio item | — |
| Item que esgotou | — | — | — | item esmaecido + "esgotado nesta fornada" + ação "remover" ou "trocar de fornada" | — |
| Item cujo preço mudou | — | — | — | preço antigo riscado ao lado do novo + "confirme para seguir" | — |
| Seletor de endereço | lista de endereços com distância e frete | skeleton de 2 cards | "Nenhum endereço" + CTA "Cadastrar" | banner + repetir | — |
| Endereço fora de área | card desabilitado + "ainda não entregamos aqui" | — | — | — | — |
| Botão de pagar | "Pagar R$ 200,70" | "Abrindo pagamento…" + desabilitado | — | toast + botão volta ao normal, carrinho intacto | redireciona ao Mercado Pago |
| Retorno do pagamento | status do pedido | "Confirmando pagamento…" com atualização automática | — | "Não conseguimos confirmar ainda" + WhatsApp | "Pedido #1042 confirmado" + dia de entrega |
| Contador do cabeçalho | ícone + número | — | ícone sem número | — | — |

**Microcopy literal:**
- Sem vaga no clique de pagar: *"Esta fornada encheu enquanto você decidia. A próxima com todos os seus sabores é [data]."*
- Retorno sem confirmação ainda: *"Confirmando seu pagamento. Pode fechar esta página — o pedido continua valendo."* — é o que impede a segunda cobrança por insegurança.
- Fora do prazo: *"O prazo de pagamento venceu e a vaga voltou para a fila. Seus itens continuam no carrinho."*
- Cancelamento depois do cutoff: *"Este pedido já entrou na produção de [data]. Fale com a gente no WhatsApp."*

### 4.4 Preview Visual Aprovado

#### 4.4.1 Arquivo de preview

- Caminho: [`./preview.html`](./preview.html)
- **Modelo:** Único (Modelo A) — três telas da mesma jornada linear compartilhando a shell do `<CabecalhoSite>`, navegáveis por âncora.
- **Mecanismo:** HTML standalone + Tailwind v4 via CDN + `@theme` espelhando `packages/ui/src/tokens.css` (Receita R1 da matriz — stack Next.js 15 + Tailwind + shadcn).
- **Aprovado por:** Hudson em 2026-08-19.

#### 4.4.2 Direção visual aprovada

**Direção A — "Ficha da fornada".** O dia de entrega é o título do resumo, num bloco com recorte de canhoto, e não uma linha entre subtotal e frete. A direção B (resumo convencional) foi apresentada lado a lado na §C do preview e **descartada**.

**Motivo:** o que o cliente compra não é "3 pizzas" — é uma vaga numa fornada de um dia específico. Essa é a leitura literal do gargalo declarado em `ARCHITECTURE.md` §1.1 (o forno, não o mercado), cria escassez verdadeira em vez de fabricada, e fixa o vocabulário "fornada" que o bot do WhatsApp (NAPO-015) vai herdar. A direção B apagaria a única coisa que separa comprar da Napo de comprar congelada de supermercado.

#### 4.4.3 Componentes do catálogo usados

| Elemento da tela | Componente | Origem | Decisão (§4.1) |
|---|---|---|---|
| Cabeçalho e logotipo | `<CabecalhoSite>` · `<Marca>` | patterns/components próprios | ♻️ REUSAR (cabeçalho modificado para receber `<AcessoCarrinho>`) |
| Item do carrinho, resumo, card de pedido, avisos | `<Card>` | shadcn em `packages/ui/src/components/` | ♻️ REUSAR |
| Quantidade por item | `<SeletorQuantidade>` | próprio | ♻️ REUSAR — perde apenas o `disabled` |
| Ações primárias e secundárias | `<Button>` (default · outline · ghost) | shadcn | ♻️ REUSAR |
| Escolha do endereço | `<CardEndereco>` | `features/enderecos` — **composto pela página**, sem import entre features | ♻️ REUSAR |
| Confirmação de cancelamento | `<Dialog>` | shadcn | ♻️ REUSAR |
| Selo "padrão" do endereço | `<Badge>` | shadcn | ♻️ REUSAR |
| Estado atual do pedido · aviso de bloqueio | `<Badge tone>` · `<Card>` variante aviso | shadcn estendido | 🔧 ESTENDER |

#### 4.4.4 Componentes novos a criar

| Componente novo | Caminho destino | Por que existentes não servem |
|---|---|---|
| `<AcessoCarrinho>` | `packages/ui/src/patterns/` | Ícone com contador sobreposto, estado vazio sem número e alvo de toque de 44 px. Nenhum primitivo do catálogo compõe isso, e o cabeçalho é do catálogo — não pode importar de uma feature do app |

#### 4.4.5 Markup cru aceito

- Container raiz de cada página (`max-w-6xl mx-auto px-4 py-10`) — layout de página.
- Grid de duas colunas do carrinho e do checkout (`grid lg:grid-cols-[1fr_340px] gap-8`) — layout puro.
- Espaçamento vertical entre cards (`space-y-3`) — spacing simples entre primitivos.
- Numeração das etapas do checkout (círculo com "1"/"2") — dois elementos, abaixo do limiar de componente.
- **Andaime do preview que não vai para o produto:** barra de navegação entre seções, rótulos `A ·`/`B ·`, a seção §C de comparação de direções, `.foto-placeholder` e `.serrilha` (esta última **vira** CSS de produto no bloco da fornada).

#### 4.4.6 Cortes decididos no gate

| Cortado | Motivo |
|---|---|
| `<LinhaStatusPedido>` (linha do tempo de 4 etapas) | No R1 não existe admin que mova status — mostraria três etapas que nunca acontecem. Nasce no NAPO-008, junto de quem move os status |
| Ação "Levar tudo para a próxima fornada" no carrinho | Remonta a disponibilidade de todos os itens de uma vez e pode falhar de novo; o seletor de fornada da vitrine (NAPO-003) já é o caminho para comprar em outro dia |

#### 4.4.7 Critérios visuais de aceite

Ver a seção **"Critérios visuais de aceite"** de [`tests.md`](./tests.md) — verificados no Gate Visual B do `/implementar`.

### 4.5 Decisões de UX não-óbvias

- **Carrinho é página, não gaveta.** Gaveta lateral é o padrão de e-commerce de catálogo grande, onde o cliente adiciona dezenas de itens sem perder a navegação. Aqui o carrinho tem 2 ou 3 itens e a decisão seguinte é o endereço — página ganha por ser linkável, compartilhável e por sobreviver ao redirecionamento do login.
- **O checkout não pede dado que já existe.** Sem campos de nome, telefone ou e-mail: o gate de telefone (NAPO-002) já validou tudo. Um checkout que repergunta o que a conta sabe é o atrito que a RN1 economizou sendo devolvido na etapa seguinte.
- **A mudança de preço bloqueia, o esgotamento também.** Nos dois casos o cliente reconfirma explicitamente. É atrito deliberado: seguir em silêncio cobra valor que a pessoa não viu.
- **O retorno do pagamento faz consulta com espaçamento crescente, não em intervalo fixo**, e para depois de um teto — a confirmação normal chega em segundos, e insistir para sempre é aquecer servidor à toa quando o pagamento simplesmente não foi feito.
- **A escolha do dia não é escolha.** O dia é derivado (RN2) e mostrado com o motivo. Oferecer o seletor de fornada no checkout reabriria no fim a decisão que a vitrine já tomou, com o agravante de mudar a disponibilidade de todos os itens ao mesmo tempo.

### 4.6 Responsividade

| Breakpoint | Decisão específica |
|---|---|
| Mobile <768px | O resumo do checkout sai da coluna direita e vira barra fixa no rodapé com total e botão. Total que precisa de rolagem para ser visto é total que não foi lido |

---

## 5. Decisões Técnicas Gerais

1. **Decisão:** o estado do carrinho mora em `src/lib/carrinho/`, não numa feature.
   **Alternativa rejeitada:** `src/features/carrinho/`.
   **Motivo:** o botão "Adicionar" vive dentro de `features/catalogo`, e a regra de dependência do `ARCHITECTURE.md` §3.2 proíbe feature importar de feature. Em `lib` o import é legal para todas elas. As **regras** do carrinho (dedupe, teto, totais) não vão para `lib` — vão para `packages/core`, onde são testáveis sem React.

2. **Decisão:** o veredito de viabilidade (RN11) é calculado em TypeScript e **passado pronto** para a função SQL de confirmação.
   **Alternativa rejeitada:** decidir viabilidade dentro do SQL.
   **Motivo:** é literalmente a regra que o `0005_reservar_capacidade.sql` documenta como gatilho de revisão — "acrescentar aqui qualquer `if` de negócio faz a regra passar a existir em dois lugares". A função SQL grava o veredito e garante atomicidade; quem decide é `packages/core`.

3. **Decisão:** `reservar_capacidade` é generalizada em `reservar_carrinho`, que trava o dia **uma vez** e reserva todos os itens ou nenhum; a rota do NAPO-004 passa a chamá-la com um item só.
   **Alternativa rejeitada:** três chamadas sequenciais de `reservar_capacidade` com desfazimento manual em caso de falha parcial.
   **Motivo:** reserva parcial cobra um carrinho que não pode ser entregue inteiro, e o desfazimento manual precisaria funcionar exatamente no cenário em que algo já falhou. Manter duas funções tomando o mesmo advisory lock por caminhos diferentes é o risco de regra duplicada que o próprio NAPO-004 registrou.

4. **Decisão:** `vagas_ocupadas` passa a somar reservas vivas **e** itens de pedidos ativos do dia; a confirmação marca a reserva como `consumida`.
   **Alternativa rejeitada:** manter a reserva viva indefinidamente após o pagamento.
   **Motivo:** reserva tem vencimento por construção (NAPO-004 não tem job de limpeza — a expiração é filtro de leitura). Vaga vendida não pode depender de um registro que expira sozinho.

5. **Decisão:** o total é recalculado do zero na criação da cobrança, mesmo tendo sido calculado na tela segundos antes.
   **Alternativa rejeitada:** confiar no total já validado na etapa anterior.
   **Motivo:** entre uma etapa e outra o preço pode mudar. Recalcular custa uma consulta e é o que garante que o valor da preferência do Mercado Pago e o valor do pedido são o mesmo número, saído do mesmo lugar.

6. **Decisão:** o gateway fica atrás de `PortaPagamento` (`criarCobranca`, `consultarPagamento`, `verificarAssinatura`).
   **Alternativa rejeitada:** chamar o SDK do Mercado Pago direto das rotas.
   **Motivo:** a decisão Mercado Pago × Stripe foi reaberta uma vez e pode ser reaberta de novo. Com a porta, trocar é escrever um adaptador; sem ela, é reescrever o checkout. Custo hoje: uma interface de três métodos.

7. **Decisão:** `PAGAMENTO_PROVIDER=fake|mercado_pago`, no mesmo padrão do `WHATSAPP_PROVIDER` do NAPO-002.
   **Alternativa rejeitada:** exigir túnel público para qualquer desenvolvimento.
   **Motivo:** o `ARCHITECTURE.md` §6.1 já registra que o webhook não funciona em `localhost`. Sem adaptador falso, **nenhum** teste do fluxo roda sem túnel — e a regra de ouro do §6.1 é que ambiente troca por variável, nunca por edição de código. O túnel continua obrigatório para o Gate Visual B, que exercita a integração real.

8. **Decisão:** o cabeçalho passa a ter uma ilha cliente (o contador do carrinho) sobre páginas estáticas.
   **Alternativa rejeitada:** tornar o cabeçalho dinâmico.
   **Motivo:** o SSG do `(site)` é decisão de custo declarada (`ARCHITECTURE.md` §4.5). O contador lê `localStorage`, que só existe no navegador — ilha cliente resolve sem tirar uma página do estático. É o mesmo padrão da disponibilidade ao vivo do NAPO-003.

---

## 6. Dependências Novas

### 6.1 Bibliotecas

- `mercadopago@^2` (SDK oficial Node) — usado apenas dentro de `lib/pagamentos/mercado-pago.ts`. Avaliada a alternativa de chamar a API REST com `fetch` e descartada por um motivo só: a verificação de assinatura e o formato do manifesto de notificação são detalhes que mudam do lado deles, e errar isso é confirmar pedido não pago.

### 6.2 Variáveis de ambiente

Todas em escopo próprio via `getPagamentoEnv()`, no padrão do `getGoogleEnv()` — o SSG do catálogo não pode passar a exigir credencial de pagamento para buildar.

- `PAGAMENTO_PROVIDER` — `fake` | `mercado_pago`. Default `fake`.
- `MP_ACCESS_TOKEN` — servidor. Obrigatória quando `PAGAMENTO_PROVIDER=mercado_pago`.
- `MP_WEBHOOK_SECRET` — segredo da assinatura da notificação.
- `MANUTENCAO_SECRET` — autoriza a rota de varredura.
- **Nenhuma com prefixo `NEXT_PUBLIC_`.** O Checkout Pro é redirecionamento; o navegador não precisa de chave nenhuma. Toda a integração é servidor.

### 6.3 Integrações externas

- **Mercado Pago Checkout Pro** — criação de preferência e consulta de pagamento (REST, `Bearer`). Notificação por webhook com reenvio em intervalos crescentes quando não recebe `2xx`. **Fallback quando falha:** na criação, libera a reserva e devolve `503`; na consulta pelo webhook, devolve `5xx` para forçar reenvio; na consulta pela tela de retorno, mostra "confirmando" e tenta de novo.

---

## 7. Plano de Blocos

Não se aplica — o Mapa de Impacto tem 32 linhas e o `/implementar` deve criar `plan.md` à parte, com retomada granular por bloco.

---

## 8. Riscos Conhecidos

- **Risco:** `vagas_ocupadas` reescrita quebra o motor de disponibilidade inteiro, não só o checkout — é a função mais compartilhada que esta spec toca.
  **Mitigação:** pgTAP cobrindo a função **antes** de qualquer código de checkout, incluindo os casos que hoje passam (só reservas) e os novos (reservas + pedidos).
  **Gatilho de revisão pós-deploy:** qualquer divergência entre o disponível exibido na vitrine e o aceito no checkout.

- **Risco:** o webhook é a primeira rota pública sem sessão. Falha na verificação de assinatura confirma pedido não pago.
  **Mitigação:** a assinatura nunca é a única defesa — o valor sempre vem de consulta à API do Mercado Pago e é conferido contra o total do pedido (RN10).
  **Gatilho de revisão:** qualquer `pagamento_evento` com assinatura inválida em produção.

- **Risco:** a reserva estendida para 30 minutos (RN7) prende capacidade de quem talvez não pague. Num dia de 30 pizzas, seis carrinhos abandonados simultâneos esgotam a fornada para quem ia pagar.
  **Mitigação:** `pagamento_minutos` é configurável sem deploy, e a varredura da RN13 devolve a vaga.
  **Gatilho de revisão:** primeira fornada que esgotar com mais pedidos expirados que pagos.

- **Risco:** o adaptador falso pode mascarar defeito que só aparece com o Mercado Pago real — foi exatamente o padrão do postmortem de 2026-08-18 (mapa em branco, atributo de DOM ignorado: categorias que teste com mock não alcança).
  **Mitigação:** o Gate Visual B exige o fluxo real com túnel e credenciais de teste, não o adaptador falso.
  **Gatilho de revisão:** este risco encerra quando o NAPO-021 der ambiente publicado com webhook estável.

- **Risco:** não há e-mail de confirmação (não-objetivo). Cliente que fecha a aba depois de pagar não tem nenhum registro fora do site.
  **Mitigação:** número do pedido visível no retorno e página consultável por link.
  **Gatilho de revisão:** primeiro contato de cliente perguntando se o pedido entrou. Sinaliza que o SMTP subiu de prioridade.
