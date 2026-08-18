# 🗺️ ROADMAP (Backlog) do Projeto: Napo

> 📋 **Convenções**
>
> - **Prefixo de ID deste projeto:** `NAPO`.
> - **Specs:** cada item aprovado vira pasta em `docs/specs/[ID]-[slug]/`. **Completo** (3 arquivos: `spec.md`, `design.md`, `tests.md`) por default; **lite** (1 arquivo `spec.md` com `Tipo: lite`) permitido para itens em 1 domínio não-sensíveis conforme `AGENTS.md` §3.1 (resumo: Esforço=Baixo qualquer MoSCoW, OU Esforço=Médio com MoSCoW≠Must, OU Esforço=Médio+Must em 1 domínio). Mudanças triviais (≤1 arquivo, sem RN nova, ≤30min) podem ir direto como **tweak** sem spec (ver `AGENTS.md` §3.0).
> - **IDs imutáveis:** o número não muda ao reordenar. A ordem é dada pela **posição na seção**, não pelo número.
> - **Como o agente atualiza este arquivo:** veja `AGENTS.md` §4 (movimentação entre seções, novos itens, dependências).
> - **Evoluir este backlog** (capturar ideias durante dev, promover, grooming): comandos `/ideia`, `/promover`, `/grooming`. Ver Fluxo 6 do guia em `oria-orquestrador-ia/ReadMe_GuiaOrquestracaoAgentes.md` e `AGENTS.md` §4.3.

> 📚 **Fontes de verdade deste backlog**
>
> - **Spec do R1:** [`docs/superpowers/specs/2026-08-10-napo-r1-ecommerce-design.md`](docs/superpowers/specs/2026-08-10-napo-r1-ecommerce-design.md) — vence em qualquer conflito.
> - **Decisões por fase (R2+):** [`docs/roadmap-napo-decisoes.md`](docs/roadmap-napo-decisoes.md) — registro histórico, não é fila de trabalho.

---

## 🎯 Objetivo do MVP

_Descreva o menor produto que já resolve o problema central do usuário._

Vender pizza congelada premium por canal próprio, com disponibilidade honesta e frete
que não mata a venda. O gargalo é o **forno**, não o mercado: a cozinha opera a 47% da
capacidade (303 de 650 pizzas/mês) e a ociosidade vale R$ 7.700/mês de margem — por
isso o canal de venda vem antes de qualquer módulo de operação.

Fecha o MVP (R1): site com catálogo e SEO, checkout com Mercado Pago, motor de
disponibilidade (cutoff derivado + dois tetos), frete por faixa, área do cliente,
admin de pedidos/estoque/custos, LGPD e auditoria.

---

## 🟢 Em Andamento (máx 2-3 itens simultâneos)

_Itens sendo trabalhados agora. O agente move de "Próximos" ao iniciar._

- [ ] **NAPO-005** Endereços e frete por faixa de distância
  - **Spec:** [`docs/specs/005-enderecos-frete/`](docs/specs/005-enderecos-frete/)
  - **Iniciado em:** 2026-08-18
  - **Dependências:** NAPO-001, NAPO-002
  - **Bloqueia:** NAPO-006
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Must
  - **Notas:** CEP → ViaCEP → geocoding → ajuste de pin. Faixas fixas (0–4 km R$6 · 4–8 km R$10 · 8–12 km R$14), frete grátis acima de R$ 150, raio de 12 km configurável + exceções de CEP. Distância **rodoviária** (Brasília tem o lago), calculada uma vez por endereço e gravada. Custo real de referência: R$ 9,60/entrega em rota de 10. Spec §6.


---

## 🟡 Próximos (Ordem importa — pegar de cima pra baixo)

_Próximos na fila, ordem definida. O agente promove o primeiro item para "Em Andamento" ao iniciar._

- [ ] **NAPO-006** Carrinho e checkout com Mercado Pago
  - **Spec:** `docs/specs/006-checkout/` _(a criar)_
  - **Dependências:** NAPO-002, NAPO-003, NAPO-004, NAPO-005
  - **Bloqueia:** NAPO-007
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Must
  - **Notas:** Pix, crédito e débito. **Pagamento online obrigatório no site** — um no-show não custa a viagem, custa uma vaga de 30. Snapshot de preço, custo e endereço no pedido (editar cadastro não pode reescrever histórico). Cancelamento devolve estoque; estorno é manual no painel MP. Spec §7.

