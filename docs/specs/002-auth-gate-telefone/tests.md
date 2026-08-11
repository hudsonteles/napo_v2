# ✅ Tests: Autenticação, papéis e gate de telefone por WhatsApp

**Spec:** [`spec.md`](./spec.md)
**Design:** [`design.md`](./design.md)

> 📌 **Contrato executável.** O módulo está pronto quando TODOS os cenários passam.
> Testes escritos **ANTES** da implementação (`AGENTS.md` §3.2).

**Ferramentas por alvo** (arquitetura §2.3): `packages/core` e Route Handlers → **Vitest** · RLS, índices e funções `SECURITY DEFINER` → **pgTAP** (`supabase test db`) · fluxo de ponta a ponta → **Playwright**.

---

## Categoria A — Cenários funcionais

```gherkin
Background:
  DADO o Supabase local no ar com as migrations aplicadas
  E o remetente de WhatsApp configurado como "fake"
```

### T1 — Magic Link cria conta, perfil e cai no gate
*Cobre: RN2, RN13*
```gherkin
DADO um e-mail que nunca entrou no sistema
QUANDO a pessoa pede o link e abre o link recebido
ENTÃO existe um perfil com papel "cliente" e telefone não validado
E ela termina em /validar-telefone
```

### T2 — Google leva ao mesmo gate
*Cobre: RN2, RN13*
```gherkin
DADO uma conta Google que nunca entrou no sistema
QUANDO a pessoa conclui o consentimento do Google
ENTÃO existe um perfil com papel "cliente"
E ela termina em /validar-telefone
```

### T3 — Validação completa libera a conta
*Cobre: RN3, RN6, RN15*
```gherkin
DADO um cliente logado sem telefone validado
QUANDO ele informa nome e celular, aceita os termos e digita o código correto
ENTÃO o perfil fica com telefone e telefone_validado_em preenchidos
E ele é levado para /conta
```

### T4 — Cliente já validado não vê o gate
*Cobre: RN3, RN5*
```gherkin
DADO um cliente com telefone já validado
QUANDO ele entra pelo Magic Link
ENTÃO vai direto para /conta sem passar por /validar-telefone
```

### T5 — Equipe entra direto no painel
*Cobre: RN4, RN5*
```gherkin
DADO um usuário com papel "gerente" e telefone NÃO validado
QUANDO ele entra
ENTÃO vai direto para /admin
E nunca é redirecionado para /validar-telefone
```

### T6 — Cada papel tem seu destino
*Cobre: RN5*
```gherkin
DADO usuários com papéis cliente, atendente, cozinha, gerente e admin
QUANDO cada um conclui o login
ENTÃO cada um chega ao destino previsto para o seu papel
```

### T7 — Destino pretendido é preservado
*Cobre: RN2, RN5*
```gherkin
DADO um visitante sem sessão tentando abrir /conta/pedidos
QUANDO ele conclui o login
ENTÃO chega em /conta/pedidos, não na home
```

### T8 — Sair encerra a sessão
*Cobre: RN2*
```gherkin
DADO um cliente logado
QUANDO ele sai
ENTÃO os cookies de sessão são removidos
E /conta volta a redirecionar para /entrar
```

---

## Categoria B — Cenários de validação

### T9 — Normalização para E.164
*Cobre: RN8*
```gherkin
DADO os formatos "(61) 99150-4477", "61991504477", "+55 61 99150-4477" e "0061991504477"
QUANDO cada um é normalizado
ENTÃO todos produzem "+5561991504477"
```

### T10 — Recusa o que não é celular brasileiro
*Cobre: RN8*
```gherkin
DADO fixo "(61) 3321-4477", DDD inexistente "(00) 99150-4477", número curto e número com letras
QUANDO cada um é validado
ENTÃO todos são recusados com motivo identificável
```

### T11 — Código tem 6 dígitos e preserva zeros à esquerda
*Cobre: RN6*
```gherkin
QUANDO mil códigos são gerados
ENTÃO todos têm exatamente 6 caracteres numéricos
E códigos começando em zero não perdem o zero
```

### T12 — Código expira em 10 minutos
*Cobre: RN6*
```gherkin
DADO um código emitido às 12:00
QUANDO é conferido às 12:09 e às 12:11
ENTÃO é válido no primeiro caso e expirado no segundo
```

### T13 — Quinta tentativa errada mata o código
*Cobre: RN6*
```gherkin
DADO um código com 4 tentativas erradas registradas
QUANDO a quinta tentativa também erra
ENTÃO o código passa a ser inutilizável mesmo se o valor correto for digitado depois
```

