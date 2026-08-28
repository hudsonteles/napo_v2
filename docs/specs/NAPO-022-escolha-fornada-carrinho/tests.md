# ✅ Tests: Escolha de fornada no carrinho (NAPO-022)

**Spec:** [`spec.md`](./spec.md)
**Design:** [`design.md`](./design.md)

> 📌 **Contrato executável.** O módulo está pronto quando TODOS os cenários listados aqui passam.
> O agente deve escrever os testes em código **ANTES** de implementar (veja `AGENTS.md` §3.2).
> Dono primário: **compartilhado** (PM define cenários em Gherkin; agente implementa em código).

> ⚠️ **Princípio guia (AGENTS.md §7):** cada Regra de Negócio (RN) do `spec.md` **DEVE** ter ≥1 cenário aqui — é o contrato 1:1 RN ↔ teste. O resto dos cenários é **por demanda**: use as categorias abaixo como **guia**, não como lista obrigatória. Se não há lista para popular, omita. Doc com `*(N/A)*` em metade das seções é doc mal calibrada.

---

## Como usar este arquivo

1. **Para cada RN do `spec.md`** crie ≥1 cenário Gherkin numerado.
2. **Use categorias por demanda** — adicione cenários nas categorias que se aplicam ao seu spec, omita as que não.
3. **Cada cenário Gherkin** vira **um teste automatizado** em `/tests/specs/[ID]/` (ou conforme convenção de `ARCHITECTURE.md`).
4. **Ordem de implementação:** agente escreve todos os testes → todos falham (red) → implementa até passarem (green).
5. **Critério de "pronto":** todos os cenários verdes + checklist de conclusão da §99 marcado com **evidência** (output do CI).

---

## Numeração

- Use **T1, T2, T3...** sequencial dentro do arquivo.
- Cite a RN coberta em cada teste: `*Cobre: RN1, RN3*`.
- Se um teste cobre múltiplas RNs, registre todas.

---

## Categoria A — Cenários funcionais (caminho feliz)

### T1 — Sem escolha explícita, dia derivado continua sendo usado
*Cobre: RN1*
```gherkin
DADO um carrinho com itens cujo dia derivado (mais tardio entre eles) é 12/abr
QUANDO o cliente valida o carrinho sem enviar `diaCandidato`
ENTÃO a resposta traz `diaDerivado = diaEscolhido = 12/abr`
E nenhum comportamento do NAPO-006 muda
```

### T2 — Cliente adia para um dia seguinte com vaga para todos os itens
*Cobre: RN1, RN3*
```gherkin
DADO um carrinho cujo dia derivado é 12/abr e o dia 19/abr tem vaga para todos os itens
QUANDO o cliente escolhe `diaCandidato = 19/abr` no carrinho
ENTÃO `validarDiaCandidato` retorna `{ ok: true, dia: { data: '19/abr', determinadoPor: 'escolha_cliente' } }`
E a resposta de `/api/carrinho/validar` traz `diaEscolhido = 19/abr`
```

### T3 — Pedido é criado no dia escolhido (não no derivado)
*Cobre: RN1, RN3, RN4*
```gherkin
DADO um carrinho revalidado com `diaCandidato = 19/abr` válido
QUANDO o cliente confirma o checkout e `POST /api/pedidos` é chamado com `diaCandidato = 19/abr`
ENTÃO o pedido é criado com `dia_entrega = 19/abr`
E a reserva (`reservar_carrinho`) usa 19/abr, não o dia derivado
```

---

## Categoria B — Cenários de validação (regras de negócio)

### T4 — Antecipação é recusada antes de checar disponibilidade
*Cobre: RN2*
```gherkin
DADO um carrinho cujo dia derivado é 19/abr
QUANDO o cliente propõe `diaCandidato = 12/abr` (anterior ao derivado)
ENTÃO `validarDiaCandidato` retorna `{ ok: false, motivo: 'antecipacao_nao_permitida' }`
E nenhuma verificação de disponibilidade por item é necessária para essa decisão
```

### T5 — Dia candidato sem vaga para 1+ itens rejeita o pedido inteiro
*Cobre: RN3*
```gherkin
DADO um carrinho com 2 itens, onde o item B não tem vaga em 26/abr
QUANDO o cliente propõe `diaCandidato = 26/abr`
ENTÃO `validarDiaCandidato` retorna `{ ok: false, motivo: 'sem_vaga', itensSemVaga: ['<id do item B>'] }`
E nenhum item é removido automaticamente do carrinho
E o dia do pedido não muda para 26/abr
```

### T6 — Dia candidato com cutoff vencido é tratado como sem vaga (sem branch especial)
*Cobre: RN3, fluxo de exceção "cutoff já passou"*
```gherkin
DADO um item cujo estoque programado só existe via produção futura (não pronta)
E o dia candidato tem cutoff já vencido para esse item (modo ATP, disponível = estoque pronto = 0)
QUANDO o cliente propõe esse dia como candidato
ENTÃO `validarDiaCandidato` retorna `sem_vaga` com esse item na lista
E a mensagem exibida é a mesma já usada para "esta fornada encheu" (não uma mensagem nova de cutoff)
```