---

## 🔵 Backlog (Priorizado mas flexível)

_Itens conhecidos sem ordem fixa. Reordenar conforme aprendizado e novas informações._

### Fecham o R1

- [ ] **NAPO-007** Área do cliente (pedidos e endereços)
  - **Dependências:** NAPO-006
  - **Valor:** Médio · **Esforço:** Baixo · **MoSCoW:** Must
  - **Notas:** padrão de listagem do projeto: cards + busca + combobox de filtro + combobox de ordenação, com persistência ao navegar entre card e lista.

- [ ] **NAPO-008** Admin: pedidos, insumos/BOM, estoque, entregadores, custos e painel econômico
  - **Dependências:** NAPO-002, NAPO-004
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Must
  - **Notas:** provavelmente vira mais de uma spec. Inclui BOM de dois níveis (sub-receita de massa), ajuste de estoque **com motivo + auditoria** (sem isso o saldo projetado descola do real em semanas e o checkout passa a mentir), imposto e taxa de cartão na margem, fechamento de comissão por entregador, ponto de equilíbrio × ocupação de capacidade lado a lado, simulador de viabilidade de frete e segregação de receita por atividade fiscal. Spec §4, §12.

- [ ] **NAPO-009** LGPD e log de auditoria
  - **Dependências:** NAPO-001
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Must
  - **Notas:** termos, política de privacidade, banner, consentimento **versionado** (quando e qual versão foi aceita). Utilidade (OTP, aviso de entrega) é separada de marketing — validar o número não autoriza propaganda. Spec §8.

- [ ] **NAPO-021** Provisionar homologação e produção + primeiro deploy
  - **Dependências:** NAPO-001
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Must
  - **⚠️ Conferir antes de publicar (do NAPO-003, 2026-08-17):** (a) a separação real de bancada entre doce e salgado, que sustenta o precaucional de avelã estar só nos doces; (b) a Banana declara leite em "contém" e a Massa Doce, que é a base dela, declara só glúten — uma das duas está errada.
  - **Notas:** desmembrado do NAPO-001 em 2026-08-10 por decisão de focar em desenvolvimento primeiro. Cria os dois projetos Supabase online (staging e prod — **2 ativos cabem no free tier**), conecta a Vercel, aponta o DNS de `napobsb.com.br` no Registro.br e roda o primeiro `db:push` de verdade. Dois pontos de atenção conhecidos: projeto free **pausa após ~7 dias sem atividade** (o CI tocando o banco a cada PR resolve), e produção no free não tem PITR — vira Pro (~US$ 25/mês) antes de faturar. **Quanto mais specs acumularem antes deste item, maior a superfície de surpresa de ambiente** (`docs/specs/001-fundacao/design.md` §8).

### R2 — Eventos

- [ ] **NAPO-010** Módulo de eventos (preparação)
  - **Dependências:** NAPO-008
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Should
  - **Notas:** o sistema **prepara** o evento, não o opera ao vivo — cada evento é um dossiê. Cálculo automático de insumos via proporção pessoa/pizza sobre o BOM, checklist de equipamentos, semáforo de prontidão, pipeline Orçamento→Confirmado→Em preparação→Pronto→Realizado→Pós-evento, precificação assistida, rentabilidade real vs. planejada, ordem de serviço exportável (BEO). Colisão evento × congelada resolve por _allocated ATP_: evento confirmado reserva, sistema sinaliza, humano libera manualmente. Ver `docs/roadmap-napo-decisoes.md` (Fase 4).

### R3 — Fiscal e cozinha

- [ ] **NAPO-011** Emissão fiscal de venda (NFC-e) via emissor de mercado
  - **Dependências:** NAPO-008
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Should
  - **Notas:** **comprar, não construir.** A costura já fica pronta no R1. Bloqueado externamente por NAPO-018 e NAPO-019.

