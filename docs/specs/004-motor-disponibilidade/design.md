# 🏗️ Design: Motor de disponibilidade (NAPO-004)

**Spec relacionado:** [`spec.md`](./spec.md)
**Testes relacionados:** [`tests.md`](./tests.md)

> 📌 Este documento define o **COMO** — focado em **DECISÕES**, não em restatement.
> Dono primário: **Agente / Tech Lead**. Respeita `ARCHITECTURE.md`.

---

## 1. Mapa de Impacto

| Arquivo / Módulo | Ação | Risco | Justificativa |
|---|---|---|---|
| `packages/core/src/disponibilidade/tipos.ts` | Criar | Médio | Contrato de entrada (snapshot) e saída do motor — a fronteira que mantém o núcleo puro |
| `packages/core/src/disponibilidade/cutoff.ts` | Criar | **Alto** | Derivação do cutoff e recuo por dia sem produção (RN1, RN2) |
| `packages/core/src/disponibilidade/janela.ts` | Criar | Médio | Horizonte de 2 semanas deslizantes e buffer pré-cutoff (RN4) |
| `packages/core/src/disponibilidade/capacidade.ts` | Criar | **Alto** | CTP/ATP, dois tetos e sub-teto de massa (RN6, RN7, RN8, RN9) |
| `packages/core/src/disponibilidade/index.ts` | Criar | Baixo | Barrel — expõe só o que a web consome |
| `packages/core/src/disponibilidade/*.test.ts` | Criar | Baixo | Vitest determinístico, 3 arquivos espelhando os módulos de regra |
| `packages/core/src/index.ts` | Modificar | Baixo | Reexporta o novo domínio |
| `packages/core/src/tempo.ts` | Modificar | Médio | Helper único de fuso (RN5). Ganha `instanteEmBrasilia`, `diaDaSemanaEmBrasilia` e `somarDias` — sem elas, o cutoff duplicaria lógica de fuso e violaria a própria RN5 |
| `supabase/migrations/0003_operacao_calendario.sql` | Criar | Médio | `config_operacao`, dias de entrega/produção, exceções + RLS |
| `supabase/migrations/0004_capacidade.sql` | Criar | **Alto** | `lotes`, `producao_planejada`, `reservas` + índices + RLS |
| `supabase/migrations/0005_reservar_capacidade.sql` | Criar | **Alto** | RPC transacional da reserva — o único lugar com garantia de atomicidade |
| `supabase/seed.sql` | Modificar | Baixo | Calendário inicial: entrega sexta, produção seg–sex |
| `supabase/tests/0003_calendario_rls_test.sql` | Criar | Médio | RLS das tabelas novas (RN1 da fundação continua valendo) |
| `supabase/tests/0004_reserva_concorrencia_test.sql` | Criar | **Alto** | Duas sessões disputando a última vaga — o teste que prova a RN11 |
| `apps/web/src/features/disponibilidade/services/snapshot.ts` | Criar | Médio | Lê o banco e monta o snapshot que alimenta o núcleo puro |
| `apps/web/src/features/disponibilidade/index.ts` | Criar | Baixo | Barrel da feature |
| `apps/web/app/api/disponibilidade/route.ts` | Criar | Médio | Contrato que NAPO-003 e NAPO-006 consomem |
| `apps/web/app/api/disponibilidade/reserva/route.ts` | Criar | **Alto** | Cria a reserva de 15 min via RPC |
| `packages/db/src/types.generated.ts` | Modificar | Baixo | Regenerado das migrations (RN9 da fundação — drift reprova o CI) |

> **19 linhas > 15.** Avaliado quebrar em duas specs e **descartado**: o motor sem as tabelas que ele lê não é verificável, e as tabelas sem o motor não entregam nada. O risco de tamanho é mitigado pelo plano de blocos (§7), que dá pontos de parada verificáveis — mesma decisão tomada em NAPO-001.

---

## 2. Decisões de Schema

### 2.1 Mudanças

