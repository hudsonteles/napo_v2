# 📓 Agent Postmortems

> Registro vivo de falhas do **sistema de agentes** para evitar repetição.
> **NÃO** é para bugs de produto — esses vão em issues/spec.
> Veja `AGENTS.md` §5 para quando e como registrar.

---

## Quando registrar (3 gatilhos)

1. **Retrospectiva de spec** — ao concluir um spec, o agente pergunta ao humano: *"Algo neste fluxo precisou de correção sua que valha registrar?"*
2. **Padrão repetido** — quando o humano corrigir o agente 2x sobre o mesmo tema.
3. **Correção espontânea** — humano sinaliza a qualquer momento.

---

## Formato de cada entrada

Adicione novas entradas **no topo** da seção "Entradas", mais recentes primeiro:

~~~markdown
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
~~~

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
