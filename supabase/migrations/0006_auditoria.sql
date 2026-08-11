-- ─────────────────────────────────────────────────────────────────────────────
-- 0006_auditoria — Rastro de quem mudou o quê, e por quê.
--
-- Nasce no NAPO-002 porque a RN14 exige rastro do override manual de telefone,
-- mas a tabela é a genérica prevista no R1 §4: NAPO-008 a herda para preço,
-- estoque, capacidade e configuração de operação.
--
-- Append-only de propósito. Não há `updated_at` (arquitetura §4.2 pede, mas
-- linha de auditoria que pode ser atualizada não é auditoria) e não há grant de
-- INSERT/UPDATE/DELETE para ninguém — nem admin. Só as funções SECURITY DEFINER
-- escrevem, e elas o fazem na mesma transação da mudança que registram.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id uuid not null,
  acao text not null,
  -- Nulo quando o autor é a `service_role` (script de servidor, sem sessão).
  -- ON DELETE SET NULL: apagar o autor não pode apagar o rastro do que ele fez.
  profile_id uuid references public.profiles (id) on delete set null,
  dados_antes jsonb,
  dados_depois jsonb,
  -- Para override manual o "por quê" vale mais que o diff: um jsonb de antes e
  -- depois não responde por que alguém contornou o fluxo normal.
  motivo text,
  created_at timestamptz not null default now()
);

comment on table public.auditoria is
  'Rastro append-only de mudanças sensíveis. Escrita exclusivamente por funções SECURITY DEFINER (RN14).';

create index auditoria_registro on public.auditoria (tabela, registro_id, created_at desc);

alter table public.auditoria enable row level security;

-- Apenas leitura, apenas admin. A ausência de grant de escrita é o controle:
-- sem ele, nem uma política permissiva deixaria alguém inserir.
grant select on public.auditoria to authenticated;

create policy "auditoria_select_admin"
  on public.auditoria
  for select
  using (public.is_admin());
