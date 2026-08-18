# Plano de Implementação — NAPO-005 Endereços e frete por faixa de distância

**Spec:** [`spec.md`](./spec.md) · **Design:** [`design.md`](./design.md) · **Tests:** [`tests.md`](./tests.md)
**Tamanho detectado:** GRANDE
**Critério:** N_arquivos=26, N_testes=27, sensitivo=S (RLS, PII/coordenada, LGPD)
**Plano criado em:** 2026-08-18
**Modo de execução:** com checkpoints (após Bloco A e após Bloco D)

---

## Stack (derivada de ARCHITECTURE.md)
`TypeScript strict · Next.js 15 App Router · Route Handlers · Supabase/Postgres (sem ORM, SQL + tipos gerados) · Vitest (core + fetch mockado) + pgTAP (RLS) · shadcn/ui em packages/ui + Tailwind v4`

## Agentes elegíveis (após fitness)
`.agents/agent/` não existe → todos os blocos executam **inline no main agent** (sem subagentes especialistas). Blocos paralelizáveis marcados abaixo; execução sequencial por decisão de sessão (não spawnar agentes sem pedido do PM).

---

## Blocos

### Bloco A — Schema, RLS e seed
Arquivos: `supabase/migrations/0012_enderecos_frete.sql`, `supabase/tests/0012_enderecos_rls.sql`, `packages/db/src/types.generated.ts` (via `pnpm db:types`) · Testes: T16, T19 (pgTAP) · Depende: — · Paralelo: B, C, E · Est: 60min · Agente: inline · `[ ]`
**Status: [x] concluído.** Tabelas `ceps`, `enderecos` (2 coordenadas + flags), `faixas_frete`, `excecoes_area`, colunas em `config_operacao` (`raio_km`, `frete_gratis_centavos`, `fator_distancia_estimada`, `limite_ajuste_pin_m`). Índices §2.3 (único parcial de padrão). Seed faixas + raio=12 + frete_gratis=15000. RLS matriz §2.4. Helper `is_equipe()` criado. 7 pgTAP (T16/T19) verdes.

### Bloco B — Core puro (frete, distância, área, descrição)
Arquivos: `packages/core/src/frete/frete.ts`, `.../distancia.ts`, `.../area.ts`, `packages/core/src/entrega/descricao.ts`, `*.test.ts`, `packages/core/src/index.ts` (barrel) · Testes: T6, T7, T25, T26, T27 + lógica de T2/T12/T13/T23/T24 · Depende: — · Paralelo: A, C, E · Est: 75min · Agente: inline · `[ ]`
Funções puras, sem rede/banco (RN16). Faixa→valor com borda `[de, ate)` (T26), frete grátis (T8/RN8), haversine + fator (RN11), deslocamento do pin (RN6), raio×exceção (RN9/RN10, borda inclusiva T25), frase de cobertura flexionada (RN17/T27).

### Bloco C — Serviços externos (CEP + geocoding)
Arquivos: `apps/web/src/features/enderecos/services/cep.ts`, `.../geocoding.ts`, `apps/web/src/lib/env.ts` (mod), `.env.example` (mod), `apps/web/package.json` (+`@googlemaps/js-api-loader`) · Testes: T1, T8, T9, T21, T22 (fetch mockado) · Depende: — · Paralelo: A, B, E · Est: 75min · Agente: inline · `[ ]`
CEP: cache→ViaCEP→BrasilAPI, timeout 3s/provedor (T21), fallback manual (T22). Geocoding+Routes só-servidor, `GOOGLE_MAPS_SERVER_KEY` nunca público (T18). Duas chaves Zod (§6.2).

### Bloco D — Persistência + API
Arquivos: `apps/web/src/features/enderecos/services/enderecos.ts`, `app/api/cep/[cep]/route.ts`, `app/api/enderecos/route.ts`, `app/api/enderecos/[id]/route.ts`, `app/api/enderecos/[id]/padrao/route.ts`, `app/api/frete/route.ts` · Testes: T2, T3, T4, T5, T10, T11, T12, T13, T14, T15, T17, T20, T23, T24 · Depende: A, B, C · Paralelo: — · Est: 90min · Agente: inline · `[ ]`
POST /enderecos: geocodifica→mede deslocamento→distância rodoviária→avalia área→grava; distância **nunca** do corpo (T17/RN5). Teto 1 medição/endereço (T20/RN12). Padrão atômico (T4/RN13). Limite 10 (T14). POST /frete = contrato do NAPO-006.

