-- ─────────────────────────────────────────────────────────────────────────────
-- 0005_reservar_capacidade — A única garantia de atomicidade do motor (RN11).
--
-- ⚠️ REGRA QUE SUSTENTA O DESIGN: esta função NÃO calcula disponibilidade.
-- Ela recebe `p_limite` já calculado por `packages/core` e apenas garante,
-- sob lock, que a soma não o ultrapasse. Acrescentar aqui qualquer `if` de
-- negócio faz a regra passar a existir em dois lugares — é exatamente o risco
-- registrado em design.md §8, e o gatilho de revisão é este arquivo mudar.
-- ─────────────────────────────────────────────────────────────────────────────

-- Vagas já tomadas no dia para um produto: reservas vivas (não vencidas).
-- Pedidos pagos entram aqui em NAPO-006, quando `pedidos` existir.
create or replace function public.vagas_ocupadas(p_dia date, p_produto uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(quantidade), 0)::int
  from public.reservas
  where dia_entrega = p_dia
    and produto_id = p_produto
    and status = 'ativa'
    and expira_em > now();
$$;

comment on function public.vagas_ocupadas(date, uuid) is
  'Vagas vivas de um produto num dia. Reserva vencida é invisível sem job de limpeza (RN11).';

create or replace function public.reservar_capacidade(
  p_dia date,
  p_produto uuid,
  p_quantidade int,
  p_profile uuid,
  p_limite int
)
returns public.reservas
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ocupadas int;
  v_minutos int;
  v_reserva public.reservas;
begin
  if p_quantidade <= 0 then
    raise exception 'Quantidade da reserva deve ser positiva.' using errcode = '22023';
  end if;

  -- Serializa o trecho crítico por dia de entrega. Advisory lock em vez de
  -- SERIALIZABLE: a disputa vira espera curta em vez de tempestade de retry
  -- justamente no pico. Liberado no fim da transação.
  perform pg_advisory_xact_lock(hashtext(p_dia::text));

  v_ocupadas := public.vagas_ocupadas(p_dia, p_produto);

  if v_ocupadas + p_quantidade > p_limite then
    raise exception 'Sem vaga para % em % (ocupadas %, limite %).',
      p_produto, p_dia, v_ocupadas, p_limite
      using errcode = 'P0001';
  end if;

  select reserva_minutos into v_minutos from public.config_operacao limit 1;

  insert into public.reservas (profile_id, dia_entrega, produto_id, quantidade, expira_em)
  values (p_profile, p_dia, p_produto, p_quantidade,
          now() + make_interval(mins => coalesce(v_minutos, 15)))
  returning * into v_reserva;

  return v_reserva;
end;
$$;

comment on function public.reservar_capacidade(date, uuid, int, uuid, int) is
  'Cria a reserva do checkout sob advisory lock do dia. NÃO calcula disponibilidade: recebe o limite pronto de packages/core (design.md §3.2).';

-- Somente o servidor chama: o limite vem do núcleo, nunca do browser.
revoke execute on function public.reservar_capacidade(date, uuid, int, uuid, int) from anon, authenticated;
