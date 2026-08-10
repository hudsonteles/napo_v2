# 📐 Architecture Decision Records (ADRs)

> Registros formais de decisões arquiteturais que mudam algo já documentado em `ARCHITECTURE.md` ou em spec aprovada.

---

## Quando criar um ADR

Crie um ADR quando:

1. Uma **ideia 💡 do ROADMAP** conflita com `ARCHITECTURE.md` (sinalizada com flag `**Exige ADR**` por `/ideia`).
2. Um **spec aprovado** precisa mudar de forma que invalida decisão estrutural anterior.
3. Uma **decisão de stack/dependência/integração** afeta o sistema todo (ex: trocar provider de SMS, mudar modelo de auth).
4. Um **incidente em produção** força uma decisão de mudança que afeta a arquitetura.

**Não crie ADR para:**

- Bugs (vão em issues / specs).
- Decisões puramente de implementação dentro de um spec (ficam no próprio `design.md`).
- Postmortems do sistema de agentes (vão em `docs/agent-postmortems.md`).

---

## Como criar

1. **Próximo número sequencial:** olhe o maior `NNNN-` na pasta. ADRs são numerados a partir de `0001`.
2. **Slug:** kebab-case curto e descritivo (ex: `0001-coord-area-ganha-leitura-volunteer-notes`).
3. **Arquivo:** `docs/adr/NNNN-slug.md`.
4. **Template:** copie `oria-orquestrador-ia/adr-template.md` para `docs/adr/NNNN-slug.md` e preencha.
5. **Status inicial:** `Proposto`. Mude para `Aceito` só após revisão.

---

## Imutabilidade

- ADRs **aceitos** são **imutáveis** (mesma regra de IDs no ROADMAP).
- Para mudar uma decisão anterior, **crie um novo ADR** e:
  - O novo ADR cita o anterior em "Disparado por: substitui ADR-NNNN"
  - O ADR antigo muda status para `Substituído por NNNN-novo-slug`
- ADRs **descartados** (decisão não levada adiante) mudam status para `Descartado` e ficam no histórico — não são deletados.

---

## Flag `ADR pré-requisito` em itens do ROADMAP

Para garantir que `/especificar` e `/implementar` **não prossigam** quando um item exige ADR ainda não aceito, cada item do Backlog/Próximos pode carregar a flag:

```
- **ADR pré-requisito:** —  |  ADR-NNNN-slug (Status: Pendente | Proposto | Aceito | Descartado)
```

**Comportamento mecânico:**

| Valor                                                     | `/especificar` e `/implementar`                                                                                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ausente ou `—`                                            | Prosseguem (sem pré-requisito)                                                                                                                                                  |
| Contém `(Status: Aceito)`                                 | Prosseguem (ADR aprovado)                                                                                                                                                       |
| `Pendente` ou `(Status: Proposto \| Descartado)` ou outro | **Disparam protocolo proativo** — perguntam ao humano: (A) agente rascunha o ADR, (B) humano cria manual, (C) rejeitar e repensar escopo. Ver `AGENTS.md` §3.3.1 para detalhes. |

**Quando atualizar o campo:**

- ADR criado em `Proposto`: campo passa de `Pendente` → `ADR-NNNN-slug (Status: Proposto)`.
- ADR aceito: campo passa para `ADR-NNNN-slug (Status: Aceito)`. **A partir deste ponto, `/especificar` e `/implementar` desbloqueiam.**
- ADR descartado: campo passa para `ADR-NNNN-slug (Status: Descartado)`. O item do ROADMAP deve ser repensado (cancelar, redefinir escopo, ou criar novo ADR).

A flag complementa o texto livre dos "Pré-requisitos antes de implementar" — esse continua válido para descrição humana, a flag serve para parsing mecânico.

---

## Ciclo completo (integração com `/ideia` → `/promover`)

```
1. /ideia detecta conflito com ARCHITECTURE.md
       ↓
2. Adiciona flag "Exige ADR" na entrada de 💡 Ideias do ROADMAP
       ↓
3. Humano decide endereçar a ideia → tenta /promover
       ↓
4. /promover PARA: "essa ideia exige ADR — crie primeiro"
       ↓
5. Humano copia oria-orquestrador-ia/adr-template.md → docs/adr/NNNN-slug.md
   e preenche (contexto, decisão, alternativas, consequências)
       ↓
6. Revisão e aprovação (status: Aceito)
       ↓
7. Atualizar ARCHITECTURE.md refletindo a mudança (se aplicável)
       ↓
8. Marcar checkbox "Flag removida da entrada em 💡" no ADR
       ↓
9. Rodar /promover normalmente — agora vai para Backlog
```

---

## Índice

_(adicionar conforme ADRs forem aceitos, mais recentes no topo)_

_(Sem ADRs ainda.)_

<!-- Exemplo:
- [ADR-0002 — Trocar provider de SMS de Firebase para Twilio](./0002-trocar-provider-sms.md) — Aceito 2026-08-15
- [ADR-0001 — Coord. de Área ganha leitura de volunteer_notes](./0001-coord-area-volunteer-notes.md) — Aceito 2026-07-02
-->