### T14 — Reenvio antes de 60s é recusado
*Cobre: RN7*
```gherkin
DADO um código emitido há 59 segundos
QUANDO é pedido o reenvio
ENTÃO a decisão é recusar, informando os segundos restantes
```

### T15 — Telefone mal formado não gera envio
*Cobre: RN8*
```gherkin
DADO um cliente logado
QUANDO ele pede código para "(61) 3321-4477"
ENTÃO recebe 400
E nenhuma linha é gravada em telefone_verificacoes
E o remetente não é chamado
```

### T16 — Código errado informa quantas tentativas restam
*Cobre: RN6*
```gherkin
DADO um desafio ativo com 5 tentativas disponíveis
QUANDO o cliente envia um código errado
ENTÃO recebe 400 com "restam 4 tentativas"
E o contador no banco é 1
```

### T17 — Código expirado e código já usado
*Cobre: RN6*
```gherkin
DADO um desafio expirado e outro já validado
QUANDO cada um é conferido com o valor correto
ENTÃO ambos recebem 410
E o perfil não é alterado
```

### T18 — Sem aceite dos termos não conclui
*Cobre: RN15*
```gherkin
DADO um desafio ativo e o código correto
QUANDO a conferência chega com aceiteTermos = false
ENTÃO recebe 400
E o telefone NÃO é marcado como validado
E nenhum consentimento é gravado
```

### T19 — Teto de 5 envios por número em 24h
*Cobre: RN7*
```gherkin
DADO 5 envios para o mesmo número nas últimas 24 horas
QUANDO um sexto é pedido
ENTÃO recebe 429
E o remetente não é chamado
```

### T20 — Teto de 10 envios por IP em 24h
*Cobre: RN7*
```gherkin
DADO 10 envios do mesmo IP para números diferentes nas últimas 24 horas
QUANDO um décimo primeiro é pedido
ENTÃO recebe 429
E o remetente não é chamado
```

---

## Categoria C — Cenários de segurança

### T21 — Navegação pública é livre
*Cobre: RN1*
```gherkin
DADO um visitante sem sessão
QUANDO ele abre a home e as páginas públicas
ENTÃO tudo responde 200 sem redirecionar para o login
```

### T22 — Rota protegida sem sessão redireciona
*Cobre: RN2*
```gherkin
DADO um visitante sem sessão
QUANDO ele abre /conta e /admin
ENTÃO ambos redirecionam para /entrar com o destino pretendido preservado
```

### T23 — Cliente sem telefone fica preso no gate
*Cobre: RN3*
```gherkin
DADO um cliente logado sem telefone validado
QUANDO ele tenta abrir /conta diretamente pela URL
ENTÃO volta para /validar-telefone
```

### T24 — Checkout exige telefone de qualquer papel
*Cobre: RN4*
```gherkin
DADO um usuário com papel "atendente" e telefone não validado
QUANDO o guarda de checkout é consultado
ENTÃO ele recusa e aponta para /validar-telefone
```

### T25 — Cliente não entra no painel
*Cobre: RN4, RN5*
```gherkin
DADO um cliente validado
QUANDO ele abre /admin
ENTÃO vê a tela de acesso negado
E NÃO é redirecionado para /entrar
```

### T26 — Desafios são inalcançáveis pela chave anônima
*Cobre: RN6*
```gherkin
DADO uma sessão autenticada comum
QUANDO ela consulta telefone_verificacoes com a chave anônima
ENTÃO nenhuma linha é retornada
E toda escrita é recusada
```

### T27 — Ninguém altera o próprio papel
*Cobre: RN12*
```gherkin
DADO um cliente autenticado
QUANDO ele tenta atualizar o próprio papel para "admin"
ENTÃO o banco recusa com erro de privilégio
```

### T28 — Auto-cadastro sempre nasce cliente
*Cobre: RN13*
```gherkin
DADO um cadastro novo que tenta informar papel "gerente" no corpo da requisição
QUANDO o perfil é criado no callback
ENTÃO o papel gravado é "cliente"
```

### T29 — Um telefone validado, uma conta
*Cobre: RN9*
```gherkin
DADO um número já validado pela conta A
QUANDO a conta B tenta validar o mesmo número
ENTÃO o banco recusa pela unicidade
E o telefone de B permanece não validado
```

