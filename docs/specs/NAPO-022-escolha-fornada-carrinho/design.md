# 🏗️ Design: Escolha de fornada no carrinho (NAPO-022)

**Spec relacionado:** [`spec.md`](./spec.md)
**Testes relacionados:** [`tests.md`](./tests.md)

> 📌 Este documento define o **COMO** — focado em **DECISÕES**, não em restatement.
> Para regras de negócio veja `spec.md`. Para validação veja `tests.md`.
> Dono primário: **Agente / Tech Lead**.
> Deve respeitar rigorosamente o que está em `ARCHITECTURE.md`.

> ⚠️ **Princípio guia (AGENTS.md §7):** documente o que código **não pode expressar** —
> WHY de decisões, alternativas rejeitadas, trade-offs. **Não duplique** o que
> `schema.prisma`, schemas Zod, tipos TypeScript, JSX ou testes já dizem fielmente.
> Se a seção abaixo está virando uma cópia do que o código vai ter de qualquer jeito,
> **omita-a ou troque por uma decisão de WHY**.

---

## 1. Mapa de Impacto

*Fonte única para descobrir o que vai ser tocado. Arquivos fora desta tabela **não devem** ser modificados sem aprovação explícita (regra `AGENTS.md` §2.6).*

> ⚠️ **Estrutura obrigatória (regra `AGENTS.md` §2.10):** todo arquivo **novo** listado abaixo deve viver num caminho previsto pela seção **"Arquitetura de Código"** do `ARCHITECTURE.md` (modular por domínio, feature-based, ou o padrão que esse projeto adotou). Se você precisar criar uma pasta ou módulo que não se encaixa nessa estrutura, **PARE** — escale como pré-requisito de ADR antes de continuar o spec.

| Arquivo / Módulo | Ação | Risco | Justificativa |
|---|---|---|---|
| `packages/core/src/carrinho/dia.ts` | Modificar | Médio | Nova função pura `validarDiaCandidato` (RN1-RN3): valida um dia escolhido pelo cliente contra `diaDerivado` + disponibilidade de todos os itens, sem duplicar a lógica de cutoff (reaproveita `DisponibilidadeDia[]` já calculado). |
| `packages/core/src/carrinho/dia.test.ts` | Modificar | Baixo | Testes unitários da nova função (antecipação bloqueada, item sem vaga, dia fora do horizonte, sucesso). |
| `packages/core/src/carrinho/index.ts` | Modificar | Baixo | Exporta `validarDiaCandidato` e o tipo `ResultadoDiaCandidato`. |
| `apps/web/src/features/pedidos/schema.ts` | Modificar | Médio | Novo campo opcional `diaCandidato` em `validarCarrinhoSchema` e `criarPedidoSchema` (ambos `.strict()` — precisa declaração explícita). |
| `apps/web/src/features/pedidos/services/criar-pedido.ts` | Modificar | Alto | `revalidarCarrinho` passa a aceitar `diaCandidato` opcional, calcula `opcoesDia` (chips selecionáveis) e expõe `candidatoInvalido`; `criarPedido` rejeita a criação (não faz fallback silencioso) se o `diaCandidato` enviado deixou de ser válido. |
| `apps/web/src/features/pedidos/carrinho-view.ts` | Modificar | Baixo | Renomeia `dia` → `diaDerivado`/`diaEscolhido` na vista e expõe `opcoesDia` para o novo seletor. |
| `apps/web/src/features/pedidos/checkout-view.ts` | Modificar | Baixo | Novo caso em `interpretarRespostaPedido` para o erro `dia_candidato_invalido`. |
| `apps/web/app/api/carrinho/validar/route.ts` | Modificar | Baixo | Repassa `diaCandidato` do corpo; resposta ganha `diaDerivado`, `diaEscolhido`, `opcoesDia`, `candidatoInvalido`. |
| `apps/web/app/api/pedidos/route.ts` | Modificar | Médio | Mapeia o novo erro `dia_candidato_invalido` (`409`) com `motivo` e `itensSemVaga`. |
| `apps/web/src/features/pedidos/components/lista-carrinho.tsx` | Modificar | Médio | Renderiza `<SeletorDiaCarrinho>` no card "Entrega" da sidebar; envia `diaCandidato` selecionado na revalidação. |
| `apps/web/src/features/pedidos/components/seletor-dia-carrinho.tsx` | Criar | Baixo | Novo componente de chips de data (ver §4). |
| `apps/web/src/features/pedidos/components/checkout-cliente.tsx` | Modificar | Médio | Repassa `diaCandidato` (guardado desde o carrinho) na revalidação e na criação do pedido; exibe aviso se o candidato deixou de servir entre carrinho e checkout. |
| `apps/web/src/features/pedidos/components/resumo-pedido.tsx` | Reutilizar | Baixo | Já recebe `dia` como prop — só passa a receber `diaEscolhido` no lugar (mesma forma). |
| `apps/web/src/features/pedidos/index.ts` | Modificar | Baixo | Barrel: exporta o novo componente e tipos que mudarem de nome. |