- [ ] **NAPO-012** KDS (tela de cozinha)
  - **Dependências:** NAPO-008
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Should
  - **Notas:** fluxo principal da cozinha; papel só para via de expedição. Falta definir estratégia de degradação/offline.

- [ ] **NAPO-013** PDV local (venda de fresca)
  - **Dependências:** NAPO-012
  - **Valor:** Médio · **Esforço:** Alto · **MoSCoW:** Could
  - **Notas:** canal dentro do sistema unificado de pedidos, não app separado. PWA em tablet com fila offline-first — resolve também o "aguentar o rojão".

### R4 — Canais e automação

- [ ] **NAPO-014** Ingestão de pedidos iFood/99food via hub homologado
  - **Dependências:** NAPO-012
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Could
  - **Notas:** **comprar hub**, não virar integradora homologada. Sistema consome via API/webhook → cai no KDS e baixa estoque.

- [ ] **NAPO-015** Bot de comércio conversacional no WhatsApp
  - **Dependências:** NAPO-006, NAPO-010, NAPO-012
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Could
  - **Notas:** nova porta de entrada para o que já existe, não sistema novo. Modelo híbrido: **IA interpreta, SISTEMA decide** — todo número (estoque, preço, frete, prazo) vem do sistema, zero alucinação. Congelada fecha autônomo; evento vira lead no pipeline (precificação premium é curadoria humana); reclamação vai direto para humano. Reserva temporária de estoque durante a conversa (padrão 10 min). **Pagamento na entrega liberado só neste canal.**

- [ ] **NAPO-016** Comunicação em massa no WhatsApp (marketing)
  - **Dependências:** NAPO-009
  - **Valor:** Médio · **Esforço:** Médio · **MoSCoW:** Could
  - **Notas:** exige **opt-in explícito e separado** do consentimento de utilidade — categoria e custo próprios na API da Meta.

---

## 💡 Ideias (Sem priorização)

_Capturadas mas não avaliadas. Promover para Backlog após análise de valor/esforço._

Adiadas no R1 **com o dado já capturado** (ligam depois sem migração):

- [ ] **Etiqueta de lote/validade para impressão** — rotulagem; o dado de lote já é gravado no R1. Registrado em 2026-08-10.
- [ ] **Contagem cíclica de inventário e registro de perdas** — ajuste manual com motivo cobre o R1. Registrado em 2026-08-10.
- [ ] **Capacidade por etapa-gargalo (modelo completo)** — Theory of Constraints por etapa (massa/fermentação, montagem, forno, congelamento); além de limitar venda, **diagnostica onde investir**. Adiado por falta de números medidos; a tabela de etapas já nasce no schema. Gatilho: quando houver medição real ou quando o segundo forno entrar em discussão. Registrado em 2026-08-10.
- [ ] **Roteirização automática do dia de entrega** — ~10 entregas/dia se organizam à mão. Gatilho: passar de ~25 entregas/dia. Registrado em 2026-08-10.

Ainda abertas, para as fases seguintes:

- [ ] **Orçamento de eventos online (simulador + captação de lead)** — página pública onde o cliente informa o número de pessoas e monta o pacote: louças e talheres, bebidas (refrigerante e água) e garçons a **R$ 250 cada**. O **forno de pedra no local e a pizza assada na hora são obrigatórios** — fazem parte do serviço e nunca aparecem como item opcional no simulador. Preço por pessoa **decrescente por volume**: R$ 99,00/pessoa a partir de 10 pessoas até R$ 64,90/pessoa em 100 pessoas. **Todos os valores editáveis no admin** — é essa exigência que torna o item dependente do NAPO-008 e o tira do NAPO-003. Resolve a ideia "como um lead de evento entra no pipeline antes do bot existir" e antecipa parte da precificação assistida do NAPO-010. Precisa de: faixas de preço por volume, catálogo de itens opcionais, calculadora em `packages/core`, formulário de lead com consentimento LGPD e telas de admin. **Depende de NAPO-008.** Registrado em 2026-08-13. **Origem:** Gate Visual A do NAPO-003, quando o PM notou que o site não tinha porta de entrada para eventos. O NAPO-003 entrega a porta (página `/eventos` + CTA de WhatsApp); o simulador é este item.
- [ ] **Promoções, cupons e descontos** — não existe nada disso no R1: a única regra promocional é frete grátis acima de R$ 150 (NAPO-005). A definir o que "promoção" significa para a Napo — cupom de desconto, desconto por quantidade, combo, ou **preço menor em fornada distante para encher o forno ocioso** (a que mais conversa com o gargalo do negócio). Mexe em preço, checkout, margem e painel econômico ao mesmo tempo. Registrado em 2026-08-13. **Origem:** Gate Visual A do NAPO-003.

