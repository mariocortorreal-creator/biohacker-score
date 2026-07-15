-- Bug fix: "infinite recursion detected in policy for relation routines/routine_assignments"
-- (confirmed via Postgres logs, present since before this security-hardening session —
-- predates it, from whenever the coach-billing feature was first built). The routines
-- SELECT policy checks routine_assignments, and the routine_assignments ALL policy
-- checks routines — each evaluation re-triggers the other table's RLS, looping until
-- Postgres aborts with a 500. This is why "Tus rutinas" (coach) and "Mi rutina asignada"
-- (client) never rendered: every read failed silently on the client.
--
-- Fix: move each cross-table check into a SECURITY DEFINER function (same pattern
-- already used by is_premium/add_coach_client_by_email in this project). Functions
-- created by the table owner bypass that table's RLS internally, breaking the cycle.
--
-- Note: these helper functions are invoked FROM WITHIN RLS policies, which are
-- evaluated as the querying role (authenticated) — they need EXECUTE granted to
-- authenticated even though SECURITY DEFINER makes the function body itself run as
-- the owner. (Learned the hard way earlier in this same session with is_premium.)

create or replace function public.is_coach_of_routine(p_routine_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.routines r
    where r.id = p_routine_id and r.coach_id = auth.uid()
  );
$$;

create or replace function public.is_client_assigned_routine(p_routine_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.routine_assignments ra
    where ra.routine_id = p_routine_id and ra.client_id = auth.uid()
  );
$$;

revoke execute on function public.is_coach_of_routine(uuid) from public, anon;
revoke execute on function public.is_client_assigned_routine(uuid) from public, anon;
grant execute on function public.is_coach_of_routine(uuid) to authenticated;
grant execute on function public.is_client_assigned_routine(uuid) to authenticated;

drop policy if exists "Client reads assigned routines" on public.routines;
create policy "Client reads assigned routines"
  on public.routines for select
  to authenticated
  using (public.is_client_assigned_routine(id));

drop policy if exists "Coach manages assignments for own routines" on public.routine_assignments;
create policy "Coach manages assignments for own routines"
  on public.routine_assignments for all
  to authenticated
  using (public.is_coach_of_routine(routine_id))
  with check (public.is_coach_of_routine(routine_id));
