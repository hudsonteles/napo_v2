-- ─────────────────────────────────────────────────────────────────────────────
-- 0009_admin_functions — Override manual de telefone e promoção de papel.
--
-- A regra vive no banco, não no script, para que a tela do NAPO-008 chame a
-- MESMA função em vez de reimplementar a validação — e para que a auditoria
-- seja atômica com a mudança que registra.
--
-- SECURITY DEFINER com search_path fixo: sem o search_path, a função vira vetor
-- de escalada por objeto homônimo (mesmo padrão do is_admin() em 0001).
-- ─────────────────────────────────────────────────────────────────────────────

/**
 * Autor da ação e permissão. Admin autenticado age em nome próprio; a
 * service_role age sem sessão (script de servidor) e fica registrada com autor
 * nulo — por isso `motivo` é obrigatório nos dois caminhos: é o único
 * identificador de intenção que sobra.
 */
create or replace function public.exigir_admin_e_motivo(motivo text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'Ação restrita a admin ou service_role.' using errcode = '42501';
  end if;

  if motivo is null or btrim(motivo) = '' then
    raise exception 'Motivo é obrigatório: toda ação manual precisa dizer por quê.'
      using errcode = '22023';
  end if;

  return auth.uid();
end;
$$;

/**
 * Marca um telefone como validado sem passar pelo OTP (RN14).
 *
 * Única mitigação existente para falha do canal de WhatsApp — não há fallback
 * por SMS. A unicidade continua sendo imposta pelo índice: override não é
 * licença para duplicar número validado.
 */
create or replace function public.validar_telefone_manual(
  alvo uuid,
  telefone_e164 text,
  motivo text
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  autor uuid;
  antes jsonb;
begin
  autor := public.exigir_admin_e_motivo(motivo);

  select to_jsonb(p) - 'updated_at'
    into antes
    from public.profiles p
   where p.id = alvo;

  if antes is null then
    raise exception 'Perfil % não existe.', alvo using errcode = 'P0002';
  end if;

  update public.profiles
     set telefone = telefone_e164,
         telefone_validado_em = now()
   where id = alvo;

  insert into public.auditoria (tabela, registro_id, acao, profile_id, dados_antes, dados_depois, motivo)
  values (
    'profiles',
    alvo,
    'validacao_manual_telefone',
    autor,
    jsonb_build_object('telefone', antes -> 'telefone', 'telefone_validado_em', antes -> 'telefone_validado_em'),
    jsonb_build_object('telefone', to_jsonb(telefone_e164), 'telefone_validado_em', to_jsonb(now())),
    motivo
  );
end;
$$;

/**
 * Promove ou rebaixa o papel de alguém (RN12, RN14).
 *
 * O trigger `impedir_auto_promocao` continua valendo — esta função não o
 * contorna, ela é o caminho legítimo: roda como admin ou service_role, que é
 * exatamente o que o trigger permite.
 */
create or replace function public.promover_usuario(
  alvo uuid,
  novo_role public.user_role,
  motivo text
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  autor uuid;
  role_antes public.user_role;
begin
  autor := public.exigir_admin_e_motivo(motivo);

  select p.role into role_antes from public.profiles p where p.id = alvo;

  if role_antes is null then
    raise exception 'Perfil % não existe.', alvo using errcode = 'P0002';
  end if;

  if role_antes = novo_role then
    return;
  end if;

  update public.profiles set role = novo_role where id = alvo;

  insert into public.auditoria (tabela, registro_id, acao, profile_id, dados_antes, dados_depois, motivo)
  values (
    'profiles',
    alvo,
    'alteracao_role',
    autor,
    jsonb_build_object('role', role_antes),
    jsonb_build_object('role', novo_role),
    motivo
  );
end;
$$;

-- Executáveis por qualquer sessão autenticada — a checagem de admin está DENTRO
-- da função. Revogar de `public` evita que anon sequer tente.
revoke execute on function public.exigir_admin_e_motivo(text) from public;
revoke execute on function public.validar_telefone_manual(uuid, text, text) from public;
revoke execute on function public.promover_usuario(uuid, public.user_role, text) from public;

grant execute on function public.validar_telefone_manual(uuid, text, text) to authenticated, service_role;
grant execute on function public.promover_usuario(uuid, public.user_role, text) to authenticated, service_role;
