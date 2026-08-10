# Napo — Registro de Decisões por Fase

> 📌 **Este NÃO é o backlog.** O backlog vivo é o [`ROADMAP.md`](../ROADMAP.md) na
> raiz. Este documento é o **registro das decisões de produto e arquitetura** que
> deram origem a ele — mantido para consulta, não para priorização.

> ⚠️ Documento reconstruído após perda do chat original. **[FECHADO]** = decisão
> real confirmada. **[A VALIDAR]** = estrutura funcional ainda não passada pelo
> método completo (opções → prós/contras → recomendação → trade-off → benchmark).

> 🔄 **REVISADO EM 2026-08-10.** Oito decisões deste documento foram substituídas.
> A verdade atual do R1 está em
> [`docs/superpowers/specs/2026-08-10-napo-r1-ecommerce-design.md`](superpowers/specs/2026-08-10-napo-r1-ecommerce-design.md).
> Itens revisados estão marcados **[REVISTO]** abaixo. Em conflito, a spec vence.
>
> **Diagnóstico econômico que motivou as revisões:** capacidade 650 pizzas/mês ·
> volume atual 303/mês (47%) · ponto de equilíbrio 207/mês · ociosidade vale
> R$ 7.700/mês de margem. **O gargalo do negócio é o forno, não o mercado** — por isso
> o canal de venda vem primeiro.

---

## Decisão estratégica transversal — Build vs. Buy [FECHADO]

**Regra do projeto:** construir o que é diferencial premium; comprar o que é
commodity regulada.

**CONSTRUIR (custom React + Supabase):** site premium, módulo de eventos
(preparação), estoque/insumos inteligente, custos+margem, PDV local, KDS,
painéis/agenda, WhatsApp marketing, OCR de notas de entrada, super admin.

**COMPRAR (não construir):**

- Ingestão de pedidos iFood/99food → **integrador/hub homologado existente**
  (decisão: **NÃO** virar integradora homologada — seria tiro no pé; homologação
  própria só compensa pra quem revende integração)
- Emissão fiscal de venda (NFC-e) → emissor fiscal de mercado
- Hardware: impressora cloud + telas de KDS

**CONECTAR:** hub de delivery → sistema Napo (feed de pedidos p/ KDS + baixa de
estoque); Mercado Pago (canal próprio) + Stone (plataformas).

---

## Fase 0 — Fundação [A VALIDAR]

- Stack: ~~React + Supabase~~ → **[REVISTO]** **pnpm workspaces + Next.js 15 App
  Router + Supabase**. Um app dividido por grupos de rota (site/loja/admin), com
  `packages/core` contendo as regras puras (cutoff, CTP/ATP, frete, BOM, margem) sem
  React e sem Supabase — é o que torna o motor testável. "React puro" foi rejeitado
  porque a Fase 1 depende de SEO e o checkout tem lógica que não pode rodar no browser.
- Banco: toda alteração via **migrations**
- **[REVISTO]** Autenticação: ~~Magic Link **ou** Google~~ → **os dois métodos, para
  cliente e equipe**, com `role` decidindo o destino. Acréscimos obrigatórios que
  faltavam no documento: **RLS negando por padrão em toda tabela** e **trigger
  impedindo auto-atribuição de `role`**. Middleware protege rota; RLS protege dado.
- **[NOVO]** **Validação de telefone por WhatsApp é gate obrigatório de plataforma**
  (não só um passo da Fase 3): navegação pública livre, tudo logado exige telefone
  validado. Telefone único entre contas validadas, com override de admin.
- Padrão visual: background preto, texto branco, destaque amarelo
- Responsividade total
- Referência de UX/movimento: sites Apple
- Padrão de listagem em toda tela de dados: cards + busca + combobox de filtro +
  combobox de ordenação, com persistência ao navegar entre card e lista
- **[FECHADO]** BOM de massa em dois níveis (sub-receita) — dependência do
  cálculo de insumos de eventos
- **[FECHADO]** Desenho Build-vs-Buy acima é premissa de arquitetura

_Pendente: estrutura de módulos, padrão de API, hospedagem, CI/CD._

---

## Fase 1 — Site Institucional/Vendas **[REVISTO — virou o R1]**

- Apresentação de produto estilo Apple (storytelling, movimento, CTAs)
- Comunicação de posicionamento premium/eventos
- Responsivo

