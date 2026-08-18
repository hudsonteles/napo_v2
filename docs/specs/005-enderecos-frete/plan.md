# Plano de Implementação — NAPO-005 Endereços e frete por faixa de distância

**Spec:** [`spec.md`](./spec.md) · **Design:** [`design.md`](./design.md) · **Tests:** [`tests.md`](./tests.md)
**Tamanho detectado:** GRANDE
**Critério:** N_arquivos=27, N_testes=27, sensitivo=SIM (PII de localização, RLS, chaves de API)
**Plano criado em:** 2026-08-18
**Modo de execução:** com checkpoints (aprovado pelo PM em 2026-08-18 — paradas após A, F e G)

---

## Stack (derivada de ARCHITECTURE.md)

`TypeScript strict · Next.js 15 App Router · Supabase (Postgres + Auth + RLS) · pnpm workspaces · Vitest + pgTAP · Tailwind v4 + shadcn em packages/ui · Zod · Vercel`

Regra de dependência ativa: `packages/core` é TS puro (sem React, sem Supabase, sem HTTP).

## Agentes elegíveis (após fitness)

- ✅ Elegíveis: `database-architect` (A), `security-auditor` (A, F), `backend-specialist` (D, E, F), `frontend-specialist` (G, H), `test-engineer` (todos)
- ❌ Não elegíveis: `mobile-developer` (web puro), `seo-specialist` (área logada, `noindex`), `devops-engineer` (sem pipeline novo)
- 🟡 Com ressalva: `frontend-specialist` tem opiniões fortes contra shadcn; aqui o catálogo shadcn de `packages/ui` é mandatado por `ARCHITECTURE.md` §2.2 e **vence** — o agente entra pela camada de composição e acessibilidade, não pela escolha de biblioteca.

**Paralelismo (AGENTS.md §2.9):** os pares A‖B e (nada mais) são disjuntos, mas a execução será **sequencial em agente único** — este ambiente não dispara subagentes sem pedido explícito do PM. O grafo abaixo registra a ordem real.

---

## Ajustes ao Mapa de Impacto

Itens declarados no `design.md` §4.4.3 / §6.1 mas ausentes da tabela §1 — completude, não escopo novo:

| Arquivo | Origem da autorização |
|---|---|
| `packages/core/src/frete/index.ts` · `packages/core/src/entrega/index.ts` | convenção de barrel por domínio (`catalogo/`, `disponibilidade/`, `otp/`) |
| `packages/core/src/entrega/descricao.test.ts` | §1 lista teste só para `frete/*`; RN17 exige cobertura determinística |
| `apps/web/src/features/enderecos/components/regua-distancia.tsx` | `design.md` §4.4.3 (`<ReguaDistancia>`) |
| `apps/web/package.json` | `design.md` §6.1 — `@googlemaps/js-api-loader` |
| testes `*.test.ts` dos route handlers | `tests.md` cabeçalho: Route Handlers → Vitest com fetch mockado |
| `apps/web/src/features/enderecos/services/cep-repo.ts` | separação repositório/serviço, para o fallback entre provedores ser testável sem banco |
| `apps/web/vitest.config.ts` | variável pública nova precisa existir no runner, que valida env no import |
| `apps/web/src/features/enderecos/services/enderecos-repo.ts` | mesma separação repositório/serviço do CEP |
| `apps/web/src/features/enderecos/schema.ts` | Next 15 proíbe export extra em arquivo de rota; o schema é compartilhado com o formulário do bloco H |
| `apps/web/src/lib/guarda-api.ts` | guarda usada por 5 rotas de 2 features; feature não importa de feature (ARCHITECTURE §3.2) |
| `apps/web/app/(conta)/conta/layout.tsx` | `design.md` §4.1 manda REUSAR "o layout de (conta)", que não tinha cabeçalho; duas telas desta spec precisam dele |
| `packages/ui/package.json` | `@radix-ui/react-dialog`, dependência do `<Dialog>` de §4.4.3 |
| `apps/web/src/features/enderecos/schema.test.ts` | RN3/T11 vira predicado testável; sem teste, a lista de padrões de quadra é palpite |

---

## Blocos

### Bloco A — Schema, RLS e tipos
Arquivos: `supabase/migrations/0012_enderecos_frete.sql`, `supabase/tests/0012_enderecos_rls.sql`, `packages/db/src/types.generated.ts` · Testes: T16, T19 (pgTAP) + invariantes RN13/RN15 no banco · Depende: — · Est: 75min · Agente: database-architect + security-auditor · `[x]`

### Bloco B — Core: frete, distância e área
Arquivos: `packages/core/src/frete/{frete,distancia,area,index}.ts` + `*.test.ts` · Testes: T6, T7, T23 (parte pura), T24 (parte pura), T25, T26 · Depende: — (disjunto de A) · Est: 60min · Agente: inline (Domain Engineer) · `[x]`

