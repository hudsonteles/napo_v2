# 🤖 AGENTS.md — Guia para Agentes de IA

> **Fonte única da verdade para todos os agentes de IA neste projeto.**
> Outros arquivos (`CLAUDE.md`, `GEMINI.md`, `.cursorrules`, etc.) são apenas ponteiros para este.
> Qualquer mudança de regra acontece **aqui** — nunca duplique nos ponteiros.

---

## 1. Hierarquia de Leitura

Ao iniciar **qualquer** tarefa, carregue os arquivos nesta ordem:

1. **`AGENTS.md`** (este arquivo) — comportamento dos agentes (universal)
2. **`ARCHITECTURE.md`** — constituição técnica do projeto (imutável sem decisão explícita)
3. **`ROADMAP.md`** — backlog atual e prioridades
4. **`docs/specs/[ID]-[slug]/`** — apenas a pasta do módulo em execução
5. **`docs/agent-postmortems.md`** — falhas conhecidas e lições aprendidas

> Se um arquivo contradisser outro acima na hierarquia, prevalece o de cima.
> Se identificar contradição real, **PARE e reporte** — não decida sozinho.

---

## 2. Regras Inegociáveis

Valem para **toda** tarefa, **todo** spec, **todo** módulo. Violar é motivo de reverter.

1. **Gates são proporcionais ao impacto.**
   - **Mudança executável** (código de produto, schema/migration, dependência, configuração de runtime ou script executável): antes de iniciar E antes de commitar, `lint` + `build` + `test` devem passar.
   - **Mudança exclusivamente documental**: antes de iniciar, inspecione o worktree; antes de commitar, execute `git diff --check`, `git status --short` e `git diff --name-only`. Não rode gates da aplicação. A categoria inclui `docs/**`, `ROADMAP.md`, `ARCHITECTURE.md`, `AGENTS.md`, Markdown metodológico da ORIA e wrappers que apenas apontam para prompts canônicos.
   - **Escopo misto ou incerto:** aplique o gate executável completo. Em um fluxo que proíbe código (como `/especificar`), arquivo de produto inesperado é scope creep: PARE e reporte em vez de legitimá-lo executando testes.
   - **Classificação canônica:** `/iniciar`, `/roadmap`, `/ideia`, `/promover` (inclusive ADR), `/grooming`, `/especificar`, `/retrospectiva` e o alias `/postmortem` são documentais; `/implementar` e tweak direto são executáveis.
2. **Não antecipe trabalho.** Resolva uma etapa por vez. Se pensou "já que estou aqui...", PARE.
3. **Não invente funcionalidade.** Implemente apenas o que está no spec. Falta algo? Consulte antes.
4. **Em dúvida real, PARE e PERGUNTE.** Custo de pausar < custo de refazer.
5. **Protocolo de erro:** reverta (`git checkout -- .`) e reporte. NUNCA tente "consertar avançando".
6. **Não toque em arquivos fora do Mapa de Impacto** (em `design.md`) sem justificativa explícita aprovada.
7. **Nunca pule hooks** (`--no-verify`) nem bypass de assinatura. Hook falhou? Investigue a causa.
8. **`plan.md` é arquivo de estado em tempo real, não documentação final.** Todo bloco começa como `[ ] pendente`. Mude para `[~] em andamento` ao **iniciar** e para `[x] concluído` ao **terminar** — nunca antes. Criar o `plan.md` com blocos já marcados como concluídos é violação que invalida o mecanismo de retomada. **A cada transição de estado, commite imediatamente** — o código e o estado do plan.md devem estar sincronizados em todo commit.
9. **Paralelismo previsto no plano deve ser declarado como executável ou impossível.** Se o plano lista "Paralelizável com: Bloco X", o agente deve, no momento da aprovação do plano: (a) confirmar que usará `runSubagent` para executar em paralelo, OU (b) declarar explicitamente ao PM que executará sequencialmente e propor reorganização dos blocos para refletir isso. Nunca deixar silenciosamente o paralelismo não acontecer.
10. **Aderência à seção "Arquitetura de Código" do `ARCHITECTURE.md` é inviolável.** Todo arquivo novo deve viver no caminho previsto por essa seção (modular por domínio / feature-based / o que a arch desse projeto especificar). Se o `design.md` propõe arquivo num caminho que não bate com a estrutura definida pela arch, **PARE** antes de criar: (a) corrija o caminho para encaixar na arch, OU (b) escale como pré-requisito de ADR para mudar a estrutura. Nunca crie pastas/módulos novos no nível-raiz por conveniência. **Referencie sempre por nome ("seção Arquitetura de Código")** — nunca por número de seção (§3, §4), pois a numeração varia entre projetos enquanto o nome canônico é invariante.
11. **UI tem dois gates obrigatórios + library-first.** Toda spec que entrega ou altera UI (definição de "UI" e caminhos dos arquivos seguem a seção **"Arquitetura de Código"** + seção **"UI & UX"** do `ARCHITECTURE.md` do projeto) precisa atender:
    - **(a) Gate Visual A — pré-código (`/especificar`):** PM aprova **preview standalone** do(s) mockup(s) **antes** de fechar a seção §4 do `design.md`. O mecanismo de preview (HTML+Tailwind CDN, HTML+CSS inline, protótipo Flutter web, screenshot externo, etc.) é escolhido pelo agente conforme a stack declarada no `ARCHITECTURE.md` do projeto — ver FASE 3.5 do `/especificar` (matriz de decisão + receitas). Preview aprovado vira **contrato visual versionado** em `docs/specs/[ID]/preview.*` (ou múltiplos arquivos para multi-tela independente). Sem preview aprovado, spec não vai para `Status: Aprovado`.
    - **(b) Gate Visual B — pós-código (`/implementar`):** ambiente de execução real do projeto rodando (dev server, emulator, simulator, conforme stack) + auditoria interna do agente contra os critérios visuais aprovados + visualização da(s) tela(s) afetada(s) disponibilizada ao PM. Em superfícies web, o agente informa a URL base e as URLs exatas das telas afetadas e mantém o servidor disponível durante a validação. A aprovação do PM acontece na aplicação real: o agente **não gera, versiona nem apresenta screenshots ao PM como evidência do gate**. Capturas efêmeras podem ser usadas internamente apenas para auditar o contrato visual. Exige **aprovação explícita do PM** antes do `[x]` final do bloco. Sem aprovação, bloco volta para `[~] em andamento` e drift se necessário.
    - **(c) Library-first:** páginas e componentes de produto consomem o catálogo declarado na seção **"UI & UX"** do `ARCHITECTURE.md` do projeto (primitivos próprios, patterns de composição, bibliotecas de UI adotadas). **Criar componente novo exige justificativa** em `design.md` §4.4 explicando por que existentes não servem. JSX/markup cru extenso (código de página replicando o que deveria ser componente) é violação — exceções (containers/spacing de layout) devem ser explicitamente declaradas em §4.4.

    Violar qualquer um dos três pontos = violação inegociável. Reverter (`git checkout -- .`) e replanejar.