### Bloco E — Catálogo: Dialog
Arquivos: `packages/ui/src/components/dialog.tsx`, barrel de `packages/ui` · Testes: — (coberto no Gate Visual B) · Depende: — · Paralelo: A, B, C · Est: 20min · Agente: inline · `[ ]`
`<Dialog>` shadcn — overlay que o catálogo não tem; confirmação de desativação (proíbe `confirm()` nativo, ARCHITECTURE §4.4).

### Bloco F — UI lista (`/conta/enderecos`)
Arquivos: `apps/web/src/features/enderecos/components/regua-distancia.tsx`, `.../card-endereco.tsx`, `apps/web/src/features/enderecos/index.ts` (barrel), `app/(conta)/conta/enderecos/page.tsx` · Testes: critérios visuais 1–3, 6 (Gate Visual B) + T5/T12 na leitura · Depende: A, B, D, E · Paralelo: — · Est: 75min · Agente: inline · `[ ]`
Server Component lê config+endereços, passa frase de cobertura pronta (RN17). Régua 0–12 km reaproveita linguagem da home. Fora de área sem vermelho.

### Bloco G — UI formulário + mapa (`/conta/enderecos/novo` e `/[id]`)
Arquivos: `apps/web/src/features/enderecos/components/mapa-pin.tsx`, `.../formulario-endereco.tsx`, `app/(conta)/conta/enderecos/novo/page.tsx`, `app/(conta)/conta/enderecos/[id]/page.tsx` · Testes: critérios visuais 4, 5, 6 (Gate Visual B) + T8/T9/T24 na interação · Depende: C, D, E, F · Paralelo: — · Est: 90min · Agente: inline · `[ ]`
`<MapaPin>` encapsula Maps JS, emite `{lat,lng}`; mapa **depois** de número/complemento (crit. 4). Cadastro é página (não modal). Acessível sem mouse (§4.7).

---

## Grafo de dependências

```
A, B, C, E → paralelos (sem deps entre si)
D depende de A + B + C
F depende de A + B + D + E
G depende de C + D + E + F
```

## Checkpoints intermediários sugeridos (GRANDE)

- **Após Bloco A:** gate + commit + confirmar schema/RLS antes de construir sobre ele (base sensível — PII e isolamento entre clientes).
- **Após Bloco D:** gate + commit + revisar contrato de API (`POST /api/frete` é consumido pelo NAPO-006) antes de iniciar a UI.

Bloqueantes só se o PM escolher `Modo de execução: com checkpoints`. Em `autônomo`, cada bloco verde é commitado e o próximo inicia sem confirmação.

## Notas de execução

- Commits incrementais: prefixo `feat(NAPO-005): bloco [letra] — [resumo] (Tx, Ty verdes)`. `plan.md` entra no commit do Bloco A.
- Gate Visual B (blocos F e G) precisa das **chaves reais do Google Maps** — dependência externa do PM (spec §6). Testes automatizados não dependem dela (fetch mockado).
- Blocos A–E não tocam UI; F e G aplicam mockup-driven scaffolding (Etapa 4.0).

## Decisões de execução (preenchida durante a implementação)

- **Bloco A:** `db:migrate` local falhou por histórico dessincronizado (tentou reaplicar 0011); usei `db:reset` — recria limpo. Sem impacto de schema, é a divergência de CLI entre máquinas já registrada em 💡 Ideias.
- **Bloco A:** criado helper `is_equipe()` (não previsto explicitamente no design) — a matriz RLS §2.4 exige "leitura por equipe" e só existia `is_admin()`. Mesmo padrão SECURITY DEFINER + search_path fixo.
- **Bloco A:** `ceps` com PK natural (o CEP) em vez de `id uuid` do padrão §4.2 — decisão já tomada no design §2.1 (cache com chave de negócio única).