- [ ] **Migração dos dados atuais** (clientes, receitas, estoque) — precisa acontecer antes do go-live do R1. Registrado em 2026-08-10.
- [ ] **Conciliação de pagamentos** (Mercado Pago + Stone + repasses). Registrado em 2026-08-10.
- [ ] **Sinal/depósito e política de cancelamento de eventos** — o registro de decisões trata pagamento só no contexto de delivery. Registrado em 2026-08-10.
- [ ] **Conflito de agenda em eventos:** equipe e **equipamento** duplo-alocados. Registrado em 2026-08-10.
- [ ] **Cadastro de custo de equipe e deslocamento** — pré-requisito da precificação assistida de eventos (NAPO-010). Registrado em 2026-08-10.
- [ ] **Como um lead de evento entra no pipeline antes do bot existir** — hoje não há porta de entrada. Registrado em 2026-08-10.
- [ ] **Histórico de calote/no-show por cliente** — paraquedas para revisitar caso a caso a regra de pagamento na entrega do bot (NAPO-015). Registrado em 2026-08-10.
- [ ] **Resiliência offline e degradação do KDS** — o PDV resolve por fila offline-first, o KDS ainda não tem estratégia. Registrado em 2026-08-10.
- [ ] **Migrar o Supabase CLI para 2.x e o Postgres local para 17** — o repositório fixa CLI 1.x e `major_version = 15`, que já não são o padrão de projetos novos do Supabase. A troca é barata enquanto não existe produção e cara depois que houver dado real. Gatilho observado: um volume Docker criado por uma CLI 2.x recusou subir na 1.x (`database files are incompatible with server`) e derrubou o ambiente local inteiro — enquanto as máquinas de dev tiverem CLIs diferentes, quem clonar perde o stack. Registrado em 2026-08-10. **Origem:** conserto do merge travado de NAPO-001, com duas máquinas em CLIs divergentes. **Exige revisão de spec NAPO-001 antes de promover** — mexe em `supabase/config.toml`, no `package.json` e no CI.

- [ ] **Templates de e-mail do Supabase Auth em português com a identidade da Napo** — o Magic Link chega hoje com o texto padrão do GoTrue, em inglês e sem marca: é o primeiro e-mail que o cliente recebe da casa e o que carrega o link de acesso à conta. Configurável por `[auth.email.template.*]` no `config.toml` (local) e pelo painel (staging/prod). Envolve copy, não só HTML. Registrado em 2026-08-11. **Origem:** Gate Visual B do NAPO-002.
- [ ] **SMTP customizado no Supabase Auth via Resend** — o SMTP embutido do Supabase entrega 2–4 e-mails por hora e é explicitamente proibido em produção; sem SMTP próprio o Magic Link não funciona fora do ambiente local, ou seja, **o login não sobe**. Decisão de 2026-08-11: Resend, como a arquitetura §2.1 já define, com `From: pedido@napobsb.com.br` e DKIM no domínio. Gmail avaliado a pedido do PM e **descartado** — conta gratuita reescreve o remetente para `@gmail.com`, sem DKIM do domínio próprio, no e-mail que menos pode cair em spam. Registrado em 2026-08-11. **Origem:** Gate Visual B do NAPO-002. **Bloqueia NAPO-021** (provisionar homologação e produção).

---