**Revisão:** o site **tem e-commerce completo** (carrinho, checkout, Mercado Pago,
frete), não é vitrine institucional. Isso puxou para dentro do R1 o motor de
disponibilidade (Fase 2) e o frete (Fase 5). Escopo detalhado na spec.

**Posicionamento definido:** o concorrente é a pizza congelada de supermercado, e a
diferença é física — massa crua assada a 200°C em casa versus massa assada a 400°C em
forno italiano. Eixo: _"Longa fermentação. Forno italiano a 400°C. Em casa, só
aquecer."_

---

## Fase 2 — Sistema de Gestão Operacional [PARCIAL]

- Pedidos (próprios + delivery via hub)
- **[FECHADO]** Estoque/insumos inteligente:
  - Congelado vs. disponível
  - Cálculo de **quantas pizzas dá para produzir**
  - Alerta de **insumos em baixa**
  - **Validade/lote (FEFO)** — segurança alimentar + premium _(novo)_
  - Pizzas frescas (dias específicos, iFood/99food + retirada em loja)
- Custos de produção por pizza + margem de lucro
- **[FECHADO]** **KDS (tela de cozinha)** — coração da produção; fluxo principal
  da cozinha (papel só p/ via de expedição)
- **[FECHADO]** **PDV local** — venda/retirada de fresca; canal dentro do sistema
  unificado de pedidos (não app separado); PWA em tablet, **fila offline-first**
  (resolve também o "aguentar o rojão")
- OCR de notas de **entrada** (foto + IA) — fornecedor
- **[FECHADO]** **Emissão fiscal de venda (NFC-e)** via emissor de mercado —
  resolve o ponto de "impressão de notas para delivery" (é emissão fiscal de
  saída, comprar, não construir)

### Disponibilidade e capacidade de produção [FECHADO]

- **Estoque = saldo projetado no tempo**, não número único. Painel por dia:
  estoque inicial · já vendido (delivery+evento) · produção planejada ·
  **saldo projetado** · capacidade livre de produção
- **[FECHADO] Modelo por AGENDA DE DIAS DE ENTREGA (não janela contínua):**
  - **Agenda única** de dias de entrega — não varia por zona; todas as entregas
    saem no dia programado
  - Cada dia de entrega tem **cutoff configurável por dia** (ex.: sexta corta
    quinta 18h; sábado pode ter corte próprio)
  - **Antes do cutoff → CTP:** vende estoque + o que dá pra produzir até o dia,
    limitado pela capacidade daquele dia
  - **Depois do cutoff → só ATP:** vende apenas o que já está no freezer pra
    aquele dia (caso "pediu quinta pra sexta")
  - **Sabor esgotado pós-cutoff → oferece "produzir para o próximo dia de
    entrega COM vaga real"** (herda a capacidade do próximo dia; converte
    ruptura em venda, sem prometer dia também lotado)
  - **Cutoff = piso de fermentação vestido de calendário** — não é campo
    separado; o cutoff já é definido pelo tempo mínimo de fermentação
  - **Horizonte = 2 SEMANAS DESLIZANTES (corrente + próxima) [FECHADO]:**
    dentro delas aparecem os dias de entrega ainda não vencidos pelo cutoff.
    **Rolamento (Opção B):** quando o último dia de entrega da semana corrente
    passa do cutoff, a janela desliza (a "próxima" vira "corrente" e abre uma
    nova "próxima"). Usa os cutoffs já cadastrados — sem parâmetro novo; evita
    "semana morta" de vira-semana por calendário
- **[REVISTO] Teto de produção — no R1 são DOIS tetos simples, não o modelo por
  etapa-gargalo.** O modelo completo exigia números que não existem medidos; e o
  gargalo já foi identificado sem ele: **é o forno**. O R1 usa
  `teto_forno_dia = 30` (fluxo diário) + `capacidade_freezer = 150` (acúmulo). A
  tabela de etapas nasce no schema, vazia — o modelo completo liga depois sem
  migração. Descobertas que sustentam a revisão:
  - 30/dia × 5 dias de produção = 150/semana, e o freezer guarda 150: **os dois
    números coincidem, então o freezer limita o acúmulo**. Adicionar um dia de
    entrega aumenta a capacidade efetiva sem comprar freezer — ele gira em vez de
    empilhar.
  - **Massa vendida consome 1 vaga de forno, igual a uma pizza** (uma passagem cada),
    mas rende R$ 7,21 de margem contra R$ 20,82. Cada massa no lugar de uma pizza
    custa R$ 13,61. Por isso: sub-teto de massa por dia + remoção automática do
    catálogo do dia quando a ocupação passa do limite.
  - **R$ 13.533/mês de margem é o máximo matemático da cozinha atual.** O papel do
    sistema na segunda fase é dizer quando o segundo forno se paga.