**Convenções:**
- **Reutilizar** = arquivo é lido/importado mas não modificado — listar para evidenciar a dependência.
- **Risco Alto** = mudança em arquivo compartilhado por múltiplos módulos, migration destrutiva, ou efeito em auth/RBAC.

> §2 (Decisões de Schema) omitida — **nenhuma mudança de banco**. `pedidos.dia_entrega` já existe (NAPO-006); o dia escolhido pelo cliente é só uma variação de *qual* dia entra nessa mesma coluna, validada antes de chegar em `reservar_carrinho`.

---

## 3. Decisões de Contrato (API / Server Actions)

### 3.1 `packages/core` — nova função pura

```ts
export type ResultadoDiaCandidato =
  | { ok: true; dia: DiaDoPedido }
  | { ok: false; motivo: 'antecipacao_nao_permitida' }
  | { ok: false; motivo: 'dia_fora_do_horizonte' }
  | { ok: false; motivo: 'sem_vaga'; itensSemVaga: string[] };

function validarDiaCandidato(
  diaCandidato: string,
  itens: ItemCarrinho[],
  diaDerivado: DiaDoPedido,
  dias: DisponibilidadeDia[],
): ResultadoDiaCandidato
```

- **Decisão:** reaproveita o mesmo `DisponibilidadeDia[]` que `resolverDiaDoPedido` já recebe (produzido por `calcularDisponibilidade`), em vez de chamar `avaliarViabilidade` (que recalcula disponibilidade internamente a partir do `snapshot`). Um dia cujo cutoff já passou não precisa de um branch especial: `calcularDisponibilidade` já reduz `disponivel` ao estoque pronto (`modo: 'ATP'`) nesse caso, então "cutoff vencido" aparece naturalmente como `sem_vaga` para itens que dependem de produção futura — a regra de cutoff não é duplicada.
- **`dia_fora_do_horizonte`:** só ocorre se o cliente mandar uma data que nem consta no horizonte calculado (entrada corrompida/manipulada) — defesa em profundidade, não fluxo esperado pela UI.
- **`antecipacao_nao_permitida`:** checagem trivial `diaCandidato < diaDerivado.data` (RN2 — nunca antecipar).

### 3.2 `POST /api/carrinho/validar`

- **Decisão:** aceita `diaCandidato?: string` no corpo (mesmo formato `YYYY-MM-DD` já usado). Resposta troca o antigo campo único `dia` por:
  - `diaDerivado` — o dia padrão (mesmo que hoje).
  - `diaEscolhido` — `diaDerivado` OU o candidato, se válido. É o que a UI usa para mostrar preço/frete/"vaga".
  - `opcoesDia: { data: string; disponivelParaTodos: boolean }[]` — dias do horizonte ≥ `diaDerivado.data`, cada um já resolvido contra `validarDiaCandidato` (o cliente nunca decide isso sozinho — só o servidor sabe se caberia).
  - `candidatoInvalido: { motivo: string; itensSemVaga?: string[] } | null` — preenchido só quando um `diaCandidato` foi enviado e deixou de servir; a UI usa para mostrar o aviso e voltar o seletor para `diaDerivado` (fluxo de exceção do `spec.md` §5).
- **Por que não quebrar o front em dois passos:** o carrinho é editado em tempo real (RN1 do NAPO-006); expor `opcoesDia` já resolvidas evita uma segunda rodada de chamadas para "descobrir se dá" a cada clique num chip.

### 3.3 `POST /api/pedidos`