### T7 — Criação do pedido rejeita duro se o candidato deixou de ser válido entre o carrinho e o checkout
*Cobre: RN3, RN4, Decisão técnica §3.3 do design.md*
```gherkin
DADO um `diaCandidato = 19/abr` válido no momento da revalidação do carrinho
E, antes de `POST /api/pedidos`, outro cliente esgota a vaga de 19/abr para um item deste carrinho
QUANDO `POST /api/pedidos` é chamado ainda com `diaCandidato = 19/abr`
ENTÃO a API responde `409 dia_candidato_invalido` com `{ motivo: 'sem_vaga', itensSemVaga: [...] }`
E o pedido NÃO é criado com fallback silencioso para o dia derivado
E nenhuma reserva é feita
```

### T8 — Pedido já criado não pode ter o dia trocado por este spec
*Cobre: RN4*
```gherkin
DADO um pedido já criado e pago com `dia_entrega = 12/abr`
QUANDO qualquer tentativa de reenviar `diaCandidato` for feita para esse pedido
ENTÃO não há endpoint/fluxo neste spec que aceite essa mudança (fora do escopo — ver NAPO-025)
E `dia_entrega` permanece 12/abr
```

---

## Categoria D — Cenários não-funcionais

### T9 — Chip de dia sem vaga é visualmente desabilitado e não clicável
```gherkin
DADO `opcoesDia` com um dia com `disponivelParaTodos: false`
QUANDO a tela do carrinho renderiza `<SeletorDiaCarrinho>`
ENTÃO o chip correspondente tem `aria-disabled="true"` e `disabled`
E não dispara `onChange`/revalidação ao ser clicado
```

### T10 — Navegação por teclado entre os chips
```gherkin
QUANDO o cliente navega pelos chips de `<SeletorDiaCarrinho>` via Tab
ENTÃO cada chip habilitado recebe foco visível e pode ser ativado com Enter/Espaço
E chips desabilitados são pulados pelo foco (baseline de acessibilidade da arch)
```

---

## Categoria E — Cenários de borda

### T11 — Carrinho muda depois da escolha do dia (item adicionado invalida o candidato)
*Cobre: fluxo de exceção "carrinho muda depois da escolha"*
```gherkin
DADO um `diaCandidato = 19/abr` escolhido e válido
QUANDO o cliente adiciona um item que não cabe em 19/abr
ENTÃO a próxima revalidação de carrinho retorna `candidatoInvalido: { motivo: 'sem_vaga', itensSemVaga: [...] }`
E `diaEscolhido` volta a ser o `diaDerivado`
E a UI mostra o card de aviso "Esse dia encheu enquanto você decidia — voltamos para [dia derivado]"
```

### T12 — Dia candidato fora do horizonte calculado (entrada corrompida/manipulada)
*Cobre: defesa em profundidade, design.md §3.1*
```gherkin
DADO um `diaCandidato` que não consta em nenhum item do horizonte calculado (`DisponibilidadeDia[]`)
QUANDO o servidor valida esse candidato
ENTÃO `validarDiaCandidato` retorna `{ ok: false, motivo: 'dia_fora_do_horizonte' }`
E o comportamento é o mesmo de um candidato inválido comum (não quebra a requisição)
```

### T13 — Carrinho vazio não expõe seletor de dia
```gherkin
DADO um carrinho vazio
QUANDO a tela do carrinho é renderizada
ENTÃO nenhum card "Entrega" nem `<SeletorDiaCarrinho>` é exibido (mesmo comportamento atual de carrinho vazio)
```

---

## Critérios visuais de aceite (Gate Visual B do `/implementar`)

*Derivados do preview aprovado em `preview.html` (design.md §4.4).*

- [ ] Estado A (default): chip do dia derivado marcado como ativo (`bg-amarelo text-preto`); demais chips do horizonte com estilo `border-borda-forte` quando habilitados.
- [ ] Estado B (só o derivado cabe): chips seguintes aparecem visualmente apagados (`opacity-40`), `line-through` na data, sem cursor de clique.
- [ ] Estado C (candidato inválido): card de aviso amarelo persistente (nunca toast) some sozinho só quando o cliente escolhe outro dia válido ou o carrinho muda de novo.
- [ ] Estado D (loading): skeleton idêntico ao já usado no card "Entrega" hoje — nenhum layout shift ao carregar.
- [ ] Convite acima dos chips usa a microcopy literal **"Quer esperar mais um pouco?"** (design.md §4.3).

---

## Checklist de Conclusão

*Marque `[x]` SOMENTE com evidência verificável (output de CI, screenshot, log).*

### Testes
- [ ] Todos os cenários T1..T13 definidos acima passam (`npm run test` verde)
- [ ] Cobertura: RN1 (T1, T2, T3), RN2 (T4), RN3 (T2, T3, T5, T6, T7), RN4 (T3, T7, T8)

### Qualidade
- [ ] Lint verde (`npm run lint`)
- [ ] Build verde (`npm run build`)
- [ ] Sem `console.log` esquecidos
- [ ] Sem `TODO` sem issue/ideia vinculada

### Escopo
- [ ] Apenas arquivos do **Mapa de Impacto** (`design.md` §1) foram modificados
- [ ] Nenhuma funcionalidade fora do `spec.md` foi adicionada (troca de dia pós-pagamento é NAPO-025, não entra aqui)

### Fechamento
- [ ] **Retrospectiva feita** — pergunta de postmortem foi feita ao humano (`AGENTS.md` §5.1)
- [ ] `ROADMAP.md` atualizado — item movido para **✅ Concluídos** com data
- [ ] `spec.md` com **Status: Concluído**
- [ ] **Push** para `origin/main` executado