- ~~cada etapa tem capacidade própria (massa/fermentação, montagem, forno,
  congelamento); o teto do dia = etapa mais restritiva (Theory of Constraints /
  finite capacity scheduling)~~ — adiado, não descartado
  - Reaproveita BOM de massa (Fase 0) e alerta de 48h (Fase 4)
  - Além de limitar venda, **diagnostica o gargalo** (sinal de onde investir)
  - **Pré-requisito de cadastro:** capacidade de cada etapa (ex.: unidades de
    massa/lote, pizzas/ciclo de forno, ciclos/dia, capacidade de freezer) +
    lead time de insumo. Sem esses números o CTP não roda
- **Risco tratado:** "próxima semana = ilimitado" é falso — o limite migra de
  estoque para capacidade/insumo/fermentação (falácia do planejamento)
- **[FECHADO] Prioridade em colisão evento × congelada (Opção D):** evento
  confirmado **reserva** insumo + capacidade por padrão (protege o core premium
  / receita contratada); o sistema **sinaliza a colisão** e permite **liberação
  manual** de parte da reserva quando há folga real, como decisão consciente e
  rastreável. Padrão de _allocated ATP_ (compromisso firme reserva, catálogo
  consome o não alocado, override manual do planejador). Depende da reserva de
  estoque (Fase 4/melhorias)

---

## Fase 3 — Integrações e Comunicação [PARCIAL]

- **[FECHADO]** iFood + 99food via **hub homologado (Opção A)**: hub recebe os
  pedidos; sistema Napo consome via API/webhook do hub → cai no KDS e baixa
  estoque (KDS e estoque unificados)
- **[FECHADO]** **Validação de telefone por OTP no WhatsApp** (mesmo canal do
  aviso de entrega): código com **expiração (5–10 min)** + **limite de
  tentativas (3–5)**, **rate limit por número**, **número validado persistido
  no cadastro** (só revalida se trocar). **Sem fallback SMS/ligação** e **sem
  reuso como login** (decisão do cliente)
  - _Obs.: sem fallback, o WhatsApp é ponto único de validação — se o envio
    falhar ou o cliente não tiver Zap, o cadastro trava. Aceito como risco._
  - **Via WhatsApp Business API oficial (Meta/BSP)** — não-oficial arrisca
    banimento do número
- Mensageria via WhatsApp
- **Comunicação em massa (congeladas + eventos) — LGPD + regras Meta:**
  - **Separar UTILIDADE (transacional: OTP, aviso de entrega) de MARKETING
    (promoção):** validar o número **não** autoriza propaganda; marketing exige
    **opt-in explícito e separado** (categoria/custo próprios na API)
  - **Consentimento LGPD versionado:** guardar quando e qual versão dos termos
    o cliente aceitou
- Pagamentos: Mercado Pago (cartão/débito/Pix) + Stone (plataformas)
- Painéis administrativos: vendas, eventos/agenda
- Módulo Super Admin: acessos, grupos, permissão por módulo

---

## Fase 4 — Módulo de Eventos (PREPARAÇÃO) [FECHADO]

> Escopo: o sistema **prepara** o evento; **não** o opera ao vivo. Cada evento é
> um **dossiê de preparação**.

### Dados do evento _(atualizado)_

- Data · Local · Quantidade de pessoas · **Equipe alocada** · **Valores**
  (custo do evento + valor cobrado + margem)

### Cálculo automático de insumos por evento

- Deriva qtd. de pizzas, unidades de massa e insumos via proporção configurável
  pessoa/pizza; integrado ao BOM de dois níveis (Fase 0)
- Alerta pré-evento configurável (padrão 48h) para disparar preparo de massa

### Checklist de equipamentos

- Separado dos insumos (transportado/devolvido, não consumido)
- Template padrão por tipo de evento, customizável por instância

### Sugestão inteligente de mix de sabores

- Registra produção real por evento (histórico); engine recomenda proporções
  futuras; substitui distribuição igualitária por calibração orientada a dados

### Lista de compras para eventos

- Com base na quantidade de pessoas — ligada ao cálculo automático de insumos

