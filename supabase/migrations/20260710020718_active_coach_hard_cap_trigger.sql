-- Hard cap of 50 active coaches platform-wide. Blocks activation of coach #51 (whether
-- triggered by the Stripe webhook or a manual `update coaches set status = 'active'`),
-- and raises a clearly-greppable message so it shows up in Postgres/Supabase logs for
-- Mario to review rather than failing silently.
create or replace function public.enforce_active_coach_cap()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_active_count int;
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    select count(*) into v_active_count
    from public.coaches
    where status = 'active' and id <> new.id;

    if v_active_count >= 50 then
      raise exception 'COACH_CAP_REACHED: blocked activation of coach % — platform already has % active coaches (limit 50). Review manually before raising the cap.', new.id, v_active_count
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_active_coach_cap on public.coaches;

create trigger trg_enforce_active_coach_cap
  before insert or update on public.coaches
  for each row
  execute function public.enforce_active_coach_cap();