- [ ] **Copy do site derivada de configuração, não cravada no código** — o site do NAPO-003 escreve à mão o que hoje é premissa de dado único: o **dia de entrega** ("Brasília, às sextas", rótulo "esta sexta" no seletor de fornada), as **faixas de frete** (R$6/R$10/R$14, grátis >R$150) e os **valores de evento** (R$99→R$64,90/pessoa, garçom R$250). O motor de entrega já é config-driven (`dias_semana_entrega`, NAPO-004), mas os textos não derivam dela. Quando o frete (NAPO-005) e a gestão no admin (NAPO-008) existirem, essas superfícies do site devem **ler** a config em vez de repetir números — senão ligar um segundo dia de entrega ou reajustar frete exige editar copy. Registrado em 2026-08-17. **Origem:** Gate Visual B do NAPO-003 (PM perguntou como escalar dias de entrega e tornar frete/evento gerenciáveis).
- [ ] **Indicador de precificação de frete no admin** (combustível + parâmetros) — um assistente que sugere o frete por faixa a partir de custo real: preço do combustível ÷ consumo + desgaste por km, distância **rodoviária** ×2, dividido pela **densidade da rota** (entregas por viagem — referência NAPO-005: R$ 9,60/entrega em rota de 10), mais parcela do entregador e margem alvo; com **alerta quando a faixa cobra abaixo do custo** (o mesmo erro que a fórmula `km×2÷qtd` rejeitada cometia). Encaixa no **"simulador de viabilidade de frete"** já previsto nas notas do NAPO-008. Registrado em 2026-08-17. **Origem:** Gate Visual B do NAPO-003.

- [ ] **Porta de entrada para a conta no site público** — não existe nenhuma referência a `/entrar` ou `/conta` em qualquer superfície do site: quem entra pela home não tem como chegar ao login, e quem já está logado não tem como voltar para a área do cliente. O NAPO-002 entregou as telas de auth e o NAPO-003 entregou o site; ligar os dois não coube em nenhuma das duas specs e passou no meio. Precisa decidir o comportamento do cabeçalho para os dois estados (anônimo → "Entrar"; autenticado → nome ou "Minha conta"), o que arrasta leitura de sessão para uma superfície hoje 100% estática — e o SSG do `(site)` é decisão de custo declarada em `ARCHITECTURE.md` §4.5, não detalhe. Candidato natural a nascer junto do **NAPO-007**, que é quem dá dono ao cabeçalho da área do cliente. Registrado em 2026-08-18. **Origem:** Gate Visual B do NAPO-005 — o PM logou e não achou caminho de volta.

- [ ] **Ranking das "mais pedidas" derivado de venda real** — hoje `ranking_mais_pedidas` é preenchido à mão na migration de catálogo (1 Calabresa · 2 Peito de Peru com Gorgonzola · 3 Frango c/ Catupiry). O PM pediu que a home ordenasse pelo que mais vende, mas não existe pedido no banco até o NAPO-006 — e um ranking cravado envelhece calado: quando a preferência mudar, a home continua afirmando um fato que deixou de ser verdade. Quando houver histórico de venda, derivar de uma janela móvel (ex.: 90 dias) com o valor manual como override do admin (NAPO-008). Registrado em 2026-08-17. **Origem:** bloco C do NAPO-003. **Depende de NAPO-006.**

## ⏸️ Bloqueados (Aguardando externo)

_Itens com bloqueio externo (espera de terceiro, decisão, dependência fora do controle)._

- [ ] **NAPO-017** Verificação da empresa na Meta (WhatsApp Business API)
  - **Bloqueado por:** processo de verificação da Meta — **bloqueia o login em produção** (NAPO-002 não sobe sem isso)
  - **Desde:** 2026-08-10
  - **⚠️ Prioridade elevada (2026-08-11, benchmarking do NAPO-002):** verificação da empresa pode **não bastar**. O acesso a _authentication templates_ passa por um caminho de escala da Meta que inclui limiar de volume (ordem de grandeza citada publicamente: milhares de conversas iniciadas pelo negócio por dia, por número). A Napo faz 303 pizzas/mês. O risco deixou de ser "o envio pode falhar" e passou a ser "o canal pode nunca ser liberado". **Descobrir a elegibilidade real é agora caminho crítico** — se negativa, a decisão de canal precisa ser reaberta antes do NAPO-006.

- [ ] **NAPO-018** Contador: anexo do Simples e atividade mista
  - **Bloqueado por:** definição do contador (congelado industrializado vs. fresca no balcão — o Simples exige a segregação na declaração mensal)
  - **Desde:** 2026-08-10