- **Decisão:** `criarPedidoSchema` ganha o mesmo `diaCandidato?: string`. Diferente do `/validar`, aqui a resposta a um candidato inválido é **rejeição dura** (novo erro `dia_candidato_invalido`, HTTP `409`, com `{ motivo, itensSemVaga? }`) — nunca um fallback silencioso para `diaDerivado`. O cliente confirmou pagamento para um dia específico; se ele não existe mais, a decisão de qual dia aceitar é dele de novo, não do servidor (mesmo princípio de "nunca ajusta por conta própria" do `spec.md` RN3).
- **Alternativa rejeitada:** fazer `criarPedido` cair de volta para `diaDerivado` automaticamente quando o candidato falha. Rejeitada porque cobraria/reservaria um dia diferente do que o cliente viu na tela de confirmação, sem consentimento.

### 3.4 Endpoints inalterados no contrato

- `GET /api/pedidos/:numero`, `POST /api/pedidos/:numero/cancelar` — sem mudança; o dia gravado no pedido já reflete o resultado desta validação, então nada muda depois de criado.

---

## 4. Decisões de UI

### 4.1 Auditoria de Reuso (OBRIGATÓRIA — antes de qualquer componente novo)

| Elemento | Decisão | Componente alvo | Justificativa |
|---|---|---|---|
| Chips de data (dia derivado + opções seguintes) | ✨ **CRIAR NOVO** | `<SeletorDiaCarrinho>` em `apps/web/src/features/pedidos/components/` | O catálogo já tem `<SeletorFornada>` (vitrine, NAPO-004) com o mesmo *padrão visual* de chips, mas a *fonte de dados e a regra* são outras: a vitrine escolhe disponibilidade de 1 produto por página; aqui é a interseção de todos os itens do carrinho (`opcoesDia` do §3.2), calculada só no servidor. Reaproveitar o componente acoplaria o carrinho ao contexto de `disponibilidade-provider` da vitrine, que não existe fora de uma página de produto — só o estilo visual é reaproveitado (ver 4.1.1). |
| Card "Entrega" (dia ativo, no topo da sidebar) | ♻️ **REUSAR** | já existe em `lista-carrinho.tsx` | mesmo card, só ganha o seletor logo abaixo |
| Aviso "esse dia não serve mais" | ♻️ **REUSAR** | card de aviso `border-amarelo/50 bg-amarelo/5` (mesmo padrão de `AvisoResultado`/`ItemEsgotado`) | padrão de card de aviso persistente já existe e é o correto (nunca toast, critério visual 6 do NAPO-006) |
| Botão "usar este dia" dentro do checkout (se o candidato do carrinho não foi repassado) | ♻️ REUSAR | `<Button variant="ghost" size="sm">` | ação secundária pontual, já coberta pela variante existente |

#### 4.1.1 Reaproveitamento de estilo (não de componente)

`<SeletorDiaCarrinho>` copia as classes Tailwind dos chips do `<SeletorFornada>` (`rounded-campo`, estado ativo `bg-amarelo text-preto`, estado inativo `border-borda-forte`) para manter consistência visual entre as duas telas — mas é um componente próprio porque:
1. Recebe `opcoesDia` (já resolvidas pelo servidor) em vez de consultar um provider de disponibilidade;
2. Cada chip pode estar **desabilitado** (`disponivelParaTodos: false`) — estado que `<SeletorFornada>` não tem, pois lá todo dia do horizonte é sempre clicável;
3. Não governa a página inteira (é local ao carrinho/checkout), diferente do `<SeletorFornada>` que muda o `dataAtiva` global da vitrine.

### 4.2 Composição (wireframe)

```
┌─────────────────────────────────────┐
│ aside (sidebar do carrinho)         │
│ ┌─────────────────────────────────┐ │
│ │ ENTREGA                         │ │
│ │ sexta-feira, 12 de abril        │ │
│ │ É a primeira fornada que assa   │ │
│ │ todos os seus sabores.          │ │
│ │                                 │ │
│ │ Quer esperar mais um pouco?     │ │
│ │ [12 abr ✓] [19 abr] [26 abr ✗]  │ │  ← <SeletorDiaCarrinho>
│ └─────────────────────────────────┘ │
│                                     │
│ Subtotal ............... R$ 129,70 │
│ Frete .......... no próximo passo  │
│ [Finalizar pedido]                 │
└─────────────────────────────────────┘
```

*Um chip desabilitado (ex.: "26 abr ✗") é visualmente apagado e não clicável — o servidor já decidiu que não cabe, sem precisar o cliente tentar para descobrir.*

### 4.3 Estados visuais

