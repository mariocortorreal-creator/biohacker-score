-- Feature: independent users (no active coach) can generate and keep their own
-- workout routine, reusing the same generateAutoRoutine/RoutineBuilder logic already
-- used by coaches (index.html RoutineBuilder + a new handleCreateOwnRoutine handler,
-- rendered only when isPremium && !isCoach && !hasActiveCoach). Coach-linked clients
-- are unaffected — they still only ever see routines their coach assigns them. This
-- migration mirrors that same "active coach" boundary in RLS so the client-side render
-- check is not the only thing standing between a coach's client and self-service data.
--
-- "Has an active coach" is defined identically to how public.is_premium() already
-- treats the coach relationship (see 20260710020742_is_premium_realtime_coach_status.sql
-- and 20260714191049_restore_is_premium_authenticated_access_with_self_check.sql):
-- a coach_clients row exists AND the linked coaches.status = 'active'. Anything else
-- (no coach_clients row at all, or a row pointing at a lapsed/inactive coach) counts as
-- independent — matching Mario's confirmed spec that a client who loses their active
-- coach link should immediately regain self-service access, no manual intervention.

-- 1. Let a routine be owned directly by a client instead of by a coach. Exactly one of
--    coach_id / client_id must be set on any row — never both, never neither — so a
--    self-owned routine can never accidentally be mistaken for (or manipulated as) a
--    coach's routine or vice versa.
alter table public.routines
  add column if not exists client_id uuid references public.profiles(id) on delete cascade;

alter table public.routines
  add constraint routines_owner_exclusive_check
  check (num_nonnulls(coach_id, client_id) = 1);

create index if not exists routines_client_id_idx on public.routines (client_id);

-- 2. Reliable, IDOR-proof "does the calling user currently have an active coach" check,
--    callable directly from the browser (POST /rpc/has_active_coach, no arguments) and
--    reused inside the RLS policies below. It is always evaluated against auth.uid() —
--    there is no profile_id parameter, so there is nothing for a caller to spoof (same
--    shape as is_coach_of_routine/is_client_assigned_routine from the RLS-recursion fix).
create or replace function public.has_active_coach()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.coach_clients cc
    join public.coaches co on co.id = cc.coach_id
    where cc.client_id = auth.uid()
      and co.status = 'active'
  );
$$;

revoke execute on function public.has_active_coach() from public, anon;
grant execute on function public.has_active_coach() to authenticated;

-- 3. Ownership check for a self-owned routine, same SECURITY DEFINER pattern as
--    is_coach_of_routine/is_client_assigned_routine — lets the routine_assignments
--    policy below verify ownership without a direct cross-table join in the policy
--    body itself (that direct-join shape is exactly what caused the RLS recursion
--    incident fixed in 20260714194954).
create or replace function public.owns_self_routine(p_routine_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.routines r
    where r.id = p_routine_id and r.client_id = auth.uid()
  );
$$;

revoke execute on function public.owns_self_routine(uuid) from public, anon;
grant execute on function public.owns_self_routine(uuid) to authenticated;

-- 4. INSERT: an independent client may create a routine they own themselves. Blocked
--    outright (not just hidden in the UI) for anyone currently linked to an active
--    coach, so a coach's client can't route around the "coach assigns, client doesn't
--    self-serve" rule by calling the REST API directly instead of using the UI.
create policy "Independent client creates own routine"
  on public.routines for insert
  to authenticated
  with check (
    client_id = auth.uid()
    and coach_id is null
    and not public.has_active_coach()
    and public.is_premium(auth.uid())
  );

-- 5. INSERT: that same independent client may self-assign (only) a routine they just
--    created — never someone else's routine, and never while linked to an active coach.
--    This reuses the existing "Client reads assigned routines" SELECT policy on routines
--    (is_client_assigned_routine, from the recursion-fix migration) for free, so the
--    newly self-assigned routine shows up in "Mi rutina asignada" with no new SELECT
--    policy needed on routines.
create policy "Independent client self-assigns own routine"
  on public.routine_assignments for insert
  to authenticated
  with check (
    client_id = auth.uid()
    and public.owns_self_routine(routine_id)
    and not public.has_active_coach()
    and public.is_premium(auth.uid())
  );