---

## 3. Protocolo de Execução de Spec

### 3.0 Quando NÃO criar spec (categoria "tweak")

Nem toda mudança precisa virar spec — spec para tweak é overhead puro. Use **commit estruturado direto** (sem `/especificar`) quando **TODOS** os critérios baterem:

- ≤1 arquivo de produto modificado (não conta arquivos de teste no mesmo módulo)
- 0 RN nova introduzida (a regra de negócio já existia)
- 0 mudança de schema (Prisma, SQL, schemas Zod públicos)
- 0 toque em auth / RBAC / multi-tenant
- Estimativa ≤30 min de trabalho efetivo
- Reversibilidade trivial (1 revert resolve, sem migration reversa)

**Exemplos canônicos:** ícone do botão trocado, copy de toast ajustado, link externo adicionado, refactor de nome interno, fix de tipo estrito numa função isolada, ajuste de cor/spacing em 1 componente.

**Fluxo:**

1. **Crie entrada em 💡 Ideias do ROADMAP** apenas se quiser registrar a origem (opcional para tweak — evita poluir backlog).
2. **Implemente + teste localmente** (lint+build+test verde antes do commit).
3. **Commit estruturado** no formato:

   ```
   <tipo>(<escopo>): <descrição curta em PT-BR>

   Contexto: <1-2 linhas: por que essa mudança existe>
   Decisão: <1-2 linhas: o que foi escolhido + trade-off se houver>
   Impacto: <1 linha: o que esperar / regressões prováveis>
   ```

4. **Push imediato** (regra `§7` — não acumular tweak local).

**Quando NA DÚVIDA, escale para lite.** Se o tweak tocar 2 arquivos ou você precisar pensar em alternativas, **já não é tweak** — vire `/ideia` → `/promover` → `/especificar` com lite.

**Anti-padrão:** sequência de tweaks no mesmo módulo em curto espaço (3+ em 1 semana) é sinal de que o módulo precisa de spec real para consolidar direção — transforme o próximo em ideia formal.

### 3.1 Variantes de spec (completo vs lite)

Cada spec vive em `docs/specs/[ID]-[slug]/`. Existem **duas variantes**:

- **Completo (default):** `spec.md` + `design.md` + `tests.md`. Template em `oria-orquestrador-ia/xx-SpecName/`. **Obrigatório quando** o item afeta segurança / LGPD / RBAC / multi-tenant / migration destrutiva, tem complexidade técnica alta, alto custo de reversão, OU envolve ≥2 domínios simultaneamente (ex.: frontend + backend + schema).
- **Lite:** apenas `spec.md` com frontmatter `Tipo: lite`. Template em `oria-orquestrador-ia/xx-SpecLite/`. Combina regras + design + tests em 1 doc (~80-150 linhas). **Permitido quando** o item cabe em **1 domínio**, não é sensível e tem complexidade técnica baixa ou média.

`MoSCoW` continua sendo contexto de prioridade de produto, mas não determina sozinho a modalidade técnica e sua ausência não bloqueia `/especificar`.

Na Fase 0.5, o agente analisa complexidade e explica impactos concretos em linguagem didática; o PM decide entre as modalidades permitidas. O PM pode elevar o rigor (`tweak` → lite → completo), mas não rebaixar uma modalidade completa obrigatória sem reescopo ou exceção formal que remova o motivo de obrigatoriedade.

A escolha acontece em `oria-orquestrador-ia/prompts/especificar.md` Fase 0.5.

### 3.1 Ordem de leitura dentro do spec

**Variante completa:**

1. `spec.md` — entenda o **o quê** e o **porquê** (negócio)
2. `design.md` — entenda o **como** (técnico + UI + Mapa de Impacto)
3. `tests.md` — entenda o **pronto quando** (contrato de validação)

**Variante lite:** leia o `spec.md` único — todas as 3 dimensões estão lá (RNs com cenários Gherkin inline em §2; Mapa de Impacto + decisões em §4).

