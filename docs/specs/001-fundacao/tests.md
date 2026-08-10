# ✅ Tests: Fundação — monorepo, Next.js 15, Supabase local e CI

**Spec:** [`spec.md`](./spec.md)
**Design:** [`design.md`](./design.md)
**Status:** Aprovado · 2026-08-10

> 📌 **Contrato executável.** O módulo está pronto quando TODOS os cenários passam.
> Testes são escritos **ANTES** da implementação (`AGENTS.md` §3.2).

**Onde cada cenário vive:**

| Categoria | Ferramenta | Local |
|---|---|---|
| RLS, políticas, trigger | pgTAP (`supabase test db`) | `supabase/tests/` |
| Regras puras e helper de tempo | Vitest | `packages/core/src/*.test.ts` |
| Fronteiras, drift, versões | Script no CI | `.github/workflows/ci.yml` |

---

## Categoria A — Cenários funcionais

### T1 — Banco local reproduzível do zero
*Cobre: RN4*
```gherkin
DADO um clone limpo do repositório com Docker ativo
QUANDO executo `supabase db reset`
ENTÃO o schema é recriado apenas a partir de `supabase/migrations/`
E o seed cria os usuários determinísticos de cada role
```

### T2 — Aplicação sobe e prova a cadeia completa
*Cobre: RN5*
```gherkin
DADO o banco local rodando e as variáveis de ambiente válidas
QUANDO executo `pnpm dev` e abro a página inicial
ENTÃO a página exibe a hora vinda do Postgres
```

### T3 — Helper de tempo respeita America/Sao_Paulo
*Cobre: RN6*
```gherkin
DADO um instante UTC em 2026-08-10T02:30:00Z
QUANDO chamo `hojeEmBrasilia()`
ENTÃO recebo 2026-08-09
```

<!-- expandir: horário de verão foi extinto no Brasil em 2019, mas datas históricas e bibliotecas desatualizadas ainda podem aplicar offset errado — o teste fixa o contrato -->
### T4 — Helper não varia com o fuso da máquina
*Cobre: RN6*
```gherkin
DADO a variável TZ do processo configurada como "America/New_York"
QUANDO chamo `hojeEmBrasilia()` para o mesmo instante do T3
ENTÃO recebo 2026-08-09
E o resultado é idêntico ao obtido com TZ="UTC"
```

---

## Categoria B — Cenários de validação

### T5 — Aplicação recusa iniciar sem variável obrigatória
*Cobre: RN5*
```gherkin
DADO um ambiente sem `SUPABASE_SERVICE_ROLE_KEY`
QUANDO a aplicação inicia
ENTÃO o processo falha na inicialização
E a mensagem nomeia explicitamente a variável ausente
```

### T6 — Núcleo puro rejeita dependência proibida
*Cobre: RN7*
```gherkin
DADO um import de `react` ou `@supabase/supabase-js` dentro de `packages/core`
QUANDO o lint executa
ENTÃO a regra de fronteira reprova com erro
```

### T7 — Tipos gerados fora de sincronia reprovam
*Cobre: RN9*
```gherkin
DADO uma migration nova sem regeneração dos tipos
QUANDO o CI executa o passo de verificação de drift
ENTÃO o job falha indicando o comando de regeneração
```

### T8 — Versões de runtime são fixadas
*Cobre: RN10*
```gherkin
DADO o repositório com `.nvmrc` e o campo `packageManager`
QUANDO o CI prepara o ambiente
ENTÃO usa exatamente as versões declaradas
E instalar com outro gerenciador de pacote falha
```

---

## Categoria C — Cenários de segurança

*Obrigatória: este spec estabelece o modelo de acesso do projeto inteiro.*

```gherkin
Background:
  DADO o schema aplicado pelas migrations
  E os usuários de seed: um `cliente`, um segundo `cliente` e um `admin`
```

### T9 — Nenhuma tabela sem proteção
*Cobre: RN1*
```gherkin
QUANDO executo `tests.rls_enabled('public')`
ENTÃO todas as tabelas do schema têm RLS habilitada
E cada uma possui ao menos uma política declarada
```

> Este é o cenário mais importante do spec: ele continua valendo para tabelas que **ainda não existem**, criadas em NAPO-002 a NAPO-009.

### T10 — Cliente não enxerga dado de outro cliente
*Cobre: RN1*
```gherkin
DADO que autentico como o primeiro cliente
QUANDO consulto `profiles` sem filtro
ENTÃO recebo apenas o próprio registro
```