| Região / Componente | default | loading | empty | error | success |
|---|---|---|---|---|---|
| `<SeletorDiaCarrinho>` | chip do dia derivado ativo + chips seguintes (habilitados/desabilitados conforme `opcoesDia`) | skeleton (mesmo padrão `animate-pulse` já usado no card "Entrega") | n/a — sempre há ao menos o dia derivado | candidato deixou de servir → some o aviso amarelo ("Esse dia encheu, voltamos para sexta-feira, 12 de abril") + chip volta a marcar o derivado | chip escolhido fica marcado (`bg-amarelo`) até nova mudança de carrinho |
| Card "Entrega" | mostra `diaEscolhido` | skeleton existente | — | — | — |

**Microcopy literal:**
- Convite acima dos chips: **"Quer esperar mais um pouco?"**
- Aviso de candidato inválido: **"Esse dia encheu enquanto você decidia — voltamos para [dia derivado formatado]."**
- Erro na criação do pedido (novo caso em `AvisoResultado`): **"O dia escolhido deixou de caber para [item(ns)] — escolha outra data ou remova o item."**

### 4.4 Preview Visual Aprovado

#### 4.4.1 Arquivo(s) de preview

- Caminho: `./preview.html`
- **Modelo:** Único (1 tela — card "Entrega" da sidebar do carrinho — em 4 estados na mesma página)
- **Mecanismo de preview:** HTML + Tailwind CDN (`@tailwindcss/browser@4`) + `@theme` espelhando `packages/ui/src/tokens.css`
- **Aprovado por:** PM (usuário da sessão) em 2025 (data da sessão de `/especificar` corrente)

#### 4.4.2 Componentes do catálogo usados

| Elemento da tela | Componente do catálogo | Origem | Decisão (§4.1) |
|---|---|---|---|
| Card "Entrega" (dia ativo) | já existe em `lista-carrinho.tsx` | feature `pedidos` | ♻️ REUSAR |
| Card de aviso amarelo (candidato caiu) | mesmo padrão visual de `AvisoResultado`/`ItemEsgotado` (`border-amarelo/50 bg-amarelo/5`) | feature `pedidos` | ♻️ REUSAR |
| Skeleton de loading | mesmo `animate-pulse` já usado no card "Entrega" | feature `pedidos` | ♻️ REUSAR |
| Botão "Finalizar pedido" | `<Button>` | `@napo/ui/components/button` | ♻️ REUSAR |

#### 4.4.3 Componentes novos a criar (com justificativa)

| Componente novo | Caminho destino | Por que existentes não servem |
|---|---|---|
| `<SeletorDiaCarrinho>` | `apps/web/src/features/pedidos/components/seletor-dia-carrinho.tsx` | Ver §4.1.1 — reaproveita só o estilo visual do `<SeletorFornada>` da vitrine; precisa de estado desabilitado por chip (`opcoesDia[].disponivelParaTodos`) e de fonte de dados própria (interseção de todos os itens do carrinho), que o componente da vitrine não tem. |

#### 4.4.4 Markup cru aceito

- Container do card "Entrega" (`div` com `rounded-campo border ...`) — já existe, layout/spacing puro.
- Fileira de chips com `overflow-x-auto` — layout puro, mesmo padrão do `<SeletorFornada>`.

#### 4.4.5 Critérios visuais de aceite

Ver seção "Critérios visuais de aceite" em `tests.md` deste spec.

### 4.5 Decisões de UX não-óbvias

- **Chips desabilitados vs. escondidos:** desabilitados (visíveis, cinza, sem clique) em vez de sumir da lista — o cliente entende que a opção existe mas não cabe agora, em vez de estranhar por que só aparecem 2 datas.
- **Confirmação de "esse dia não serve mais" é card persistente, não toast** — segue o critério visual 6 já estabelecido no NAPO-006 (o cliente pode não estar olhando no instante exato).
- **`diaCandidato` viaja do carrinho até o checkout via o mesmo estado de carrinho local (`useCarrinho`)**, não via URL/query string — evita expor a escolha de dia como parâmetro manipulável na barra de endereço (mesmo princípio RN18 de nunca confiar em dado que decide preço/dia vindo do cliente sem revalidar).

### 4.6 Responsividade

*Segue o baseline da seção "UI & UX" do `ARCHITECTURE.md"` — sem decisão específica adicional (chips já usam `overflow-x-auto` no padrão do `<SeletorFornada>`).*

### 4.7 Acessibilidade

*Segue o baseline (`aria-pressed` nos chips, mesmo padrão do `<SeletorFornada>`; chip desabilitado usa `aria-disabled` + `disabled`).*

