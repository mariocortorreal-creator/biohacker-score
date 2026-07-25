-- Security audit finding M-1 (2026-07-25, AUDITORIA-SEGURIDAD-2026-07-25.md):
-- "Coach manages own client list" was a single FOR ALL policy with no
-- explicit WITH CHECK, so Postgres reused its USING clause (coach_id =
-- auth.uid()) for INSERT too. That let any authenticated coach POST directly
-- to /coach_clients with an arbitrary known client_id, bypassing every
-- validation add_coach_client_by_email enforces (no self-add, client not
-- already linked to another coach, email must belong to a real profile) --
-- handing out premium/routine assignment to a victim without consent.
--
-- Fix: split into SELECT/UPDATE/DELETE-only policies, all still scoped to
-- coach_id = auth.uid(), and deliberately omit an INSERT policy for the
-- `authenticated` role. add_coach_client_by_email is SECURITY DEFINER
-- (owned by `postgres`), so it still inserts fine -- it bypasses RLS
-- entirely as the table owner, it doesn't rely on this policy.
--
-- Note: a duplicate SELECT policy ("Coach reads own client list", same
-- expression) already exists on this table from an earlier migration, so a
-- new SELECT policy isn't recreated here to avoid a redundant policy of the
-- same effect -- only the missing UPDATE/DELETE policies are added.

drop policy if exists "Coach manages own client list" on public.coach_clients;

create policy "Coach updates own client list" on public.coach_clients
  for update to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

create policy "Coach deletes own client list" on public.coach_clients
  for delete to authenticated
  using (coach_id = auth.uid());