- **`config_operacao` (singleton):** tetos, tempos e limites viram **linha de tabela, não variável de ambiente**. O gerente muda o teto de 30 sem deploy, e a mudança fica auditável (`ARCHITECTURE.md` §5.3 exige auditoria em capacidade). Guarda também `buffer_cutoff_min` e `reserva_minutos`.
- **`dias_semana_entrega` carrega a janela** (`janela_inicio`, `janela_fim`) em vez de uma janela global: quando a operação abrir o sábado, ele poderá ter horário diferente da sexta sem migration. Hoje só a sexta está ativa.
- **`excecoes_calendario`** com `data` como PK — um dia tem no máximo uma exceção. `tipo`: `sem_producao | sem_entrega | entrega_extra`.
- **`lotes` e `producao_planejada` entram apenas com o que o motor lê.** Sem `movimentos_estoque`, sem ajuste com motivo, sem FEFO — isso é NAPO-008. O que existe aqui é o suficiente para ATP (lote pronto) e CTP (produção já planejada).
- **`reservas`** com `expira_em`: a reserva **não tem job de expiração**. Toda leitura filtra `expira_em > now()`, então uma reserva morta é invisível no instante em que vence.

### 2.2 Alternativas de modelagem descartadas

- **A — Contador desnormalizado `vagas_usadas` por dia:** leitura barata. **Descartada porque** todo caminho que cria, cancela ou expira pedido teria de manter o contador em sincronia; um caminho esquecido corrompe silenciosamente a capacidade. A contagem derivada é sempre verdadeira.
- **B — `pg_cron` expirando reservas:** limpeza determinística. **Descartada porque** cria dependência de extensão e um job para o que um predicado na consulta resolve. Volta como housekeeping quando o volume justificar (§8).
- **C — Disponibilidade calculada em SQL (view ou função):** transacional e rápida. **Descartada porque** viola a decisão arquitetural central do projeto (`ARCHITECTURE.md` §3.2) e colocaria a regra que decide o que pode ser vendido em um lugar sem teste determinístico — e depois em dois, quando o bot (NAPO-015) precisasse dela.

### 2.3 Índices

- `reservas (dia_entrega) WHERE status = 'ativa'` — índice parcial; a consulta quente é "quantas reservas vivas neste dia".
- `lotes (produto_id, validade) WHERE ativo` — ordenação por validade é o acesso do ATP e prepara o FEFO do NAPO-008.
- `producao_planejada (data)` — leitura por dia no cálculo de `já_planejado`.
- Sem índice em campos de texto/motivo: não há busca textual neste spec.

### 2.4 Migration

- **Estratégia:** puramente aditiva, sem backfill e sem `drop`. Nenhuma tabela existente é alterada — `profiles` não é tocada.
- **Rollback:** `drop` das tabelas novas recupera o estado anterior; como não há dado de produção (NAPO-021 ainda não rodou), não há recuperação por backup a documentar.

---

## 3. Decisões de Contrato

### 3.1 Endpoints

- `GET /api/disponibilidade` — dias do horizonte com modo (CTP/ATP), cutoff e quantidade real por produto. Público (anon): é a vitrine.

### 3.2 Endpoints com decisão

#### `POST /api/disponibilidade/reserva`

- **Decisão:** rota dedicada, separada do checkout. **Motivo:** NAPO-006 (checkout do site) e NAPO-015 (bot) precisam da mesma reserva; embutir no fluxo de checkout obrigaria o bot a duplicar a regra.
- **Decisão:** a rota chama a RPC `reservar_capacidade`, que toma `pg_advisory_xact_lock` pelo dia de entrega e reconta dentro da transação. **Alternativa rejeitada:** isolamento `SERIALIZABLE` — correto, mas transforma disputa em tempestade de retry justamente no pico; e `UNIQUE constraint`, que não modela contagem.
- **Ponto sutil — a regra continua morando em um lugar só:** a RPC **não recalcula** disponibilidade. Ela recebe o limite já calculado pelo núcleo puro e apenas garante, sob lock, que a soma de reservas vivas e pedidos pagos não o ultrapasse. O banco garante atomicidade; o `packages/core` continua dono da regra.
- **Idempotência:** não — cada chamada é uma reserva nova. Repetição é limitada pelo hold ativo do mesmo cliente.
- **Auth:** sessão autenticada obrigatória (o checkout já exige login por decisão do R1). O limite passa pelo servidor, nunca pelo browser.
- **Erros:** `409` quando não há vaga no instante do lock — o cliente é informado **antes** de ir ao Mercado Pago.

### 3.3 Cache

`GET /api/disponibilidade` é **dinâmica** (`dynamic = 'force-dynamic'`), exceção declarada a `ARCHITECTURE.md` §4.5. Disponibilidade servida de cache é a definição de vender o que não existe (RN10). A página do catálogo continua SSG; só este dado é buscado em runtime.

