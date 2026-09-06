# 📓 Agent Postmortems

> Registro vivo de falhas do **sistema de agentes** para evitar repetição.
> **NÃO** é para bugs de produto — esses vão em issues/spec.
> Veja `AGENTS.md` §5 para quando e como registrar.

---

## Quando registrar (3 gatilhos)

1. **Retrospectiva de spec** — ao concluir um spec, o agente pergunta ao humano: _"Algo neste fluxo precisou de correção sua que valha registrar?"_
2. **Padrão repetido** — quando o humano corrigir o agente 2x sobre o mesmo tema.
3. **Correção espontânea** — humano sinaliza a qualquer momento.

---

## Formato de cada entrada

Adicione novas entradas **no topo** da seção "Entradas", mais recentes primeiro:

```markdown
### YYYY-MM-DD — Título curto da falha

**Spec/Contexto:** [Qual spec ou tarefa estava em andamento?]
**O que pedi:** [Comando/input original ao agente]
**O que esperava:** [Comportamento correto]
**O que veio:** [Comportamento errado]
**Causa provável:** [Regra ausente em AGENTS.md? Contexto faltando? Alucinação? Spec ambíguo?]
**Correção naquele momento:** [Como foi resolvido pontualmente]
**Ação de follow-up:**

- [ ] Virou regra em `AGENTS.md`? Seção: ___
- [ ] Virou caso de eval em `evals/cases/`? Arquivo: ___
- [ ] Apenas registrado (1ª ocorrência)
```

---

## Loop de melhoria

```
1ª ocorrência → entrada aqui (histórico)
       ↓
2ª ocorrência → vira regra em AGENTS.md (na seção pertinente)
       ↓
3ª+ ocorrência → considere caso formal em evals/cases/
```

> ⚠️ Postmortems sem follow-up acumulam ruído. Toda entrada com 2+ ocorrências **deve** virar regra ou ser explicitamente arquivada com justificativa.

---

## Entradas

<!-- Adicione novas entradas NO TOPO desta seção. Mais recentes primeiro. -->

### 2026-09-06 — Arquivo truncado por script e commitado vazio, duas vezes seguidas

**Spec/Contexto:** grooming, depois de promover o NAPO-031.
**O que pedi:** acrescentar uma linha ao NAPO-017 com o link do roteiro; depois, registrar este próprio postmortem.
**O que esperava:** uma linha a mais em cada arquivo.
**O que veio:** `ROADMAP.md` foi para 0 byte e o `git add -A` seguinte commitou e **enviou** o arquivo vazio. Ao registrar a lição, o agente repetiu o erro e zerou o `docs/agent-postmortems.md`, também commitado e enviado.

**Causa provável:** `open(caminho, 'w')` **trunca no momento da abertura**, antes de o conteúdo ser escrito. O script montava uma string com um emoji escrito como par de surrogates (`\ud83d\udcd8`), que não é UTF-8 válido; a exceção veio depois do truncamento. Na segunda vez, a "correção" foi `open(p,'wb').write(s.encode('utf-8'))` — que continua errada, porque Python avalia `open(...)` antes do argumento.

O agravante: o agente **corrigiu exatamente esta classe de bug horas antes, no mesmo dia** — `scripts/gen-types.mjs` nasceu porque `supabase gen types > arquivo` truncava o destino antes de o comando rodar. A lição foi aplicada à ferramenta e não ao próprio comportamento.

Segundo fator: `git add -A` logo depois de um comando que falhou varre o dano colateral para dentro do commit sem ninguém olhar.

**Correção naquele momento:** `git checkout <commit anterior> -- <arquivo>` nos dois casos, e reescrita com o conteúdo codificado em uma variável **antes** de o arquivo ser aberto.

**Ação de follow-up:**

- [x] Virou regra em AGENTS.md? Seção: Regras Inegociáveis — item 13 (novo)
- [ ] Virou caso de eval? Arquivo: —
- [ ] Apenas registrado

---

### 2026-09-06 — Build de produção rodado com o dev server vivo, de novo

**Spec/Contexto:** NAPO-025, bloco H, durante a validação do gateway real com o PM.
**O que pedi:** corrigir o "Sair" que não deslogava e as mensagens de erro da tela de pagamento.
**O que esperava:** as correções entrarem sem derrubar o ambiente que eu tinha acabado de subir para o PM testar.
**O que veio:** o agente encadeou `pnpm build` no mesmo comando do commit, com o dev server rodando. Os dois escrevem em `apps/web/.next`; o build sobrescreveu o cache do dev e o site passou a ser servido sem CSS. Quem percebeu foi o humano, no meio do teste.

**Causa provável:** a regra existe desde 2026-08-18 (`AGENTS.md` §2 item 12) e o próprio agente a havia transcrito no `plan.md` desta spec, em "Notas de execução". Ainda assim ela foi violada — o gate foi tratado como um passo de checklist a encadear antes do commit, sem releitura do estado do ambiente. O agente **derruba** o dev server antes de `build` quando o build é o objetivo declarado do comando; falhou quando o `build` virou um item no meio de uma linha de `&&` cujo propósito era commitar.