### Melhorias de preparação [FECHADO]

1. **Semáforo de prontidão** (verde/amarelo/vermelho por evento) — cruza insumo
   congelado suficiente, massa preparada dentro das 48h, equipe confirmada,
   equipamentos separados. Depende do estoque (Fase 2)
2. **Pipeline de status**: Orçamento→Confirmado→Em preparação→Pronto→Realizado→
   Pós-evento (controle das etapas de preparação, não operação ao vivo)
3. **Precificação assistida** (custo insumos+equipe+deslocamento + margem-alvo →
   valor sugerido). Depende de custos de equipe/deslocamento cadastrados
4. **Rentabilidade real vs. planejada** (pós-evento) — alimenta histórico junto
   com o mix de sabores. Depende de disciplina de lançamento pós-evento
5. **Ordem de serviço exportável** (PDF/BEO) — dossiê do evento p/ a equipe no dia

---

## Fase 5 — Frete e Logística de Entrega Própria **[REVISTO — fechado no R1]**

~~Proposta 3: `Frete = MAX(R$4,00 ; (km × 2 × R$1,60) ÷ qtd) × (1 − desconto_qtd)`~~

**A fórmula foi rejeitada por três defeitos:**

1. `km × 2` modela **viagem dedicada**, mas a operação é **rota consolidada** — todas
   as entregas saem no mesmo dia. Cobrar de cada cliente uma ida-e-volta inteira cobra
   ~6× o custo real.
2. Cobrava **R$ 38,40 de frete numa pizza a 12 km**. Não é margem perdida, é venda
   perdida.
3. O desconto por quantidade invertia o incentivo: com **comissão por pizza**, o custo
   cresce com a _quantidade_, não com a distância — e a fórmula dava 30% de desconto
   justamente a quem pedia 5+.

**Decidido:** faixas fixas de distância (0–4 km R$6 · 4–8 km R$10 · 8–12 km R$14) com
**frete grátis acima de R$ 150**. Raio de 12 km configurável, mais lista de exceções de
CEP. Distância **rodoviária** (Brasília tem o lago), calculada uma vez por endereço e
gravada no cadastro. Custo real de referência: R$ 9,60 por entrega numa rota de 10.

Roteirização automática fica fora — ~10 entregas/dia se organizam à mão.

---

## Fase 6 — Comércio Conversacional (Bot WhatsApp) [PARCIAL]

> **Nova porta de entrada** para o que já existe (disponibilidade, frete, OTP,
> pedidos) — não é sistema novo. **Depende de Fase 2/3 prontas** (vem depois).

### Arquitetura [FECHADO]

- **Modelo híbrido (Opção C): IA interpreta, SISTEMA decide.** A IA traduz a
  conversa; **todo dado (estoque, preço, frete, prazo) vem do sistema, nunca da
  IA** — zero alucinação de número. Sistema = fonte da verdade
- Via **WhatsApp Business API oficial** (mesma base do OTP)

### Fluxo de pedido de congelada [FECHADO]

- Identifica se o cliente já é cadastrado (e se tem endereço)
- Informa **próximo dia de entrega + disponibilidade** (motor da Fase 2)
- Sem endereço → coleta CEP → calcula **frete** (Fase 5)
- Monta o pedido e lança no sistema automaticamente
- Oferece **pagamento por link (Mercado Pago)**; se não pagar no Zap →
  **pagamento na entrega**
- **[FECHADO] Pagamento na entrega liberado para TODOS** (decisão do cliente) —
  **vale só para o canal bot.** No **site**, pagamento online é obrigatório: um
  no-show não custa a viagem, custa **uma vaga de 30**, e com Pix na mão do cliente
  não há motivo para abrir esse risco
  - _Risco aceito: cliente novo pagando na entrega = vetor de calote/no-show_
  - **[A CONFIRMAR] Paraquedas opcional:** registrar histórico de calote/no-show
    por cliente, para revisitar a regra caso a caso no futuro
- **[FECHADO] Reserva temporária de estoque durante a conversa** (tempo
  configurável, padrão 10 min) — evita prometer o que some no meio do papo
- OTP amarrado ao fluxo (o cliente já escreve do próprio número)

### Escopo por tipo de contato [A CONFIRMAR — refinamento do time]

Bot é a **porta única** dos três, mas a ação difere (protege premium):