### T30 — Recusa por unicidade não revela existência
*Cobre: RN11*
```gherkin
DADO um número já validado por outra conta
QUANDO alguém pede código para esse número
ENTÃO a resposta é indistinguível de um envio bem-sucedido
E a tentativa fica registrada
```

### T31 — Destino externo é ignorado
*Cobre: RN5*
```gherkin
DADO um callback com proximo = "https://site-falso.com" ou "//site-falso.com"
QUANDO o login conclui
ENTÃO o redirecionamento vai para o destino padrão do papel
```

### T32 — Funções de admin recusam quem não é admin
*Cobre: RN14*
```gherkin
DADO um usuário com papel "gerente"
QUANDO ele executa validar_telefone_manual e promover_usuario
ENTÃO ambas recusam com erro de privilégio
E nada é alterado nem auditado
```

### T33 — Override de admin grava auditoria com motivo
*Cobre: RN14*
```gherkin
DADO um admin autenticado e um cliente sem telefone validado
QUANDO ele executa validar_telefone_manual com motivo
ENTÃO o telefone fica validado
E existe uma linha em auditoria com autor, alvo, valores anterior e novo, e o motivo
```

### T34 — Motivo é obrigatório no override
*Cobre: RN14*
```gherkin
DADO um admin autenticado
QUANDO ele executa validar_telefone_manual com motivo vazio
ENTÃO a função recusa
E nada é alterado
```

### T35 — Auditoria não aceita escrita direta
*Cobre: RN14*
```gherkin
DADO um admin autenticado
QUANDO ele tenta inserir ou alterar uma linha em auditoria diretamente
ENTÃO o banco recusa
```

### T36 — Consentimento é gravado com versão e IP; marketing é separado
*Cobre: RN15*
```gherkin
DADO um cadastro concluído com termos aceitos e marketing recusado
QUANDO os consentimentos são consultados
ENTÃO existem registros de "termos" e "privacidade" com versão, data e IP
E NÃO existe registro de "marketing"
```

### T37 — O código não vaza
*Cobre: RN6*
```gherkin
DADO um pedido de código bem-sucedido
QUANDO a resposta e os logs do servidor são inspecionados
ENTÃO o código em texto puro não aparece em nenhum dos dois
E o valor gravado no banco não é o código
```

### T38 — A chave de serviço não chega ao navegador
*Cobre: RN16*
```gherkin
QUANDO o build de produção do app é gerado
ENTÃO nenhum arquivo do bundle do cliente contém a chave de serviço nem o segredo do código
```

---

## Categoria D — Cenários não-funcionais

### T39 — Fluxo completo pelo teclado
```gherkin
QUANDO o fluxo de entrar e validar é percorrido só com Tab, Enter e digitação
ENTÃO todos os campos e botões são alcançáveis com foco visível
E o campo de 6 casas avança e retrocede sozinho entre as casas
```

### T40 — Mobile 375px
```gherkin
QUANDO as duas telas são abertas em viewport de 375px
ENTÃO não há rolagem horizontal
E todo alvo de toque tem ao menos 44x44px
```

### T41 — Contraste
```gherkin
QUANDO os pares de cor das telas são medidos
ENTÃO texto e elementos interativos atingem WCAG AA
```

---

## Categoria E — Cenários de borda

### T42 — Trocar de número zera a validação e libera o antigo
*Cobre: RN10*
```gherkin
DADO um cliente com o número A validado
QUANDO ele valida o número B
ENTÃO seu perfil passa a ter B validado
E o número A pode ser validado por outra conta
```

### T43 — Falha do provedor não deixa rastro confuso
*Cobre: RN16*
```gherkin
DADO um remetente que devolve erro
QUANDO um código é pedido
ENTÃO a resposta é 502 com mensagem genérica
E o desafio gravado é invalidado, sem contar contra o teto diário
```

### T44 — Duas abas validando ao mesmo tempo
*Cobre: RN9*
```gherkin
DADO duas contas conferindo o mesmo número simultaneamente com códigos válidos
QUANDO ambas confirmam
ENTÃO exatamente uma conclui e a outra recebe 409
```

### T45 — Provedor mal configurado quebra no boot
*Cobre: RN16*
```gherkin
DADO WHATSAPP_PROVIDER = "meta" sem as credenciais da Meta
QUANDO a aplicação inicializa
ENTÃO ela falha imediatamente nomeando as variáveis ausentes
```

