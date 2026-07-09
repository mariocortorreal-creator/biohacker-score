-- These are trigger functions, not meant to be called directly via PostgREST RPC.
-- Postgres grants EXECUTE to PUBLIC by default on new functions; revoke it so only
-- the trigger mechanism (which runs as the function owner via SECURITY DEFINER,
-- independent of caller grants) can invoke them.
revoke execute on function public.enforce_coach_client_limit() from public, anon, authenticated;
revoke execute on function public.enforce_active_coach_cap() from public, anon, authenticated;
