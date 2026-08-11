# ✅ Tests: Motor de disponibilidade (NAPO-004)

**Spec:** [`spec.md`](./spec.md)
**Design:** [`design.md`](./design.md)

> 📌 **Contrato executável.** O módulo está pronto quando TODOS os cenários passam.
> Testes escritos **ANTES** da implementação. Dono: compartilhado.

---

## Convenções deste spec

- **T1–T14** rodam em **Vitest** contra `packages/core` — puros, sem banco.
- **T15, T18, T19** rodam em **pgTAP** (`supabase test db`) — RLS e reserva.
- **T20–T22** rodam em **Vitest** contra `packages/core` — decisão pura, sem `pedidos` (ver `drift.md`).
- **T17, T23** rodam contra as rotas, com Supabase local.

```gherkin
Background:
  DADO config_operacao com teto_forno_dia=30, capacidade_freezer=150,
       tempo_preparo_horas=48, sub_teto_massa_dia=6,
       limite_ocupacao_massa_pct=80, buffer_cutoff_min=15, reserva_minutos=15
  E entrega apenas na sexta, janela 17h–21h
  E produção de segunda a sexta
```

---

## Categoria A — Cenários funcionais

### T1 — Calendário configurável decide os dias oferecidos
*Cobre: RN3*
```gherkin
DADO que o admin marca o sábado como dia de entrega
QUANDO o horizonte é calculado
ENTÃO sexta e sábado aparecem como dias de entrega
E nenhuma constante de código precisou mudar
```

### T2 — Horizonte de 2 semanas deslizantes
*Cobre: RN3*
```gherkin
DADO entrega apenas na sexta
QUANDO o cliente consulta a disponibilidade numa terça
ENTÃO exatamente 2 datas são oferecidas: a sexta corrente e a seguinte
```

### T3 — Cutoff é derivado da janela e do preparo
*Cobre: RN1*
```gherkin
DADO entrega na sexta com janela iniciando às 17h
QUANDO o cutoff dessa sexta é calculado
ENTÃO o resultado é quarta-feira às 17h
```

### T4 — Cutoff recua ao cair em dia sem produção
*Cobre: RN2*
```gherkin
DADO que a quarta-feira está marcada como exceção sem_producao
QUANDO o cutoff da sexta é calculado
ENTÃO ele recua para a terça-feira às 17h
E nunca avança para depois da quarta
```

### T5 — Toda data passa pelo fuso de Brasília
*Cobre: RN5*
```gherkin
DADO o processo rodando com TZ=UTC
QUANDO o cutoff e o dia de entrega são calculados
ENTÃO o resultado é idêntico ao obtido com TZ=America/Sao_Paulo
```

### T6 — Antes do cutoff a promessa é CTP
*Cobre: RN6*
```gherkin
DADO que agora é segunda-feira, antes do cutoff da sexta
QUANDO a disponibilidade da sexta é calculada
ENTÃO o modo é CTP
E a quantidade soma estoque alocável mais capacidade restante
```

### T7 — Dia sai da vitrine dentro do buffer
*Cobre: RN4*
```gherkin
DADO que faltam 10 minutos para o cutoff da sexta
QUANDO o horizonte é calculado
ENTÃO a sexta não é oferecida
E a próxima sexta assume como primeira data disponível
```

### T8 — Depois do cutoff a promessa é ATP
*Cobre: RN6*
```gherkin
DADO que o cutoff da sexta já passou
E existem 12 lotes prontos alocados para essa sexta
QUANDO a disponibilidade da sexta é calculada
ENTÃO o modo é ATP e a quantidade é exatamente 12
```

---

## Categoria B — Cenários de validação

### T9 — Teto de forno limita o fluxo diário
*Cobre: RN7*
```gherkin
DADO 1 dia de produção entre agora e a sexta, sem produção já planejada
QUANDO a capacidade restante é calculada
ENTÃO o resultado não passa de 30
```

### T10 — Teto de freezer limita o acúmulo
*Cobre: RN7*
```gherkin
DADO 6 dias de produção até a sexta e nenhuma entrega intermediária
QUANDO a capacidade restante é calculada
ENTÃO o resultado é 150, limitado pelo freezer e não pelos 180 do forno somado
E o menor dos dois tetos é o que vale
```

### T11 — Produção já planejada abate a capacidade
*Cobre: RN7*
```gherkin
DADO 30 unidades já planejadas para a sexta
QUANDO a capacidade restante da sexta é calculada
ENTÃO o resultado é 0
E nenhum valor negativo é retornado
```

### T12 — Massa respeita o sub-teto diário
*Cobre: RN8*
```gherkin
DADO 6 massas já reservadas para a sexta
QUANDO um cliente tenta reservar a sétima massa
ENTÃO a massa aparece como indisponível para aquele dia
E as pizzas continuam disponíveis
```

### T13 — Massa sai do catálogo acima do limite de ocupação
*Cobre: RN8*
```gherkin
DADO que a sexta está com 81% de ocupação
QUANDO o catálogo daquele dia é calculado
ENTÃO nenhuma massa é oferecida
E a vaga fica preservada para pizza
```