### T46 — Remetente falso não toca a rede
*Cobre: RN16*
```gherkin
DADO WHATSAPP_PROVIDER = "fake"
QUANDO um código é pedido
ENTÃO nenhuma chamada externa acontece
E o código aparece no log do servidor para uso em desenvolvimento
```

---

## Critérios visuais de aceite

*Derivados do [`preview.html`](./preview.html) aprovado. Verificados a olho nu no Gate Visual B do `/implementar`, na aplicação real.*

1. **Card centralizado** na viewport, largura máxima de 420px, com padding interno de 32px e raio de 16px. Em telas abaixo de 640px, margem lateral de 16px e sem sombra.
2. **Amarelo só na ação primária e no foco.** Um único botão amarelo por tela; nenhum uso decorativo. Ações secundárias são contorno, terciárias são texto.
3. **Foco visível em todo campo** — borda amarela com halo, nunca `outline: none` sem substituto.
4. **As 6 casas do código** têm altura de 56px, espaçamento uniforme, ocupam a largura do card por igual e mostram borda vermelha com a mensagem de tentativas restantes no estado de erro.
5. **Hierarquia tipográfica preservada:** título em 24px semibold com `tracking-tight`, subtítulo em 14px na cor suave, rótulos em 14px medium.
6. **Nenhum texto cortado, sobreposto ou colado na borda** em viewports de 375px, 768px e 1280px, nos cinco estados do preview.
7. **A moldura é a mesma nas duas telas** — marca, título e subtítulo na mesma posição, sem salto perceptível ao navegar de `/entrar` para `/validar-telefone`.

---

## Rastreabilidade RN → cenários

| RN | Cenários |
|---|---|
| RN1 Navegação pública livre | T21 |
| RN2 Sessão exigida em conta, admin e checkout | T1, T2, T7, T8, T22 |
| RN3 Cliente sem telefone barrado | T3, T4, T23 |
| RN4 Equipe não é barrada; checkout exige de todos | T5, T24, T25 |
| RN5 Destino por papel decidido no servidor | T4, T6, T7, T25, T31 |
| RN6 Código: 6 dígitos, hash, 10 min, 5 tentativas | T3, T11, T12, T13, T16, T17, T26, T37 |
| RN7 Reenvio 60s e tetos diários | T14, T19, T20 |
| RN8 E.164 e celular brasileiro | T9, T10, T15 |
| RN9 Telefone validado é único | T29, T44 |
| RN10 Troca zera a validação | T42 |
| RN11 Recusa não revela existência | T30 |
| RN12 Ninguém altera o próprio papel | T27 |
| RN13 Todo cadastro nasce cliente | T1, T2, T28 |
| RN14 Override auditado | T32, T33, T34, T35 |
| RN15 Consentimento com versão e IP | T3, T18, T36 |
| RN16 Canal troca por variável de ambiente | T38, T43, T45, T46 |

---

## Checklist de Conclusão

*Marque `[x]` SOMENTE com evidência verificável.*

### Testes
- [ ] T1..T46 verdes (`pnpm test` + `supabase test db`)
- [ ] Cada RN do `spec.md` tem ≥1 cenário verde (tabela de rastreabilidade acima)
- [ ] Teste de RLS do NAPO-001 continua verde com as 5 tabelas novas

### Qualidade
- [ ] Lint verde (`pnpm lint`)
- [ ] Typecheck verde (`pnpm typecheck`)
- [ ] Build verde (`pnpm build`) — **inclusive o bundle do cliente** (postmortem 2026-06-12)
- [ ] Sem `console.log` esquecidos (o log do remetente falso é intencional e explícito)
- [ ] Sem `TODO` sem ideia vinculada

### Gate Visual B
- [ ] Dev server no ar; URLs de `/entrar`, `/validar-telefone`, `/conta` e `/admin` informadas ao PM
- [ ] Os 7 critérios visuais auditados pelo agente antes de chamar o PM
- [ ] **Aprovação explícita do PM na aplicação real**

### Escopo
- [ ] Apenas arquivos do Mapa de Impacto (`design.md` §1) modificados
- [ ] `package.json` só ganhou as dependências de `design.md` §6.1
- [ ] `.env.example` documenta todas as variáveis de `design.md` §6.2

### Fechamento
- [ ] Retrospectiva feita (`AGENTS.md` §5.1)
- [ ] `ROADMAP.md` atualizado — NAPO-002 em ✅ Concluídos com data
- [ ] `spec.md` com **Status: Concluído**
- [ ] Push para `origin/main`