### Bloco C — Core: descrição de cobertura (RN17)
Arquivos: `packages/core/src/entrega/{descricao,index}.ts` + teste, `packages/core/src/index.ts` · Testes: T27 (parte pura) · Depende: B (compartilha o barrel) · Est: 30min · Agente: inline · `[x]`

### Bloco D — Env + CEP com cache e fallback
Arquivos: `.env.example`, `apps/web/src/lib/env.ts`, `features/enderecos/services/cep.ts`, `app/api/cep/[cep]/route.ts` + testes · Testes: T1, T8 (servidor), T9, T21, T22 · Depende: A · Est: 60min · Agente: backend-specialist · `[x]`

### Bloco E — Geocoding e rota rodoviária
Arquivos: `features/enderecos/services/geocoding.ts` + teste · Testes: T23, T18 (parte) · Depende: D · Est: 50min · Agente: backend-specialist · `[x]`

### Bloco F — API de endereços e contrato de frete
Arquivos: `features/enderecos/services/enderecos.ts`, `features/enderecos/index.ts`, `app/api/enderecos/route.ts`, `app/api/enderecos/[id]/route.ts`, `app/api/enderecos/[id]/padrao/route.ts`, `app/api/frete/route.ts` + testes · Testes: T2, T3, T4, T12, T13, T14, T15, T17, T20 · Depende: A, B, C, E · Est: 90min · Agente: backend-specialist + security-auditor · `[x]`

### Bloco G — UI: Dialog, régua, card e lista
Arquivos: `packages/ui/src/components/dialog.tsx`, `features/enderecos/components/{regua-distancia,card-endereco}.tsx`, `app/(conta)/conta/enderecos/page.tsx` · Testes: T5, T27 (tela) + critérios visuais 1, 2, 3, 6 · Depende: F · Est: 80min · Agente: frontend-specialist · `[~]` (código verde; aguarda Gate Visual B do PM)

### Bloco H — UI: mapa e formulário
Arquivos: `features/enderecos/components/{mapa-pin,formulario-endereco}.tsx`, `app/(conta)/conta/enderecos/novo/page.tsx`, `app/(conta)/conta/enderecos/[id]/page.tsx`, `apps/web/package.json` · Testes: T8, T10, T11 + critérios visuais 4, 5, 6 · Depende: F, G · Est: 90min · Agente: frontend-specialist · `[~]` (código verde; aguarda Gate Visual B do PM)

---

## Grafo de dependências

```
A ─┬─────────────► D ──► E ──┐
   │                          ├──► F ──► G ──► H
B ──► C ──────────────────────┘
```

Ordem de execução real (sequencial): **B · A** · C · D · E · F · G · H

B vem antes de A porque o seed da `0012` depende da coordenada da cozinha, que é fato do negócio pendente do PM. Os dois blocos são disjuntos — a troca não altera o grafo.

## Checkpoints intermediários sugeridos

- **Após Bloco A:** schema é o que outros sete blocos assumem; errar aqui custa migration corretiva.
- **Após Bloco F:** backend completo e testado — último ponto antes de a UI congelar contratos.
- **Após Bloco G:** primeira metade do Gate Visual B (lista) disponível para o PM.

Só bloqueiam se o modo aprovado for `com checkpoints`.

## Notas de execução

- Commits incrementais: `feat(NAPO-005): bloco [letra] — [resumo] (Tx, Ty verdes)`
- Gate por bloco: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (+ `pnpm db:test` nos blocos que tocam schema)
- Plano é o ponto de retomada — Status atualizado no mesmo commit do bloco

## Decisões de execução

<!-- 1 bullet por decisão, máx. 2 linhas: fato + motivo. Nunca reexplicada em commit ou chat. -->

