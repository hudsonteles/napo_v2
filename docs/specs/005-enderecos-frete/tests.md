# ✅ Tests: Endereços e frete por faixa de distância

**ID:** NAPO-005
**Status:** Aprovado
**Spec:** [`spec.md`](./spec.md) · **Design:** [`design.md`](./design.md)
**Data:** 2026-08-17

> Contrato de validação. Gherkin puro; cada cenário cita a RN que cobre.
> Ferramentas por camada (`ARCHITECTURE.md` §2.3): `packages/core` → Vitest determinístico · Route Handlers → Vitest com fetch mockado · RLS → pgTAP · visual → Gate Visual B.

---

## Categoria A — Cenários funcionais

### T1 — CEP encontrado preenche o endereço
*Cobre: RN2*
```gherkin
Dado que o CEP 70862-030 existe no ViaCEP
Quando o cliente informa esse CEP no cadastro
Então logradouro, bairro, cidade e UF vêm preenchidos e editáveis
E o CEP é gravado no cache para a próxima consulta
```

### T2 — Cadastro dentro da área grava coordenada, distância e frete
*Cobre: RN4, RN5, RN7, RN12*
```gherkin
Dado um endereço a 3,4 km da cozinha, com número informado
Quando o cliente salva o endereço
Então a coordenada vem da geocodificação de logradouro + número
E distancia_km é gravada pelo servidor a partir da rota rodoviária
E o frete exibido é R$ 6,00 (faixa 0–4 km)
```

### T3 — O primeiro endereço nasce padrão
*Cobre: RN13*
```gherkin
Dado um cliente sem nenhum endereço
Quando ele salva o primeiro
Então esse endereço fica marcado como padrão
```

### T4 — Trocar o padrão desmarca o anterior
*Cobre: RN13*
```gherkin
Dado um cliente com dois endereços ativos, o primeiro marcado como padrão
Quando ele marca o segundo como padrão
Então o primeiro deixa de ser padrão na mesma operação
```

### T5 — A lista mostra apenas os ativos do dono
*Cobre: RN1, RN15*
```gherkin
Dado um cliente com dois endereços ativos e um desativado
Quando ele abre /conta/enderecos
Então vê os dois ativos e nenhum endereço de outro cliente
```

### T6 — Pedido a partir de R$ 150 tem frete zero
*Cobre: RN8*
```gherkin
Dado um endereço na faixa de 8–12 km
Quando o subtotal do pedido é R$ 150,00
Então o frete calculado é R$ 0,00
```

### T7 — A faixa de distância define o valor
*Cobre: RN7, RN16*
```gherkin
Dado as faixas 0–4 km R$ 6, 4–8 km R$ 10 e 8–12 km R$ 14
Quando a função pura recebe 2,0 km, 5,5 km e 11,9 km com subtotal abaixo do piso
Então devolve R$ 6,00, R$ 10,00 e R$ 14,00 respectivamente
```

---

## Categoria B — Cenários de validação

### T8 — CEP malformado não chega a sair do navegador
*Cobre: RN2*
```gherkin
Dado um CEP com 7 dígitos ou letras
Quando o cliente sai do campo
Então o erro é inline e nenhuma chamada externa é feita
```

### T9 — CEP não encontrado libera a digitação manual
*Cobre: RN2*
```gherkin
Dado um CEP ausente no ViaCEP e na BrasilAPI
Quando o cliente informa esse CEP
Então os campos ficam editáveis com aviso informativo
E o cadastro pode ser concluído normalmente
```

### T10 — Endereço de quadra é aceito como é
*Cobre: RN3*
```gherkin
Dado o logradouro "SQN 210 Bloco C" e o número "s/n"
Quando o cliente salva
Então o endereço é aceito sem exigir número numérico
```

### T11 — Complemento é obrigatório em endereço de quadra
*Cobre: RN3*
```gherkin
Dado um logradouro reconhecido como quadra ou condomínio
Quando o cliente tenta salvar sem complemento
Então a validação bloqueia com mensagem sobre bloco e apartamento
```

### T12 — Fora do raio salva, mas não vende
*Cobre: RN9*
```gherkin
Dado um endereço a 28,6 km da cozinha
Quando o cliente conclui o cadastro
Então o endereço é salvo com atendido = false
E a listagem o exibe como fora de área, indisponível para compra
```

### T13 — Exceção de CEP vence o raio
*Cobre: RN10*
```gherkin
Dado um bloqueio para o prefixo de CEP 71680 e uma liberação para 73255
Quando um endereço 71680 a 6 km e outro 73255 a 15 km são cadastrados
Então o primeiro fica não atendido e o segundo fica atendido, ambos com o motivo registrado
```

### T14 — Décimo primeiro endereço é recusado
*Cobre: RN14*
```gherkin
Dado um cliente com 10 endereços ativos
Quando ele tenta cadastrar mais um
Então a criação é recusada com orientação de desativar um existente
```

### T15 — Remover é desativar
*Cobre: RN15*
```gherkin
Dado um endereço ativo
Quando o cliente confirma a remoção
Então a linha continua existindo com ativo = false
E some da conta e da seleção de entrega
```

---

## Categoria C — Cenários de segurança

### T16 — Endereço alheio não existe para quem não é dono
*Cobre: RN1*
```gherkin
Dado um endereço do cliente A
Quando o cliente B consulta ou edita esse id
Então a resposta é "não encontrado", não "proibido"
```

### T17 — Distância enviada pelo cliente é ignorada
*Cobre: RN5*
```gherkin
Dado um corpo de requisição com distancia_km = 0,5 para um endereço a 11 km
Quando o endereço é criado
Então o servidor grava 11 km, medidos por ele mesmo
E o frete cobrado é o da faixa 8–12 km
```

