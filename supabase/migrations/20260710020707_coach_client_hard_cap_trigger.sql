-- Hard cap of 25 clients per coach, enforced at the DB level (not just in the frontend),
-- so it applies whether a client is added via add_coach_client_by_email() or direct SQL.
create or replace function public.enforce_coach_client_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.coach_clients
  where coach_id = new.coach_id;

  if v_count >= 25 then
    raise exception 'Este coach ya alcanzó el máximo de 25 clientes (límite de la plataforma).'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_coach_client_limit on public.coach_clients;

create trigger trg_enforce_coach_client_limit
  before insert on public.coach_clients
  for each row
  execute function public.enforce_coach_client_limit();