### T11 — Usuário não promove a si mesmo
*Cobre: RN2*
```gherkin
DADO que autentico como cliente
QUANDO tento atualizar a própria `role` para `admin`
ENTÃO o banco rejeita via trigger
E a role permanece `cliente`
```

<!-- expandir: escalada indireta é caminho distinto da tentativa direta do T11 e precisa de verificação própria -->
### T12 — Escalada indireta também é bloqueada
*Cobre: RN2*
```gherkin
DADO que autentico como cliente
QUANDO tento alterar a `role` de outro usuário
ENTÃO a operação não afeta nenhuma linha
E `is_admin()` retorna falso para este usuário
E a função tem `search_path` fixo, impedindo desvio por objeto homônimo
```

### T13 — Admin altera role, como esperado
*Cobre: RN2*
```gherkin
DADO que autentico como admin
QUANDO altero a role de um cliente para `cozinha`
ENTÃO a alteração é persistida
```

### T14 — Chave de serviço não alcança o browser
*Cobre: RN3*
```gherkin
DADO o build de produção da aplicação
QUANDO busco o valor de `SUPABASE_SERVICE_ROLE_KEY` nos bundles do cliente
ENTÃO nenhuma ocorrência é encontrada
```

### T15 — CI reprova o que viola as regras
*Cobre: RN8*
```gherkin
DADO um pull request com falha de typecheck, lint, teste ou migration
QUANDO o workflow executa
ENTÃO o job termina em falha
E o merge fica bloqueado
```

---

## Categoria D — Cenários não-funcionais

### T16 — Ambiente novo em até 15 minutos
*Cobre: KPI §2*
```gherkin
DADO uma máquina com Docker e Node instalados
QUANDO sigo o README do zero
ENTÃO chego à aplicação rodando em ≤ 15 minutos
```

### T17 — CI dentro do orçamento de tempo
*Cobre: KPI §2*
```gherkin
QUANDO o workflow roda em um pull request comum
ENTÃO conclui em ≤ 5 minutos
```

---

## Categoria E — Cenários de borda

### T18 — Docker desligado falha de forma compreensível
*Cobre: Fluxo de exceção §4*
```gherkin
DADO o Docker Desktop parado
QUANDO executo `pnpm dev`
ENTÃO a mensagem instrui a iniciar o Docker e rodar `supabase start`
E a aplicação não tenta conectar em nenhum banco remoto
```

---

## Rastreabilidade RN → Cenário

| RN | Cenários |
|---|---|
| RN1 — RLS em toda tabela | T9, T10 |
| RN2 — role imutável pelo próprio usuário | T11, T12, T13 |
| RN3 — `service_role` fora do browser | T14 |
| RN4 — só migration versionada | T1 |
| RN5 — app não sobe sem env | T2, T5 |
| RN6 — helper único de fuso | T3, T4 |
| RN7 — `core` puro | T6 |
| RN8 — CI bloqueia merge | T15 |
| RN9 — tipos sincronizados | T7 |
| RN10 — versões fixadas | T8 |

**Cobertura: 10 de 10 RNs.**

---

## Checklist de Conclusão

*Marque `[x]` SOMENTE com evidência verificável.*

### Testes
- [ ] T1..T18 passam (`pnpm test` + `supabase test db` verdes)
- [ ] Cada RN do `spec.md` tem ≥1 teste correspondente

### Qualidade
- [ ] Lint verde (`pnpm lint`)
- [ ] Build verde (`pnpm build`) — **inclusive o bundle do cliente** (postmortem 2026-06-12)
- [ ] Sem `console.log` esquecidos
- [ ] Sem `TODO` sem ideia vinculada no ROADMAP

### Escopo
- [ ] Apenas arquivos do **Mapa de Impacto** (`design.md` §1) foram modificados
- [ ] Nenhuma tabela de domínio foi criada (produtos, pedidos, capacidade)
- [ ] Nenhum ambiente remoto foi provisionado ou publicado
- [ ] `package.json` só ganhou o que está em `design.md` §6.1

### Fechamento
- [ ] **Retrospectiva feita** (`AGENTS.md` §5.1)
- [ ] `ROADMAP.md` atualizado — item em **✅ Concluídos** com data
- [ ] `spec.md` com **Status: Concluído**
- [ ] **Push** para `origin/main` executado