### 3.2 Ordem de execução (TDD-leve)

1. **Pré-flight:** Build verde? Spec aprovado pelo humano? Dependências do roadmap concluídas?
2. **Testes primeiro:** transforme cada cenário de `tests.md` em código executável. Eles devem falhar (red).
3. **Implementação:** implemente conforme `design.md` até todos os testes passarem (green).
4. **Refactor:** limpe sem quebrar testes (refactor).
5. **Gate de saída:** lint + build + test verdes; Mapa de Impacto respeitado.
6. **Retrospectiva:** dispare o gatilho de postmortem (veja seção 5.1).
7. **Atualização do roadmap:** veja seção 4.
8. **Fechamento:** mude `Status:` do `spec.md` para `Concluído`.

### 3.3 Protocolo de Architecture Decision Record (ADR)

Quando uma mudança afetar algo já documentado em `docs/ARCHITECTURE.md` ou em spec aprovado, **não edite a arquitetura silenciosamente** — crie um ADR primeiro.

**Quando criar ADR (obrigatório):**

- **Tipo A — antes de promover:** Ideia em 💡 Ideias com flag `**Exige ADR**`. Bloqueia `/promover` (ver §4.3).
- **Tipo B — antes de especificar/implementar:** Item já no Backlog/Próximos com campo `**ADR pré-requisito:**` diferente de `—` ou `(Status: Aceito)`. **Bloqueia `/especificar` e `/implementar` mecanicamente.**
- Spec em execução revela necessidade de mudar decisão estrutural anterior.
- Decisão de stack/integração/segurança que afeta múltiplos módulos.

**Formato da flag `ADR pré-requisito` em itens do ROADMAP** (Tipo B):

```
- **ADR pré-requisito:** —  |  ADR-NNNN-slug (Status: Pendente | Proposto | Aceito | Descartado)
```

`/especificar` e `/implementar` **PARAM no pré-flight** se valor ≠ `—` e ≠ `(Status: Aceito)` — mas não simplesmente abortam: disparam o **protocolo proativo §3.3.1** abaixo.

#### 3.3.1 Protocolo proativo quando agente detecta `ADR pré-requisito` Pendente

Ao detectar a flag bloqueando `/especificar` ou `/implementar`, **NÃO aborte o fluxo** — pergunte ao humano como conduzir:

> _"O item `$ARGUMENTS` exige ADR pré-requisito: **[valor atual]**. Como deseja proceder?_
>
> - **A) Eu rascunho o ADR** — você revisa, ajusta, aprova/rejeita*
> - **B) Você cria o ADR manualmente** — eu aguardo até `(Status: Aceito)` no campo do item*
> - **C) Rejeitar — repensar o escopo do item** para que não exija mudar a arquitetura"*

Conduza conforme escolha:

##### Opção A — Rascunho assistido pelo agente

1. **Colete contexto** (em ordem):
   - Notas e pré-requisitos textuais do item no ROADMAP
   - Seção(ões) afetada(s) de `docs/ARCHITECTURE.md`
   - Specs aprovadas relacionadas (`docs/specs/*/spec.md` com `Status: Aprovado` ou `Concluído`)
   - Memória de conversas anteriores se acessível

2. **Determine slug e número:** próximo `NNNN` sequencial em `docs/adr/`; slug kebab-case curto.

3. **Crie `docs/adr/NNNN-slug.md`** copiando `oria-orquestrador-ia/adr-template.md`. Preencha:
   - `Status: Proposto`
   - `Data: YYYY-MM-DD` (hoje)
   - `Decisor(es): [humano em conversa]`
   - `Disparado por:` "Item `$ARGUMENTS` do ROADMAP — pré-requisito de ADR"
   - **Contexto** — derivado do item + arch
   - **Decisão** — formulação clara, 1-3 parágrafos
   - **Alternativas consideradas** — mínimo 2, com justificativa de descarte
   - **Consequências** — positivas, negativas/trade-offs, impacto em `ARCHITECTURE.md`, impacto no ROADMAP, riscos pós-decisão

4. **Apresente resumo executivo** (4-6 linhas) + caminho do arquivo + 4 opções:

   > _"ADR rascunhado em `docs/adr/NNNN-slug.md`._
   > _Resumo:_
   > _- Contexto: [1 linha]_
   > _- Decisão: [1-2 linhas]_
   > _- Alternativas consideradas: [lista curta]_
   > _- Consequência negativa principal: [1 linha]_
   > _- Impacto em `ARCHITECTURE.md` §X.X: [1 linha]_
   > _Como prefere prosseguir?_
   >
   > - **(a) Abrir o arquivo e ler completo antes**
   > - **(b) Aprovar como está**
   > - **(c) Pedir ajustes em campos específicos**
   > - **(d) Rejeitar — repensar escopo do item**"*

5. **Conforme escolha:**
   - **(a) Abrir e ler:** humano lê, volta com (b), (c) ou (d).
   - **(b) Aprovar:** prossiga para passo 6.
   - **(c) Ajustes:** colete os ajustes, edite o ADR, volte ao passo 4.
   - **(d) Rejeitar:** vá para **Opção C** abaixo.

6. **Aceitar o ADR:** edite o arquivo do ADR, mude `Status: Proposto` → `Status: Aceito`. Preencha o checkbox "Revisado por: [humano] · em YYYY-MM-DD".