---

## 5. Decisões Técnicas Gerais

- **Decisão:** `validarDiaCandidato` reaproveita `DisponibilidadeDia[]` já calculado (mesmo parâmetro de `resolverDiaDoPedido`) em vez de aceitar `snapshot` e chamar `avaliarViabilidade` por item.
  **Alternativa rejeitada:** usar `avaliarViabilidade(diaCandidato, produtoId, quantidade, snapshot)` por item do carrinho.
  **Motivo:** evita recalcular `calcularDisponibilidade` N vezes (uma por item) dentro de uma função que já recebe o resultado pronto; e evita duas fontes de verdade para "o que é um dia viável" (uma via `Veredito` de `avaliarViabilidade`, outra via `DisponibilidadeDia.produtos[].disponivel`) — fica só uma.
- **Decisão:** `/api/pedidos` rejeita duro (`409 dia_candidato_invalido`) em vez de aceitar silenciosamente o `diaDerivado` quando o candidato falha.
  **Alternativa rejeitada:** fallback automático para o dia derivado na criação do pedido.
  **Motivo:** o cliente confirmou pagamento vendo uma data específica; mudar essa data sem novo consentimento violaria a mesma garantia que RN18 já dá para preço/frete (nada que afete o que o cliente está pagando muda sem ele ver e confirmar de novo).
- **Decisão:** `diaCandidato` trafega no corpo do POST (carrinho local via `useCarrinho`), nunca em query string.
  **Alternativa rejeitada:** `?entrega=YYYY-MM-DD` como o `<SeletorFornada>` da vitrine já usa.
  **Motivo:** lá a URL governa uma página pública sem custo (é só filtro de exibição); aqui decide o que vai ser cobrado/reservado — não deve ser um parâmetro copiável/compartilhável na barra de endereço.

---

## 7. Plano de Blocos

### Blocos

- [ ] **Bloco A — Núcleo (`packages/core`):** `dia.ts`, `dia.test.ts`, `index.ts` · cobre RN1-RN3 e os testes de `validarDiaCandidato` · ~30 min
- [ ] **Bloco B — Contrato (schema + serviço + rotas):** `schema.ts`, `criar-pedido.ts`, `checkout-view.ts`, `api/carrinho/validar/route.ts`, `api/pedidos/route.ts` · depende de A · ~45 min
- [ ] **Bloco C — UI (carrinho + checkout):** `seletor-dia-carrinho.tsx` (novo), `lista-carrinho.tsx`, `carrinho-view.ts`, `checkout-cliente.tsx`, `index.ts` · depende de B · ~45 min

### Grafo de dependências

```
A → B → C
```

*Sequencial (sem paralelismo real a declarar): B só faz sentido com a função de A já existindo; C consome o contrato de B. Ver `AGENTS.md` §2 item 9 — declarado aqui como execução sequencial, não paralela.*

---

## 8. Riscos Conhecidos

- **Risco:** o cliente escolhe um dia no carrinho, mas o carrinho muda (adiciona item) e o dia deixa de caber — se a UI não revalidar a cada mudança, o checkout pode tentar criar pedido com candidato já inválido.
  **Mitigação:** `diaCandidato` é sempre reenviado a cada `revalidarCarrinho` (já é o padrão existente para preço/vaga, RN1 do NAPO-006) — a checagem já roda a cada edição do carrinho, sem trabalho extra de UI.
  **Gatilho de revisão pós-deploy:** se aparecer reclamação de "pedido criado num dia que eu não escolhi", revisar se o candidato está de fato sendo repassado do carrinho para o checkout via `useCarrinho`.

- **Risco:** `opcoesDia` pode ficar com poucas datas "habilitadas" se o horizonte configurado for curto, dando a impressão de bug ("só tem uma opção").
  **Mitigação:** fora do escopo deste spec resolver tamanho de horizonte (é config de `config_operacao`, RN13 do NAPO-004) — comportamento esperado, não regressão.
  **Gatilho de revisão pós-deploy:** se o time de produto perceber baixo uso do recurso, investigar se é falta de horizonte antes de investigar bug de UI.

---

## Seções omitidas

- §2 (Decisões de Schema) — sem mudança de banco.
- §6 (Dependências Novas) — nenhuma biblioteca/env var nova.
- §4.6/§4.7 — seguem o baseline da seção "UI & UX" do `ARCHITECTURE.md`, sem decisão específica adicional.
