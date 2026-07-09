-- FK columns Postgres does NOT auto-index, hit on every coach dashboard load
-- (client roster, routines list, assignments). Keeps the dashboard fast at the
-- 25-client cap instead of degrading to sequential scans.
create index if not exists coach_clients_coach_id_idx on public.coach_clients (coach_id);
create index if not exists routines_coach_id_idx on public.routines (coach_id);
create index if not exists routine_assignments_routine_id_idx on public.routine_assignments (routine_id);
create index if not exists routine_assignments_client_id_idx on public.routine_assignments (client_id);