- **Congelada** → fecha autônomo (fluxo acima)
- **Evento** → **captura lead** (data, nº pessoas, local, contato) → joga no
  **pipeline de eventos (Fase 4)** → handoff pra humano (não precifica/fecha
  sozinho — precificação premium é curadoria humana)
- **Reclamação** → **detecta e passa pra humano imediatamente** (service
  recovery) + registra o caso
- **Escape pra humano** sempre disponível

---

## Buracos mapeados a endereçar

- **[RESOLVIDO]** Fiscal de saída (NFC-e) → Fase 2 (comprar)
- **[RESOLVIDO]** Ponte app→impressora / KDS → Fase 2
- **[RESOLVIDO]** Homologação iFood/99food → decisão de comprar hub
- Resiliência offline / "rojão" → parcialmente via PDV offline-first; falta
  definir estratégia de fila e degradação no KDS
- LGPD (disparo em massa WhatsApp) → Fase 3
- Conciliação de pagamentos (MP + Stone + repasses) → a detalhar
- **[RESOLVIDO no R1]** Observabilidade → Sentry + ambientes separados + CI

### Buracos encontrados na análise de 2026-08-10 (não estavam neste documento)

Resolvidos no R1:

- **RLS e modelo de autorização** — o documento só falava de "permissão por módulo"
  na UI, sem nada na camada de dados
- **LGPD do site**: termos, política de privacidade, banner, consentimento versionado
- **SEO técnico** e schema `Restaurant` — pizzaria vive de busca local
- **Ajuste de estoque com motivo + auditoria** — sem isso o saldo projetado descola do
  real em semanas e o checkout passa a mentir
- **Cancelamento com retorno ao estoque**
- **Imposto e taxa de cartão na margem** — sem eles a margem é fantasia
- **Alérgenos e validade** no catálogo (rotulagem ANVISA; avelã na Nutella)
- **Snapshot de preço, custo e endereço no pedido** — sem isso, editar cadastro
  reescreve o histórico
- **Fuso horário** explícito (`America/Sao_Paulo`) em todo cálculo de data
- **Estratégia de testes** — o documento não tinha nenhuma
- **Ponto de equilíbrio × ocupação de capacidade** lado a lado
- **Fechamento de comissão por entregador**
- **Segregação de receita por atividade fiscal** (congelado industrializado vs. fresca
  no balcão) — o Simples exige na declaração mensal

Adiados com o dado já capturado:

- Etiqueta de lote/validade para impressão (rotulagem)
- Contagem cíclica de inventário e registro de perdas
- Roteirização do dia de entrega
- Emissão fiscal (costura pronta, integração adiada)

Ainda abertos, para as fases seguintes:

- Conflito de agenda em eventos: equipe e **equipamento** duplo-alocados
- **Sinal/depósito e política de cancelamento** de eventos — o roadmap trata pagamento
  só no contexto de delivery
- Cadastro de custo de equipe e deslocamento (pré-requisito da precificação assistida)
- Como um lead de evento entra no pipeline antes do bot existir
- Migração dos dados atuais (clientes, receitas, estoque)

---

## Documentação técnica final (entregável)

- `ARCHITECTURE.md`, `CLAUDE.md` e demais docs para Claude Code — **[A VALIDAR]**,
  a gerar conforme fases forem fechadas.

---

## Como seguir **[REVISTO 2026-08-10]**

> A ordem abaixo é a **justificativa** da priorização. A fila executável, com IDs
> e dependências, está em [`ROADMAP.md`](../ROADMAP.md).

A ordem abaixo substitui a anterior (que mandava fechar frete em segundo lugar e
deixava o site para o fim). O diagnóstico de capacidade ociosa inverteu a prioridade:
não falta capacidade, falta canal de venda.

1. **R1 — E-commerce** _(spec escrita, pronta para plano de implementação)_
   Site de vendas · catálogo · checkout · motor de disponibilidade · frete ·
   área do cliente · admin de pedidos/estoque/custos
2. **R2 — Módulo de eventos** (Fase 4 do roadmap, já bem especificada)
3. **R3 — Fiscal + operação de cozinha**: emissor NFC-e, KDS, PDV
4. **R4 — Canais e automação**: hub iFood/99food, bot WhatsApp, marketing

Providências externas em paralelo, todas fora do caminho técnico e com lead time:
verificação da empresa na Meta (bloqueia o login em produção), contador (anexo do
Simples e atividade mista), certificado digital A1, ensaio de fotografia.