- **Coordenada da cozinha entra em `config_operacao` (`lat_cozinha`/`lng_cozinha`)** — RN5 mede distância "da cozinha" e nem o design §2.1 nem a tabela previam a origem; vai onde já mora o raio, para mudar de endereço ser `UPDATE` e não deploy.
- **`is_equipe()` nasce na 0012** — a RLS de equipe do design §2.4 precisa dela e só existe `is_admin()`; mesmo padrão `SECURITY DEFINER` + `search_path` fixo da 0001, que evita recursão de RLS em `profiles`.
- **A última faixa de frete fecha à direita** — T26 pede intervalo `[de, ate)` e T25 pede 12,00 km atendido; sem a exceção a borda exata do raio ficaria sem preço.
- **Fora de área devolve `freteCentavos: null`, nunca 0** — inclusive quando não há faixa cobrindo a distância; frete zero silencioso é prejuízo que não aparece no painel.
- **Entre exceções de CEP vence o prefixo mais longo** — com `716` bloqueando e `71680` liberando, deixar a ordem decidir faria a regra geral engolir a exceção dela.
- **`export * from './frete'` entrou no barrel já no bloco B** (o mapa previa a modificação de `core/index.ts` no bloco C) — bloco tem de fechar consumível de fora, senão o gate valida código inalcançável.
- **RN3/T11 vive no schema Zod compartilhado, não em `packages/core`** — é regra do contrato de entrada, e o `superRefine` a aplica no formulário e na rota de uma vez; duas validações do mesmo endereço divergem no primeiro campo novo.
- **O frete aparece DEPOIS de salvar, não antes** — a medição é do servidor (RN5) e só existe após o POST; o preview mostrava a barra preenchida porque mockup não tem servidor. O endereço fora de área é salvo e o aviso é informativo, como manda a RN9 — não é um gate de confirmação.
- **`@googlemaps/js-api-loader` v2 usa `setOptions`/`importLibrary`; a classe `Loader` está deprecada** — o design §6.1 nomeou a biblioteca, não a API.
- **pgTAP do T19 passou a contar só as fixtures** — contava a tabela inteira e quebrou quando o banco local ganhou dado de desenvolvimento; teste que depende do total afirma sobre o ambiente, não sobre a política.
- **Cabeçalho da conta nasce no layout, com só o link que existe** — o preview mostrava "Pedidos" ao lado de "Endereços", mas essa tela é NAPO-007: link morto seria pior que link nenhum. Muda também a aparência de `/conta`, aprovada no NAPO-002 — a conferir no Gate Visual B.
- **Régua no card usa "R$ 6", não "R$ 6,00"** — são quatro rótulos de 11px lado a lado; o centavo que nunca varia só rouba espaço. O valor cheio fica no card, onde é preço.
- **Card do endereço calcula frete com subtotal zero** — mostra quanto a entrega custa, não quanto sairia num pedido hipotético; o desconto acima de R$ 150 é do carrinho, não do endereço.
- **Pílula de navegação do cabeçalho é markup cru declarado** — não é ação, é destino; virar `<Button>` daria a ela peso visual de CTA dentro do próprio cabeçalho.
- **CRUD de endereço usa o client de SESSÃO; config e exceções, o `service_role`** — a RN1 fica a cargo da RLS, não de um `where profile_id` que um `if` esquecido derruba; `config_operacao` e `excecoes_area` fecham para cliente por política.
- **Troca de padrão em dois comandos ordenados, não em transação** — divergência do design §3.1: o índice único parcial é checado linha a linha e um `update set padrao = (id = $1)` poderia marcar o novo antes de limpar o antigo. Desmarcar primeiro nunca viola; no pior caso o cliente fica sem padrão, o que a tela mostra sem mentir.
- **Limite de 10 é 409, não 400** — o envio está correto, o estado é que não comporta, e a orientação é desativar um endereço, não corrigir o corpo.
- **Repositório tipado com `Database['public']['Tables']`, não `Record<string, unknown>`** — coluna renomeada em migration vira erro de tipo, não linha `undefined` numa tela três camadas adiante.
- **`getGoogleEnv()` em escopo próprio, fora do schema monolítico de servidor** — `getServerEnv()` valida tudo de uma vez e é chamado no SSG do catálogo: com a chave no schema comum, uma credencial de geocodificação ausente derrubou a prerenderização da Margherita no gate do bloco E. Cada subsistema falha alto só no que é dele.
- **A chave de rota vai em cabeçalho, nunca em query string** — query string entra em log de proxy e de CDN; a de geocoding vai na URL porque a API não aceita cabeçalho.
- **`medirDistancia` nunca devolve nulo nem zero** — pior caso é estimativa marcada (RN11); distância ausente viraria frete zero ou cadastro travado.
- **~~`GOOGLE_MAPS_SERVER_KEY` fica fora do schema até o bloco E~~** (superada pela decisão acima) — `getServerEnv()` valida tudo de uma vez; declarar a chave antes de existir derrubaria OTP e callback de auth junto, por uma variável que nada ainda usa.
- **A rota de CEP exige sessão com telefone validado** — sem isso é proxy gratuito de CEP escrevendo na nossa tabela de cache.
- **Falha de terceiro é 404 com `podeDigitarManual`, nunca 500** — 500 fica reservado a defeito nosso; confundir os dois faria o formulário tratar CEP inexistente como pane (RN2).
- **Privilégios revogados explicitamente em `enderecos`, `ceps`, `excecoes_area` e `faixas_frete`** — o Supabase concede ALL por default privilege a toda tabela nova de `public`; sem revogar, RN15 dependeria só da ausência de política, e um `for all` acrescentado amanhã reabriria o DELETE.
- **A preposição do dia reaparece só quando o gênero vira** ("às sextas e aos sábados") — repetir sempre soa robótico e omitir sempre erra o português no dia que o sábado abrir.
- **Sem dia de entrega ativo, a frase de cobertura é `null`** — a tela omite em vez de anunciar entrega que a operação não faz (RN17).
- **Bloco B executado antes do A** — o seed da 0012 depende da coordenada da cozinha, fato do negócio pendente do PM; blocos disjuntos, grafo intacto.