7. **Atualizar `docs/ARCHITECTURE.md`** (a menos que "Impacto em arch" seja "Sem impacto direto"):
   - Identifique as seções afetadas (já listadas em "Impacto" do ADR).
   - **Formule diff exato (antes/depois)** e apresente:

   > _"ADR aceito. Para refletir, proposta de diff em `ARCHITECTURE.md` §X.X:_
   > _`diff*
*- [linha original]*
*+ [linha nova]*
*`_
   > _Aprova esta edição?"_
   - Humano aprova: aplique Edit em `ARCHITECTURE.md`.
   - Humano pede ajustes no diff: itere.

8. **Atualize o item `$ARGUMENTS` no ROADMAP:** campo `**ADR pré-requisito:**` passa para `ADR-NNNN-slug (Status: Aceito)`.

9. **Reporte e prossiga:**

   > _"ADR-NNNN-slug aceito. `ARCHITECTURE.md` §X.X atualizado. Item `$ARGUMENTS` desbloqueado. Retomando `/especificar` (ou `/implementar`) `$ARGUMENTS`..."_

##### Opção B — Espera de ADR manual

Diga ao humano:

> _"OK, aguardando você criar `docs/adr/NNNN-slug.md` manualmente. Quando o campo `**ADR pré-requisito:**` do item `$ARGUMENTS` for atualizado para `(Status: Aceito)`, rode `/especificar $ARGUMENTS` (ou `/implementar`) de novo."_

**NÃO crie spec/implemente.** Encerre o fluxo.

##### Opção C — Rejeitar / Repensar escopo

1. **Identificar conflito:** pergunte: _"O que no item `$ARGUMENTS` exige mudar `ARCHITECTURE.md` §X.X especificamente?"_

2. **Propor reescopos alternativos** (mínimo 2 concretos):

   > _"Possíveis reescopos para `$ARGUMENTS` que evitam o conflito com arch:_
   >
   > - Opção 1: [descrição concreta]*
   > - Opção 2: [descrição concreta]*
   >   _Ou você tem outra ideia?"_

3. **Conforme escolha:**
   - **Reescopo viável escolhido:**
     - Edite o item no ROADMAP: ajuste notas + altere `**ADR pré-requisito:**` para `—`.
     - Reporte: _"Item reescopado, ADR não é mais necessário. Posso rodar `/especificar $ARGUMENTS` agora?"_
   - **Nenhum reescopo viável:** pergunte fallback:
     - _(α) Cancelar `$ARGUMENTS`_ → mover para ❌ Cancelados com motivo "ADR rejeitado, escopo inviável sem mudar arch".
     - _(β) Criar ADR normalmente_ → volte para Opção A.
     - _(γ) Marcar ADR como Descartado_ → criar `docs/adr/NNNN-slug.md` com `Status: Descartado` + motivo. Item fica no Backlog com `**ADR pré-requisito:** ADR-NNNN-slug (Status: Descartado)` — bloqueando reabertura até novo ADR.

**NÃO crie spec/implemente** durante o reescopo. Encerre o fluxo após a decisão.

**Quando NÃO criar ADR:**

- Bug fix dentro do escopo de um spec → fica no próprio `design.md`/`drift.md`.
- Detalhe de implementação interno a uma feature.
- Postmortem de falha do sistema de agentes → vai em `docs/agent-postmortems.md`.

**Como criar:**

1. Copie `oria-orquestrador-ia/adr-template.md` para `docs/adr/NNNN-slug.md` (próximo número sequencial, kebab-case slug).
2. Preencha contexto, decisão, **mínimo 2 alternativas**, consequências (positivas, negativas, impacto em ARCHITECTURE.md).
3. Status inicial: `Proposto`. Mude para `Aceito` após revisão humana explícita.
4. Após aceito, atualize `ARCHITECTURE.md` refletindo a decisão. Remova flag `**Exige ADR**` da entrada em 💡 se aplicável.
5. **ADR aceito é imutável** — para mudar decisão, criar novo ADR que cite o anterior como "Substituído por".

Veja `docs/adr/README.md` para o ciclo completo e índice.

### 3.4 Protocolo de Spec Drift

Se ao implementar você descobrir que o spec está errado, incompleto ou ambíguo:

1. **PARE** a implementação imediatamente.
2. Crie `docs/specs/[ID]-[slug]/drift.md` documentando a divergência.
3. Proponha **2 caminhos**: (a) manter spec e adaptar; (b) atualizar spec.
4. **Aguarde aprovação humana.**
5. Se o spec for atualizado, **reescreva os testes afetados ANTES** de continuar a implementação.

> ⚠️ Nunca "conserte" silenciosamente o spec implementando algo diferente do escrito.

---

## 4. Como Atualizar o ROADMAP.md

O `ROADMAP.md` é **vivo**. Você (agente) deve atualizá-lo automaticamente nos seguintes eventos:

| Evento                                    | Ação no ROADMAP.md                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Iniciar trabalho em um item**           | Mover linha de **🟡 Próximos** → **🟢 Em Andamento**. Adicionar campo `Iniciado em: YYYY-MM-DD`.            |
| **Concluir implementação + validação**    | Mover linha de **🟢 Em Andamento** → **✅ Concluídos**. Marcar `[x]`. Adicionar `Concluído em: YYYY-MM-DD`. |
| **Detectar nova dependência**             | Atualizar campo `Dependências:` do item afetado. Reportar ao humano.                                        |
| **Receber novo item do humano**           | Adicionar em **🔵 Backlog** ou **💡 Ideias** com **próximo ID sequencial** disponível.                      |
| **Humano pede reordenação**               | Mover linha entre seções. **NUNCA renumere IDs** — a ordem é dada pela posição, não pelo número.            |
| **Bloqueio externo (espera de terceiro)** | Mover para uma seção `⏸️ Bloqueados` (criar se não existir) com motivo + data.                              |