---

## 5. Decisões Técnicas Gerais

- **Decisão:** o núcleo recebe um **snapshot** (configuração, calendário, lotes, produção planejada, reservas vivas) e devolve a disponibilidade; quem lê o banco é a feature na web.
  **Alternativa rejeitada:** `packages/core` consultando Supabase.
  **Motivo:** é a lei do projeto (`ARCHITECTURE.md` §3.2) e o que torna cada regra testável sem banco — cutoff em feriado, freezer estourando, massa saindo do catálogo viram testes de milissegundos.

- **Decisão:** exposição agregada — a API devolve **quantidade disponível**, nunca lotes.
  **Alternativa rejeitada:** devolver o array de lotes e deixar o front somar.
  **Motivo:** estoque por lote e validade é informação de operação; no browser vira dado de concorrente e superfície de inferência sobre o negócio.

- **Decisão:** RLS de `lotes`, `producao_planejada` e `reservas` restrita à equipe; `config_operacao` e calendário com leitura `anon`.
  **Motivo:** a vitrine precisa saber que sexta é dia de entrega; não precisa saber quantos lotes existem. O endpoint público lê o resto via servidor.

- **Decisão:** conflito de disponibilidade vira **estado do pedido**, não exceção lançada.
  **Alternativa rejeitada:** falhar o webhook do Mercado Pago.
  **Motivo:** o dinheiro já entrou. Falhar o webhook deixaria o pagamento sem pedido correspondente — o pior dos dois mundos. O pedido existe, marcado, e espera decisão humana (RN12).

---

## 6. Dependências Novas

### 6.1 Bibliotecas

- `vitest@^2.1.4` como **devDependency de `apps/web`** — o app não tinha runner, então T17 e T23 não teriam como existir. Não é biblioteca nova no projeto: `ARCHITECTURE.md` §2.3 já declara Vitest, que só estava em `packages/core`. Decidido com o PM em 2026-08-10.

---

## 7. Plano de Blocos

- [ ] **Bloco A — Calendário e configuração:** migration `0003`, seed, `supabase/tests/0003` · cobre T16 · ~50 min
- [ ] **Bloco B — Núcleo puro:** `tipos/cutoff/janela/capacidade` + Vitest · cobre T1–T14 · **paralelo a A** (não depende de banco) · ~90 min
- [ ] **Bloco C — Capacidade e reserva no banco:** migrations `0004`/`0005`, `supabase/tests/0004` · cobre T15, T18, T19 · depende de A · ~70 min
- [ ] **Bloco D — API e snapshot:** feature web + duas rotas · cobre T17, T20, T23 · depende de B e C · ~60 min
- [ ] **Bloco E — Verificação integrada:** cancelamento e lote liberado ponta a ponta, tipos regenerados, drift, gates · cobre T21, T22 · depende de D · ~40 min

```
A ─┬─→ C ─┐
   │      ├─→ D → E
B ─┴──────┘
```

---

## 8. Riscos Conhecidos

- **Risco:** a regra do "cabe?" existir em dois lugares se alguém acrescentar lógica de negócio na RPC.
  **Mitigação:** a RPC recebe o limite pronto e só conta (§3.2). Comentário no arquivo da migration declara isso.
  **Gatilho de revisão:** qualquer PR que adicione `if` de negócio em `reservar_capacidade`.

- **Risco:** reserva de 15 min segurando vaga de quem desistiu num dia lotado.
  **Mitigação:** `reserva_minutos` é configuração, não constante.
  **Gatilho:** se a taxa de reservas expiradas passar de ~30% das criadas.

- **Risco:** `reservas` cresce indefinidamente sem job de limpeza.
  **Mitigação:** expiração é lógica; linhas mortas não afetam correção, só tamanho.
  **Gatilho:** 50 mil linhas ou degradação visível na consulta do dia.

- **Risco:** teto de 30/dia é estimativa herdada da spec do R1.
  **Mitigação:** editável no admin desde o primeiro dia.
  **Gatilho:** duas semanas de operação real com o painel comparando vendido × produzido.

- **Risco:** rota dinâmica gera invocação por visita, contra a restrição de custo de `ARCHITECTURE.md` §4.5.
  **Mitigação:** uma consulta por página cobre todos os produtos do horizonte; resposta pequena.
  **Gatilho:** invocações de `/api/disponibilidade` aparecendo como item relevante na fatura da Vercel.
