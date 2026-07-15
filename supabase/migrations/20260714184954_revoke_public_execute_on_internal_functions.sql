-- These SECURITY DEFINER functions are only meant to be called by:
--   - trusted server-side code using the service_role key (Edge Functions), or
--   - auth triggers (handle_new_user, start_trial_on_signup), which Postgres only
--     invokes in trigger context regardless of EXECUTE grants.
-- None of them are called directly by client-side code (confirmed: no .rpc() calls
-- in index.html), so the default PUBLIC/anon/authenticated EXECUTE grants Postgres
-- adds automatically on function creation are unnecessary attack surface:
--   - get_client_diet_quota(profile_id) and is_premium(profile_id) had NO internal
--     auth.uid() = profile_id check, so any anon caller could query any user's
--     billing tier / premium status by guessing or otherwise obtaining their UUID.
--   - add_coach_client_by_email/handle_new_user/start_trial_on_signup are already
--     safe (auth.uid() check, or trigger-only), but are revoked too for consistency
--     with the existing pattern in 20260710021207_revoke_public_execute_on_coach_cap_triggers.sql.
revoke execute on function public.get_client_diet_quota(uuid) from public, anon, authenticated;
revoke execute on function public.is_premium(uuid) from public, anon, authenticated;
revoke execute on function public.add_coach_client_by_email(text) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.start_trial_on_signup() from public, anon, authenticated;

-- add_coach_client_by_email is still called by real coaches from the authenticated
-- app session (it self-gates via auth.uid() being a row in public.coaches), so keep
-- that grant — only anon (fully unauthenticated) is revoked for it.
grant execute on function public.add_coach_client_by_email(text) to authenticated;
