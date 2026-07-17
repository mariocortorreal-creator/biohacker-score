-- Closes a TOCTOU race in generate-diet-plan: the edge function checks monthly
-- usage via a separate SELECT (index.ts lines ~97-104) before a separate INSERT
-- (index.ts lines ~242-250), as two distinct HTTP round-trips through PostgREST.
-- N parallel requests from the same client can all pass the check before any of
-- them commits, bypassing the monthly quota on a real per-call Anthropic API cost.
--
-- This trigger re-checks the quota atomically inside the same transaction as the
-- INSERT. pg_advisory_xact_lock serializes concurrent inserts for the same
-- client_id (the lock is released automatically at transaction end), so two
-- concurrent requests from the same client can no longer both read a
-- pre-limit count before either commits — the second one blocks until the
-- first's transaction finishes, then sees the incremented count.
create or replace function public.enforce_diet_plan_quota()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_quota int;
  v_used int;
  v_month_start timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext(new.client_id::text));

  v_quota := public.get_client_diet_quota(new.client_id);
  v_month_start := date_trunc('month', now());

  select count(*) into v_used
  from public.diet_plans
  where client_id = new.client_id
    and generated_at >= v_month_start;

  if v_used >= v_quota then
    raise exception 'Cuota mensual de planes de alimentación alcanzada (% de %).', v_used, v_quota
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_diet_plan_quota() from public, anon, authenticated;

drop trigger if exists trg_enforce_diet_plan_quota on public.diet_plans;

create trigger trg_enforce_diet_plan_quota
  before insert on public.diet_plans
  for each row
  execute function public.enforce_diet_plan_quota();