- [ ] **NAPO-019** Certificado digital A1
  - **Bloqueado por:** emissão junto à certificadora; pré-requisito da emissão fiscal (NAPO-011)
  - **Desde:** 2026-08-10

- [ ] **NAPO-020** Ensaio de fotografia dos produtos
  - **Bloqueado por:** agendamento com fotógrafo — **restam 3 produtos**: Lombo Canadense, Massa doce e Massa salgada
  - **Desde:** 2026-08-10
  - **⬇️ Deixou de bloquear o NAPO-003 (2026-08-13):** o PM indicou `docs/images/ensaio/` com fotos utilizáveis de 9 dos 12 produtos, mais forno e produção. As 9 já entraram no contrato visual, cortadas em quadrado e comprimidas. Os 3 restantes nascem com placeholder na mesma proporção. **Briefing das que faltam:** top-down, pizza centralizada, fundo indiferente (o recorte circular apara o entorno).

---

## ✅ Concluídos

_Histórico — adicionar mais recentes NO TOPO._

- [x] **NAPO-003** Site público, catálogo e SEO · concluído 2026-08-17 · [`docs/specs/003-site-catalogo/`](docs/specs/003-site-catalogo/)
  - Vitrine `/sabores`, 12 páginas de produto em SSG (`dynamicParams=false` — slug desconhecido ou inativo cai em 404 sem tocar o banco), home com storytelling sobre o eixo "Longa fermentação. Assada na pedra. Em casa, só aquecer.", `/como-aquecer`, `/eventos` e as páginas legais provisórias.
  - **Catálogo é schema, não conteúdo solto:** preço mora na faixa (reajustar é um UPDATE, não doze), alérgeno é enum (grafia divergente é alérgeno invisível), e a RN2 virou `CHECK` no banco — publicar produto sem rotulagem completa é impossível, não improvável, e a regra já vale para o admin do NAPO-008 e para a NFC-e do NAPO-011.
  - Primeira superfície do banco exposta a **anônimo**: leitura pública só de categorias, faixas e produtos ativos; produto inativo é invisível (URL indexada de descontinuada não vende o que não existe). Leitura de SSG usa client anônimo sem cookies — `cookies()` tornaria a página dinâmica e mataria o SSG.
  - Disponibilidade ao vivo do NAPO-004 entra como **ilha cliente** sobre página estática, com uma única busca compartilhada por contexto e estado da fornada na querystring via `history.replaceState`. JSON-LD `Product`+`Offer` usa snapshot de build (o buscador lê o marcado, não o vivo) e `Restaurant` no layout.
  - Seed de produção com a rotulagem real dos 12 produtos (550 g, 90 dias, alérgenos e precaucional por bancada), ids cravados para o produto ser a mesma linha nos três ambientes. 152 testes Vitest + 55 pgTAP.
  - **Não vai ao ar aqui** — publicação é NAPO-021. Pendências conhecidas: fotos de 3 produtos (NAPO-020) e duas conferências de rotulagem anotadas nas notas do NAPO-021.

- [x] **NAPO-002** Autenticação, papéis e gate de telefone por WhatsApp · concluído 2026-08-11 · [`docs/specs/002-auth-gate-telefone/`](docs/specs/002-auth-gate-telefone/)
  - Magic Link e Google pelo Supabase Auth, perfil criado no callback (nasce sempre `cliente`), destino decidido no servidor por papel, e guarda de rota em duas camadas: middleware confere sessão, layout de servidor confere papel e telefone **contra o banco** — claim em JWT ficaria velha e barraria quem acabou de validar.
  - Gate de telefone por OTP no WhatsApp: código de 6 dígitos guardado como HMAC com pepper fora do banco, comparação em tempo constante, tetos por número e por IP aplicados **antes** do envio (cada mensagem é dinheiro pago à Meta) e recusa cega quando o número é de outra conta, para o endpoint não virar oráculo de enumeração de clientes.
  - Consentimento versionado com IP, gravado antes da conclusão do cadastro; override de admin e promoção de papel como funções `SECURITY DEFINER` com auditoria atômica, exercitadas por `scripts/admin.mjs`.
  - **Inaugura a base de UI do projeto:** Tailwind v4, tokens completos, 7 primitivos shadcn, o pattern `<AuthCard>` e o componente `<Marca>` — herdados pelo NAPO-003.
  - 119 testes Vitest + 43 pgTAP. Divergência do preview aprovado registrada em `drift.md` (identidade visual real substituiu a marca provisória); regra permanente de marca em `ARCHITECTURE.md` §2.2.2.
  - **Não sobe em produção sem NAPO-017** (elegibilidade do template de autenticação na Meta) **nem sem o SMTP customizado** capturado em 💡 Ideias — sem ele o Magic Link não sai fora do ambiente local.

