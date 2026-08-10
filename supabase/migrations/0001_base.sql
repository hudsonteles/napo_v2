-- ─────────────────────────────────────────────────────────────────────────────
-- 0001_base — Extensões, funções utilitárias e o padrão de segurança do projeto.
--
-- Estabelece o modelo de acesso que TODAS as tabelas das specs seguintes herdam:
-- RLS deny-by-default (tabela com RLS ligada e sem política nega tudo) e a
-- função is_admin() usada pelas políticas sem disparar recursão de RLS.
-- Nada destrutivo — o banco nasce aqui.
-- ─────────────────────────────────────────────────────────────────────────────

-- gen_random_uuid() e crypt() para IDs e seed determinístico.
create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- is_admin(): o usuário corrente é admin?
--
-- SECURITY DEFINER de propósito: executa com os privilégios do dono e IGNORA a
-- RLS de `profiles`. Sem isso, uma política que pergunta "é admin?" consultando
-- `profiles` dispararia a RLS de `profiles` de novo → recursão infinita (a
-- armadilha mais comum de RLS). `search_path` fixo é OBRIGATÓRIO: sem ele,
-- SECURITY DEFINER vira vetor de escalada de privilégio por objeto homônimo.
--
-- plpgsql (não sql) para adiar a validação do corpo: a função é criada aqui,
-- mas `profiles` só existe em 0002. plpgsql valida o corpo em tempo de execução.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
end;
$$;

comment on function public.is_admin() is
  'Verdadeiro se o usuário autenticado corrente tem role admin. SECURITY DEFINER para evitar recursão de RLS em profiles (RN2).';

-- ─────────────────────────────────────────────────────────────────────────────
-- set_updated_at(): mantém `updated_at` sincronizado em qualquer tabela que o use
-- (ARCHITECTURE §4.2 — toda tabela tem created_at e updated_at).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- horario_servidor(): primitiva de saúde. A página inicial a chama via RPC para
-- provar a cadeia inteira — Next renderiza, env validou, o client Supabase
-- conectou e o Postgres respondeu (design §3). Exposta a anon de propósito: é
-- só a hora do banco, sem dado sensível.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.horario_servidor()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

grant execute on function public.horario_servidor() to anon, authenticated;