### 4.1 Regras de ID

- **Formato:** `[PREFIXO]-NNN` (ex: `PROJ-001`, `AUTH-001`, `CRM-042`). Prefixo é definido no início do projeto.
- **Imutáveis:** Uma vez atribuído, o ID nunca muda — nem ao reordenar, nem ao mover entre seções.
- **Sequenciais:** Sempre use o **próximo número não-utilizado** (mesmo que itens anteriores tenham sido removidos).
- **Não reciclar:** IDs de itens cancelados permanecem reservados (vão para `❌ Cancelados` se você criar essa seção).

### 4.2 Limites saudáveis

- **🟢 Em Andamento:** máximo 2-3 itens simultâneos. Se houver mais, sugira ao humano paralelização ou repriorização.
- **🟡 Próximos:** mantenha 3-7 itens. Mais que isso, mova excesso para Backlog.

### 4.3 Evolução de Ideias (captura, promoção, grooming)

A seção **💡 Ideias** do ROADMAP é a porta de entrada para tudo que surge durante uso real, postmortems, observação de produção ou conversa. Capturar é gratuito; promover é decisão; ignorar custa contexto futuro.

**Eventos a observar (complementam a tabela §4):**

| Evento                                                            | Ação no ROADMAP.md                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Ideia adjacente surgida durante `/implementar` ou outro fluxo** | Capturar em **💡 Ideias** SEM atribuir ID e SEM desviar do trabalho atual. Reportar ao humano ao fim do fluxo atual. Slash command: `/ideia [descrição]` (ver `oria-orquestrador-ia/prompts/ideia.md`).                                                                                                            |
| **Humano pede para promover ideia**                               | Atribuir próximo ID sequencial (§4.1). Perguntar V/E/MoSCoW/Dependências socraticamente. Mover de 💡 → destino apropriado (Backlog ou Próximos). **Atualizar dependências bidirecionais** dos itens que esta ideia bloqueia. Slash command: `/promover [titulo]` (ver `oria-orquestrador-ia/prompts/promover.md`). |
| **Humano pede grooming periódico**                                | Revisar 💡 e 🔵 por idade, dependências quebradas, duplicação, bloqueios obsoletos. Propor ações **sem agir sozinho**. Cadência recomendada: a cada Must concluído ou a cada 2 semanas. Slash command: `/grooming` (ver `oria-orquestrador-ia/prompts/grooming.md`).                                               |
| **Ideia conflita com `ARCHITECTURE.md` ou spec aprovada**         | Adicionar flag `**Exige ADR**` (ou `**Exige revisão spec [ID]**`) na entrada de 💡. `/promover` deve **PARAR** enquanto a flag existir — exige ADR em `docs/adr/NNNN-titulo.md` ou atualização da spec antes de mover para Backlog.                                                                                |

**Anti-padrões a evitar:**

- **Scope creep silencioso:** implementar algo "junto" não previsto na spec atual. Captura adjacente em 💡 + retomar trabalho atual é a defesa.
- **Backlog-lixeira:** acumular ideias sem nunca limpar. Grooming periódico cancela com motivo (em ❌ Cancelados) — IDs cancelados preservam reserva, não são reciclados.
- **Overplanning:** detalhar tudo antes de implementar nada. Promova só quando vai trabalhar em curto prazo.
- **Reciclagem de ID:** **NUNCA.** ID de cancelado fica reservado para sempre (§4.1).

**Princípio operacional:** captura é registro, não compromisso. Pôr em 💡 não obriga implementar — só evita esquecer.

---

## 5. Postmortems — Captura de Falhas do Sistema de Agentes

O arquivo `docs/agent-postmortems.md` registra falhas do **próprio sistema de agentes** para evitar repetição. **Não** é para bugs de produto (esses vão em issues/spec).

### 5.1 Três gatilhos

| #     | Gatilho                   | Quem dispara | Quando                                                                                                                                                            |
| ----- | ------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Retrospectiva de spec** | Agente       | Ao concluir Fluxo 5, **antes** de marcar `[x]` no roadmap, pergunte ao humano: _"Algo neste fluxo precisou de correção sua que valha registrar como postmortem?"_ |
| **2** | **Padrão repetido**       | Agente       | Quando o humano te corrigir 2x sobre o mesmo tema, sugira: _"Notei que você me corrigiu sobre X antes — quer registrar como postmortem?"_                         |
| **3** | **Correção espontânea**   | Humano       | A qualquer momento. Receba sem defensividade e registre.                                                                                                          |

### 5.2 Loop de melhoria

```
1ª ocorrência → postmortem (registra histórico)
       ↓
2ª ocorrência → vira regra em AGENTS.md (na seção pertinente)
       ↓
3ª+ ocorrência → considere caso formal em evals/cases/
```

### 5.3 Formato

Veja `docs/agent-postmortems.md` para o template de cada entrada.
Entradas mais recentes ficam **no topo**.

---

## 6. Personas e Especialização

> ⚠️ **Não use** "atue como Security Engineer" ou "seja paranoico". Persona switching degrada output.

Em vez disso, ao trabalhar em contextos sensíveis, **consulte a seção pertinente da `ARCHITECTURE.md` e siga os checklists**:

| Contexto de edição           | Onde consultar                               |
| ---------------------------- | -------------------------------------------- |
| Auth / RBAC / Middleware     | `ARCHITECTURE.md` §5 (Segurança)             |
| UI / Componentes / UX        | `ARCHITECTURE.md` §7 (Diretrizes de Design)  |
| DevOps / Deploy / Migrations | `ARCHITECTURE.md` §6 (DevOps)                |
| Banco de Dados / Schema      | `ARCHITECTURE.md` §4.2 + `design.md` do spec |

Restrições explícitas > papéis fictícios.

---

## 7. Convenções Universais

- **Princípio de documentação:** documente o que código **não pode expressar** — WHY de decisões, alternativas rejeitadas, contratos de negócio, trade-offs aceitos. **Não duplique** o que schema, schemas Zod, JSX/HTML ou testes já dizem fielmente. Doc que repete código vira mentirosa quando código muda — e ninguém atualiza. Regra prática: se a pergunta é _"o que o código faz?"_, leia o código. Se a pergunta é _"por que decidimos assim?"_ ou _"o que **não** está aí e por quê?"_, leia a doc.
- **Documentação:** PT-BR (comentários, commits, docs)
- **Código:** inglês, `camelCase`
- **Commits — formato:** `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `perf:`, `build:`, `ci:` + descrição em PT-BR. Escopo opcional entre parênteses (`feat(auth): ...`).
- **Commits — granularidade:** **um commit = uma unidade lógica validada pelo gate aplicável da seção "Regras Inegociáveis".** No modo PLANEJADO (specs MÉDIO/GRANDE), 1 commit por bloco do `plan.md`. No modo SIMPLES (spec PEQUENO), 1 commit por RN ciclada (red→green+refactor) quando o spec tem ≥3 RNs; commit único só é aceitável se 1-2 RNs. Em mudança executável, **nunca** commite com `lint`/`build`/`test` falhando — isso quebra `git bisect` e a propriedade de retomada.
- **Commits — fluxo solo vs multi-dev:** projetos solo + agente IA podem adotar **commit direto em `main`** (sem feature branches) como decisão consciente — desde que: (a) gates verdes garantidos por bloco; (b) `git bisect` continua viaável pela granularidade. Trade-off aceito: PR-para-si-mesmo não paga. Projetos multi-dev devem usar branches + PR — essa decisão vai em ADR no início do projeto.
- **Commits — push:** push para `origin/main` ao final de cada fluxo (`/especificar`, `/implementar`, `/promover`, etc.) ou após pausa significativa. Não acumular >1 dia de commits locais sem push (risco de perda + invisibilidade).
- **`plan.md` — quando criado:** vai no **mesmo commit do primeiro bloco** implementado (não em commit órfão prévio). Mensagem: `feat($ID): bloco A — [resumo] + plano de implementação`. Em commits subsequentes, atualizações do `plan.md` (marcar bloco como `[x]`) vão junto com o commit do próprio bloco — nunca commit só do plan.
- **Proibido:** `alert()`, `confirm()` nativos do JavaScript
- **Validação externa:** Zod sempre (forms, APIs, webhooks)
- **JSDoc:** apenas para WHY não-óbvio. Nome autoexplicativo > comentário verboso.
- **Não escreva comentários óbvios** (que apenas reformulam o que o código diz).
- **Ambiente nunca muda por edição de código** — só via env vars / scripts de build da stack. Editar código pra trocar de dev↔prod é violação.
- **`.env*` nunca no Git** — apenas `.env.example` versionado. Validar `.gitignore` antes do primeiro commit.
- **Deploy de produção exige confirmação interativa** via `scripts/confirm-prod-deploy.sh <nome-projeto-prod>` encadeado ao comando real de deploy. Sem isso, deploy prod é bloqueado.

---

## 8. Slash Commands Disponíveis

O projeto disponibiliza comandos automatizando os fluxos do `ReadME_WorkfloProposto.md`. **Fonte única:** `oria-orquestrador-ia/prompts/*.md` (portável entre ferramentas).

| Comando              | Cobertura                                                                                 | Argumento                                                                          | Wrapper                                                        |
| -------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `/iniciar`           | Fluxo 0 + 1 (setup + arquitetura)                                                         | —                                                                                  | `.claude/commands/iniciar.md`, `.gemini/commands/iniciar.toml` |
| `/roadmap`           | Fluxo 2 + 3 (brainstorm + backlog)                                                        | —                                                                                  | idem                                                           |
| `/especificar [ID]`  | Fluxo 4 (diagnóstico técnico, descoberta socrática, benchmarking e spec completo ou lite) | ID do item (opcional `--lite` como preferência, sujeita às proteções obrigatórias) | idem                                                           |
| `/implementar [ID]`  | Fluxo 5A (TDD-leve)                                                                       | ID do spec aprovado                                                                | idem                                                           |
| `/retrospectiva`     | Registro de postmortem                                                                    | —                                                                                  | idem                                                           |
| `/postmortem`        | **Alias** de `/retrospectiva` — mais ergonômico para gatilho 3 espontâneo                 | —                                                                                  | aponta para o mesmo prompt                                     |
| `/ideia [desc]`      | Fluxo 6.1 (captura em 💡 sem desviar)                                                     | descrição (texto livre)                                                            | idem                                                           |
| `/promover [titulo]` | Fluxo 6.2 (ideia 💡 → Backlog com ID)                                                     | título da ideia (opcional)                                                         | idem                                                           |
| `/grooming`          | Fluxo 6.3 (diagnóstico assistido do backlog)                                              | `--ideias` ou `--backlog` (opcional)                                               | idem                                                           |

**Quando invocado**, a **primeira ação obrigatória** é abrir e ler integralmente `oria-orquestrador-ia/prompts/[nome].md`. Só então execute — passo a passo e na ordem descrita no arquivo. **Nunca interprete o nome do comando como um resumo semântico do que fazer.** O comportamento correto está no arquivo, não no nome.

> ⛔ **Violação crítica:** iniciar qualquer trabalho (pesquisa, edição de arquivo, execução de comando) antes de ter lido o prompt completo é uma falha de protocolo — mesmo que o agente "saiba" o que o comando faz.

**Se a ferramenta não suportar slash commands** (Codex, ChatGPT, Cursor, Aider): leia/execute o arquivo `oria-orquestrador-ia/prompts/[nome].md` diretamente quando o humano pedir.

**Edição de comportamento:** regras universais e limites vivem em `AGENTS.md`; a sequência detalhada dos fluxos vive em `oria-orquestrador-ia/prompts/*.md`. Nunca duplique lógica nos wrappers.

---

## 9. Modo de Trabalho com o Humano (PM)

O humano é **orquestrador**, não revisor de código. Seu trabalho como agente é facilitar isso:

1. **Sempre proponha plano antes de codar** em tarefas com mais de 3 arquivos afetados.
2. **Use a Socratic Gate em batches lógicos:** na especificação, faça **3-6 perguntas de descoberta de produto agrupadas por bloco**, não 1-a-1, e preserve o benchmarking do domínio. Para cada pergunta com caminho dominante, apresente recomendação default que o PM possa aprovar em massa ou contestar pontualmente. O agente analisa a complexidade técnica, explica impactos didaticamente e deriva design/testes; o PM decide modalidade, contrato de produto, UI e exceções com consequência de produto, arquitetura, risco, custo ou escopo. `design.md` e `tests.md` não exigem aprovação isolada — são autorrevisados pelo agente e resumidos no gate final. Exceções que continuam 1-a-1: confirmações de ação destrutiva, decisões excepcionais, retrospectiva e aprovação final.
3. **Mostre evidência, não promessa:** "tests passing" precisa de output do CI; "build verde" precisa de output do comando.
4. **Em ações destrutivas** (delete, force-push, drop table, modificar produção): **sempre confirme antes**.
5. **Reporte progresso em pontos naturais**, não a cada arquivo. O humano não quer narração — quer marcos.

---

## 10. Roteamento de Agentes e Skills (Antigravity Kit)

> Este protocolo é **opcional mas obrigatório quando disponível**. Se `.agent/` não
> existir na raiz, ignore toda esta seção — os prompts são autossuficientes.
> Funciona em qualquer motor de IA (Claude, Gemini, GPT, Cursor, Aider, etc.).

> ⚠️ **No Claude Code, os agentes de `.agent/agents/` NÃO são subagent types nativos.**
> A ferramenta `Agent` do Claude Code só aceita um conjunto fixo de tipos (ex.:
> `general-purpose`, `Explore`, `Plan`) — `security-auditor`, `test-engineer`,
> `backend-specialist`, etc. **não existem** como tipo invocável e disparar
> `Agent(subagent_type: "security-auditor")` falha com _"Agent type not found"_.
> Os arquivos `.agent/agents/<nome>.md` são **personas em texto**, não executáveis.
> **Fallback obrigatório:** para usar um especialista, dispare `general-purpose` e
> **carregue a persona dentro do prompt** mandando o subagente ler
> `.agent/agents/<nome>.md` (+ as `SKILL.md` relevantes). O resultado é equivalente,
> pela porta certa. Em outros motores (Codex, Cursor, etc.) os tipos podem ser
> nativos — esta ressalva é específica do Claude Code.

### 10.1 Verificação de disponibilidade

No início de qualquer fluxo, verifique silenciosamente:

```bash
ls .agent/ARCHITECTURE.md 2>/dev/null && echo "kit disponível"
```

- **Existe** → execute os protocolos §10.2 a §10.7
- **Não existe** → prossiga com o prompt normalmente, sem reportar ao humano

### 10.2 Classificação do request (PASSO 1 — antes de qualquer ação)

Antes de agir, classifique o tipo de pedido e ajuste a profundidade de carregamento:

| Tipo de request            | Palavras-gatilho                                                | Ação com o kit                                      |
| -------------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| **Pergunta / Explicação**  | "o que é", "como funciona", "explica", "por que"                | Nenhum agente necessário — responda direto          |
| **Análise / Levantamento** | "analise", "liste", "visão geral", "overview"                   | `explorer-agent` se disponível                      |
| **Código simples**         | "corrija", "adicione", "mude" (1 arquivo)                       | 1 agente + skill base `clean-code`                  |
| **Código complexo**        | "implemente", "crie", "construa", "refatore"                    | Agente(s) completo(s) + skills do domínio detectado |
| **Design / UI**            | "design", "interface", "tela", "dashboard", "componente visual" | `frontend-specialist` obrigatório                   |
| **Fluxo da metodologia**   | `/especificar`, `/implementar`, `/roadmap`, etc.                | Protocolo §10.3 completo                            |

> Se o tipo for **Pergunta** ou **Análise simples**, pule diretamente para a Etapa 1 do prompt.
> Para todos os demais tipos, prossiga para §10.3.

### 10.3 Roteamento autônomo de agentes (PASSO 2)

**NÃO use lookup fixo.** O agente deve raciocinar:

1. **Analise silenciosamente** o request + conteúdo do spec/item do ROADMAP +
   `ARCHITECTURE.md` do projeto para detectar os domínios presentes:
   Frontend? Backend? Banco de dados? Auth/Segurança? Testes? Debug? Planejamento?

2. **Consulte `.agent/ARCHITECTURE.md`** — seção "Quick Reference" — para identificar
   qual agente cobre cada domínio detectado e quais skills ele utiliza.

3. **Leia o arquivo do agente** em `.agent/agents/[nome-do-agente].md`.

4. **Leia seletivamente os `SKILL.md`** — apenas das skills listadas no frontmatter
   do agente (`skills: ...`) que sejam relevantes para a tarefa atual.

   > ⚠️ Nunca leia todos os arquivos de uma pasta de skill. Leia `SKILL.md` (índice)
   > e depois apenas as seções que casam com o request.

5. **Um request pode ter múltiplos domínios** → carregue múltiplos agentes/skills.
   Ex: `/implementar` de feature com UI + API + schema → `frontend-specialist`
   - `backend-specialist` + `database-architect` em paralelo.

6. **Regra de conflito de projeto:**
   - App web (React, Next.js) → `frontend-specialist` (NUNCA `mobile-developer`)
   - App mobile (iOS, Android, RN, Flutter) → `mobile-developer` (NUNCA `frontend-specialist`)
   - API standalone → `backend-specialist` (sem frontend)

7. **Skill base universal:** `clean-code` é carregada em **qualquer** tarefa que
   envolva escrita ou revisão de código.

### 10.4 Formato de resposta ao usar agente (obrigatório)

Quando um agente for ativado, informe o humano de forma concisa antes de prosseguir:

```
🤖 Aplicando conhecimento de `@[nome-do-agente]`...
   Skills carregadas: [lista]

[continua com a resposta especializada]
```

**Regras:**

- Análise silenciosa: sem meta-comentários verbosos ("estou analisando o domínio...")
- Se o humano especificou `@agente` explicitamente, use esse — não substitua
- Para requests multi-domínio, liste todos os agentes ativados em uma linha

### 10.5 Checklist obrigatório antes de qualquer código ou design

Antes de escrever a primeira linha de código ou criar qualquer arquivo de UI,
responda mentalmente:

- [ ] Identifiquei o(s) domínio(s) da tarefa atual?
- [ ] Consultei `.agent/ARCHITECTURE.md` para encontrar o agente correto?
- [ ] Li o arquivo `.agent/agents/[agente].md`?
- [ ] Li os `SKILL.md` relevantes (seletivamente, não todos)?
- [ ] Sei o PORQUÊ dos princípios que vou aplicar — não só o COMO?
- [ ] Anunciei para o humano qual expertise estou aplicando (§10.4)?

> Se qualquer item estiver desmarcado → PARE. Complete o item antes de prosseguir.
> Escrever código sem identificar o agente = violação de protocolo.

### 10.6 Regras universais complementares (sempre ativas com o kit)

#### Leitura de dependências de arquivo

Antes de modificar **qualquer** arquivo quando o kit estiver disponível:

1. Identifique arquivos que importam ou dependem do arquivo a modificar
2. Atualize todos os arquivos dependentes na mesma operação
3. Nunca modifique um arquivo em isolamento se há dependentes conhecidos

#### Read → Understand → Apply (obrigatório)

```
❌ ERRADO: Leu o arquivo do agente/skill → começou a codar
✅ CORRETO: Leu → Entendeu o PORQUÊ dos princípios → Aplicou com julgamento → Codou
```

Antes de codar, responda:

1. Qual é o OBJETIVO deste agente/skill?
2. Quais PRINCÍPIOS devo aplicar?
3. Como isso DIFERE de uma resposta genérica?

### 10.7 Socratic Gate — quando parar e perguntar antes de agir

Este protocolo **complementa** o §9 adicionando gatilhos específicos para o
contexto de uso de agentes/skills:

| Tipo de request                 | Estratégia              | Ação obrigatória                                              |
| ------------------------------- | ----------------------- | ------------------------------------------------------------- |
| **Nova feature / Build**        | Descoberta profunda     | Faça mínimo 3 perguntas estratégicas antes de ativar agentes  |
| **Edição de código / Bug**      | Verificação de contexto | Confirme entendimento + pergunte sobre impacto antes de codar |
| **Request vago**                | Clarificação            | Pergunte Propósito, Usuários e Escopo                         |
| **Multi-agente / Orquestração** | Porteiro                | PARE sub-agentes até humano confirmar o plano                 |

**Protocolo:**

1. Nunca assuma: se 1% for ambíguo, pergunte primeiro
2. Mesmo com lista de respostas fornecida: pergunte sobre trade-offs ou edge cases
3. Não invoque agentes/skills até o humano liberar o gate
4. Em requests claramente bem definidos (ex: spec completo aprovado): pule o gate

### 10.8 Degradação graciosa

- Se `.agent/` não existe: ignore silenciosamente §10.2 a §10.7. Não reporte ao humano.
- Se o engine não tem acesso a arquivos: idem.
- Se uma skill não existe no kit local: use conhecimento paramétrico do modelo, sem avisar.
- O prompt é **sempre autossuficiente** — o kit é enriquecimento, não dependência.

---

**Versão do AGENTS.md:** 1.0.0
**Última atualização:** [DATA]