**Correção naquele momento:** encerrar o processo do dev, apagar `apps/web/.next` e subir de novo.

**Ação de follow-up:**

- [ ] Virou regra em AGENTS.md? Seção: **já era regra** (§2 item 12) — reincidência
- [ ] Virou caso de eval? Arquivo: —
- [x] Registrado como 2ª ocorrência — o padrão não é falta de regra, é o gate encadeado em comando composto. Candidato a virar verificação automática (hook de pré-commit que recusa `build` com processo `next dev` vivo) se acontecer uma terceira vez.

---

### 2026-08-18 — Comandos de ambiente rodados sem considerar processos vivos e escopo do worktree

**Spec/Contexto:** NAPO-005, durante os Gates Visuais dos blocos G, H e I.
**O que pedi:** implementar os blocos e disponibilizar o ambiente real para aprovação visual.
**O que esperava:** que o agente rodasse os gates e mantivesse o ambiente utilizável entre uma verificação e outra.
**O que veio:** três quebras do ambiente local, todas causadas pelo agente e todas percebidas primeiro pelo humano:

1. `pnpm add` com o dev server rodando — `pnpm` religou o `node_modules` sob o processo vivo e a página passou a ser servida sem CSS (`__webpack_modules__[moduleId] is not a function`).
2. `pnpm build` com o dev server rodando — ambos escrevem em `apps/web/.next`, e o build de produção sobrescreveu o cache do dev (`MODULE_NOT_FOUND` em `_document.js`).
3. `pnpm format` — é `prettier --write .` no repositório inteiro; reformatou 80 arquivos, incluindo `ARCHITECTURE.md` e os previews aprovados no Gate Visual A.

**Causa provável:** o agente tratou comandos de ferramenta como operações isoladas, sem modelar dois efeitos colaterais óbvios — que existe um processo de longa duração usando os mesmos artefatos, e que script de repositório age sobre o repositório todo, não sobre o Mapa de Impacto. Não havia regra sobre estado de ambiente: a seção de gates dizia *quais* comandos rodar, não *com o que* eles conflitam.
**Correção naquele momento:** encerrar o processo do dev, apagar `apps/web/.next` e subir de novo (casos 1 e 2); `git stash` dos arquivos legítimos + `git checkout -- .` + `stash pop` para reverter a formatação (caso 3).
**Ação de follow-up:**

- [x] Virou regra em AGENTS.md? Seção: Regras Inegociáveis (item 12)
- [ ] Virou caso de eval? Arquivo: —
- [ ] Apenas registrado (1ª ocorrência)

---

### 2026-08-18 — Bloco de UI declarado verde sem exercitar o ambiente real

**Spec/Contexto:** NAPO-005, blocos G e H.
**O que pedi:** implementar as telas conforme o preview aprovado no Gate Visual A.
**O que esperava:** que o agente só apresentasse a tela para aprovação depois de tê-la visto funcionar.
**O que veio:** o agente rodou lint, typecheck, 290 testes e build, declarou os blocos verdes e **só então** subiu o ambiente. O Gate Visual B do humano encontrou quatro defeitos que nenhum teste pegou: mapa em branco por `mapId` não registrado; guarda de StrictMode que impedia a criação do mapa; `stroke-width` em kebab-case (silenciosamente ignorado em JSX); e campos editáveis durante a busca de CEP, contrariando o §4.3 do próprio design.
**Causa provável:** confiança indevida no gate automatizado. Os quatro defeitos são de integração com API de terceiro, ciclo de vida do React e atributos de DOM — categorias que teste unitário com mock, por construção, não alcança. O agente tratou "gate verde" como sinônimo de "pronto para revisão".
**Correção naquele momento:** o humano encontrou cada defeito manualmente ao longo de cinco interações; o agente corrigiu um a um.
**Ação de follow-up:**

- [x] Virou regra em AGENTS.md? Seção: Regras Inegociáveis (item 11b)
- [ ] Virou caso de eval? Arquivo: —
- [ ] Apenas registrado (1ª ocorrência)

---

### 2026-07-26 — Gates executáveis redundantes em fluxos documentais

**Spec/Contexto:** Fluxo documental seguido imediatamente por um fluxo de implementação.
**O que pedi:** Concluir e versionar a documentação aprovada antes de iniciar a execução.
**O que esperava:** O fluxo documental validaria apenas seus artefatos; `lint`, `build` e `test` rodariam no primeiro gate executável.
**O que veio:** A suíte completa da aplicação rodou no fechamento documental e foi repetida no preflight da implementação.
**Causa provável:** A regra global exigia o mesmo gate para qualquer tarefa, sem distinguir mudanças documentais de executáveis.
**Correção naquele momento:** Gates proporcionais ao impacto e classificação canônica dos protocolos documentais e executáveis.
**Ação de follow-up:**

- [x] Virou regra em `AGENTS.md`? Seção: Regras Inegociáveis
- [ ] Virou caso de eval em `evals/cases/`? Arquivo: —
- [ ] Apenas registrado (1ª ocorrência)