### T14 — Produto esgotado aponta o próximo dia com vaga real
*Cobre: RN9*
```gherkin
DADO que a Margherita esgotou para a sexta corrente
E a sexta seguinte tem capacidade restante maior que zero
QUANDO o cliente consulta a Margherita
ENTÃO a sexta seguinte é oferecida
E um dia sem vaga real nunca é sugerido
```

---

## Categoria C — Cenários de segurança

### T15 — Estoque não é legível pelo cliente
*Cobre: RN10*
```gherkin
DADO um usuário autenticado com role cliente
QUANDO ele consulta lotes, producao_planejada ou reservas de terceiros
ENTÃO a RLS não devolve nenhuma linha
```

### T16 — Calendário é público, configuração é da equipe
*Cobre: RN3*
```gherkin
DADO um visitante anônimo
QUANDO ele lê dias de entrega e exceções de calendário
ENTÃO as linhas são devolvidas
E qualquer tentativa de escrita é recusada
```

### T17 — Reserva exige sessão e ignora limite vindo do cliente
*Cobre: RN11*
```gherkin
DADO uma requisição de reserva sem sessão autenticada
QUANDO ela chega à rota de reserva
ENTÃO recebe 401 e nada é persistido
E um limite enviado no corpo da requisição jamais é usado no cálculo
```

---

## Categoria E — Cenários de borda

### T18 — Duas sessões disputam a última vaga
*Cobre: RN11*
```gherkin
DADO uma única vaga restante na sexta
QUANDO duas transações tentam reservar simultaneamente
ENTÃO exatamente uma obtém a reserva
E a outra recebe 409 antes de qualquer cobrança
```

### T19 — Reserva expirada volta para a vitrine
*Cobre: RN11*
```gherkin
DADO uma reserva criada há 16 minutos e não paga
QUANDO a disponibilidade do dia é consultada
ENTÃO a vaga aparece disponível novamente
E nenhum job precisou rodar para isso
```

### T20 — Confirmação fora da janela é reportada como conflito, não resolvida
*Cobre: RN12*
```gherkin
DADO um dia cujo cutoff já passou e sem lote pronto para atender
QUANDO a viabilidade é avaliada no momento da confirmação
ENTÃO o veredito é cutoff_vencido
E nenhuma realocação ou estorno é escolhida pela função
```

### T21 — A devolução de um cancelamento depende da fase
*Cobre: RN13*
```gherkin
DADO um dia de entrega ainda antes do cutoff
QUANDO a devolução por cancelamento é avaliada
ENTÃO o que retorna é capacidade
E, para um dia já depois do cutoff, o que retorna é lote
```

### T22 — Lote liberado reaparece sem intervenção no cálculo
*Cobre: RN14*
```gherkin
DADO um lote marcado como perdido e depois reprogramado no admin
QUANDO a disponibilidade é consultada em seguida
ENTÃO o lote reprogramado é considerado
E nenhuma etapa manual de recálculo foi necessária
```

### T23 — Nenhum dia viável não vira checkout
*Cobre: RN12*
```gherkin
DADO que todos os dias do horizonte estão sem vaga
QUANDO o cliente abre o catálogo
ENTÃO nenhuma data é oferecida e o checkout não é liberado
E a mensagem informa a ausência de data, em vez de aceitar o pedido
```

---

## Rastreabilidade RN → cenários

| RN | Cenários |
|---|---|
| RN1 — cutoff derivado | T3 |
| RN2 — recuo por dia sem produção | T4 |
| RN3 — calendário configurável | T1, T2, T16 |
| RN4 — buffer pré-cutoff | T7 |
| RN5 — fuso único | T5 |
| RN6 — CTP antes, ATP depois | T6, T8 |
| RN7 — dois tetos | T9, T10, T11 |
| RN8 — sub-teto de massa | T12, T13 |
| RN9 — próximo dia com vaga real | T14 |
| RN10 — quantidade real, sem cache | T15 |
| RN11 — reserva de 15 min | T17, T18, T19 |
| RN12 — conflito é decisão humana | T20, T23 |
| RN13 — cancelamento por fase | T21 |
| RN14 — lote liberado reaparece | T22 |

**Cobertura: 14 de 14 RNs.**

---

## Checklist de Conclusão

### Testes
- [x] T1..T23 verdes — 34 em Vitest (30 core + 4 web) e 24 em pgTAP
- [x] Cada RN do `spec.md` com ≥1 teste correspondente

### Qualidade
- [x] Lint verde (`pnpm lint`)
- [x] Typecheck verde (`pnpm typecheck`) — 3 projetos
- [x] Build verde (`pnpm build`) · `service_role` ausente do bundle do cliente
- [x] Tipos do banco sem drift (`pnpm db:types:check`, exit 0)
- [x] Sem `console.log` esquecidos · sem `TODO` sem ideia vinculada

### Escopo
- [x] Apenas arquivos do Mapa de Impacto (`design.md` §1) modificados
- [x] Nenhuma funcionalidade fora do `spec.md`
- [x] `package.json` ganhou apenas `vitest` em `apps/web`, registrado em `design.md` §6.1

### Fechamento
- [x] Retrospectiva feita (`AGENTS.md` §5.1)
- [x] `ROADMAP.md` com NAPO-004 em ✅ Concluídos
- [x] `spec.md` com **Status: Concluído**
- [x] Push para `origin/main`