- [x] **NAPO-004** Motor de disponibilidade (calendário, cutoff, dois tetos) · concluído 2026-08-10 · [`docs/specs/004-motor-disponibilidade/`](docs/specs/004-motor-disponibilidade/)
  - Cutoff derivado com recuo por dia sem produção, horizonte deslizante com buffer, CTP/ATP, dois tetos (forno e freezer) e sub-teto de massa — tudo em `packages/core`, 30 testes determinísticos. Calendário e tetos configuráveis (`config_operacao`, entrega sexta, produção seg–sex). Reserva de 15 min atômica por advisory lock, sem `pg_cron`. `GET /api/disponibilidade` e `POST /api/disponibilidade/reserva`.
  - **RN12/RN13 entregues como decisão pura** (`avaliarViabilidade`, `devolucaoPorCancelamento`): a tabela `pedidos` é de NAPO-006, que vai plugá-las no webhook. Ver `drift.md`.
- [x] **Tooling: sincronia de banco entre máquinas** · concluído 2026-08-10 — git hooks versionados (`.githooks/post-merge` + `post-rewrite`) armados no `pnpm install`; todo `git pull` com migration nova roda `migration up` + regenera tipos no Supabase local. Degrada com aviso se o stack estiver desligado ou se uma migration foi reescrita (sugere `db:reset`). DevX, sem spec.
- [x] **NAPO-001** Fundação: monorepo, Next.js 15, Supabase local e CI · concluído 2026-08-10 · [`docs/specs/001-fundacao/`](docs/specs/001-fundacao/)
  - Monorepo pnpm (`apps/web` + `packages/core|db|ui`), `packages/core` puro garantido por lint. Migrations `0001/0002` com RLS deny-by-default, enum de role e trigger anti-auto-promoção (validado por pgTAP). `env.ts` (Zod) mantendo `service_role` fora do browser, helper `tempo.ts` fixado em `America/Sao_Paulo`, CI em dois jobs. Publicação (staging/prod) permanece em NAPO-021.
- [x] **Setup do kit ORIA no projeto** · concluído 2026-08-10
- [x] **Spec do R1 (e-commerce) escrita e revisada** · concluído 2026-08-10 · `docs/superpowers/specs/2026-08-10-napo-r1-ecommerce-design.md`

---

## ❌ Cancelados

_Itens descartados. IDs permanecem reservados (não reciclar)._

_(Sem itens cancelados. Duas propostas foram rejeitadas antes de virar item de backlog e estão documentadas em `docs/roadmap-napo-decisoes.md`: a fórmula de frete `km × 2 ÷ qtd` — cobrava R$ 38,40 numa pizza a 12 km — e virar integradora homologada de iFood/99food.)_

---

## 📊 Legenda de Seções

| Seção           | Significado                       | Quem move                                        |
| --------------- | --------------------------------- | ------------------------------------------------ |
| 🟢 Em Andamento | Trabalho ativo agora (máx 2-3)    | Agente ao iniciar                                |
| 🟡 Próximos     | Ordem definida, próximos na fila  | Humano prioriza                                  |
| 🔵 Backlog      | Conhecidos, prioridade flexível   | Humano ou agente                                 |
| 💡 Ideias       | Brutas, não avaliadas             | Qualquer um adiciona                             |
| ⏸️ Bloqueados   | Esperando externo                 | Agente move quando bloqueio externo é confirmado |
| ✅ Concluídos   | Histórico (mais recentes no topo) | Agente ao concluir spec                          |
| ❌ Cancelados   | Descartados                       | Humano decide                                    |