### T18 — A chave de servidor não vaza para o navegador
*Cobre: RN5*
```gherkin
Dado o bundle de produção construído
Quando se procura a chave de geocoding nos arquivos servidos
Então ela não aparece em nenhum deles
```

### T19 — Equipe lê, não escreve
*Cobre: RN1*
```gherkin
Dado um atendente autenticado
Quando ele consulta o endereço de um cliente e tenta alterá-lo
Então a leitura é permitida e a escrita é recusada pela RLS
```

---

## Categoria D — Cenários não-funcionais

### T20 — Uma medição por endereço
*Cobre: RN12*
```gherkin
Dado um endereço já salvo com distância gravada
Quando o cliente edita apenas o ponto de referência
Então nenhuma chamada de geocoding ou de rota é feita
```

### T21 — Terceiro lento não trava o cadastro
*Cobre: RN2*
```gherkin
Dado que o ViaCEP demora mais de 3 segundos
Quando o cliente busca o CEP
Então a chamada é abortada e a BrasilAPI é consultada em seguida
```

---

## Categoria E — Cenários de borda

### T22 — As duas bases de CEP fora do ar
*Cobre: RN2*
```gherkin
Dado ViaCEP e BrasilAPI indisponíveis
Quando o cliente busca um CEP fora do cache
Então o formulário abre em modo manual e o cadastro conclui
```

### T23 — Rota indisponível cai para estimativa marcada
*Cobre: RN11*
```gherkin
Dado que a API de rotas devolve erro
Quando o endereço é salvo
Então a distância é a linha reta multiplicada pelo fator configurado
E o endereço fica com distancia_estimada = true e sinalizado na UI
```

### T24 — Mapa movido além do limite exige conferência
*Cobre: RN6* · _reescrito pelo drift de 2026-08-18: o pin é fixo e o mapa se move_
```gherkin
Dado que a etapa 2 abriu com o ponto que a geocodificação devolveu
Quando o cliente move o mapa 1,2 km e confirma a localização
Então a distância é recalculada a partir da coordenada final
E o endereço fica com precisa_conferencia = true
E a régua de distância anuncia o recálculo em vez de exibir o valor antigo
```

### T28 — A etapa 2 mostra o frete antes de gravar
*Cobre: RN5, RN7* · _acrescentado pelo drift de 2026-08-18_
```gherkin
Dado um endereço preenchido na etapa 1
Quando o cliente avança para a confirmação de localização
Então o servidor devolve distância, área e frete sem gravar linha nenhuma
E nenhum id de endereço existe até a confirmação
```

### T29 — Confirmar não depende do mapa
*Cobre: RN6* · _acrescentado pelo drift de 2026-08-18 (design §4.7)_
```gherkin
Dado um cliente que não consegue operar o mapa
Quando ele confirma sem mover nada
Então o endereço é salvo com a coordenada da geocodificação
E, se não houve geocodificação, fica marcado para conferência
```

### T25 — Borda exata do raio
*Cobre: RN9*
```gherkin
Dado um endereço a exatamente 12,00 km
Quando a área é avaliada
Então o endereço é atendido — o limite inclui a borda
```

### T26 — Borda exata entre faixas
*Cobre: RN7*
```gherkin
Dado as faixas 0–4 km e 4–8 km
Quando a distância é exatamente 4,00 km
Então vale a faixa superior: intervalo fechado no início e aberto no fim
```

### T27 — A cobertura exibida acompanha a configuração
*Cobre: RN17*
```gherkin
Dado que a operação entrega apenas na sexta, com raio de 12 km
Então a tela de endereços anuncia entrega "às sextas" e raio de 12 km
Quando a quarta-feira é habilitada e o raio passa a 15 km no banco
Então a mesma tela anuncia "às quartas e sextas" e 15 km, sem alteração de código
```

---

## Critérios visuais de aceite (Gate Visual B)

Derivados do preview aprovado em 2026-08-17.

1. O card de endereço traz a **régua de 0 a 12 km** com as três faixas marcadas e o pin do endereço na posição proporcional à distância.
2. Endereço fora de área usa borda tracejada e texto neutro — **nenhum vermelho de erro**, e o ponto aparece além do fim da régua.
3. Selo de padrão em amarelo sólido; selos de "distância aproximada" e "fora de área" em contorno — hierarquia visível sem ler o texto.
4. A confirmação de posição é **etapa própria**, com indicador de passo, resumo do endereço digitado e uma única ação primária. O pin é **fixo no centro** e o mapa se move sob ele.
5. A régua de distância fica junto da confirmação, com a faixa e o frete daquela posição. Movido além de 300 m, o número é riscado e substituído por "recalculamos ao confirmar", com o traço tracejado até o ponto original. Sem geocodificação, não há régua — nenhum número é inventado.
6. Em viewport ≥1280 px e em 375 px, nenhum texto cortado ou sobreposto; o mapa tem altura fixa proporcional e nunca ocupa a tela inteira.

---

## Checklist de Conclusão

### Testes
- [ ] T1–T29 verdes
- [ ] `packages/core` sem rede nem banco nos testes de frete/distância/área
- [ ] pgTAP cobrindo T16 e T19

### Qualidade
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:test` verdes
- [ ] `pnpm db:types` sem drift
- [ ] Bundle do cliente sem a chave de servidor (T18)

### Escopo
- [ ] Apenas arquivos do Mapa de Impacto tocados
- [ ] Critérios visuais 1–6 aprovados pelo PM no Gate Visual B

### Fechamento
- [ ] ROADMAP atualizado
- [ ] `spec.md` em `Concluído`
