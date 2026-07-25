-- meal_photo_scans has no client UPDATE policy (writes are service-role only,
-- same as diet_plans), but the honesty-first design requires letting a user
-- correct the AI's estimate after reviewing it (see ANALISIS-FACTIBILIDAD-
-- MACRO-CAMARA.md §4/§5: never overwrite calories_est/etc., only ever add a
-- *_final correction). A blanket UPDATE RLS policy on client_id = auth.uid()
-- would let the client also rewrite the original _est columns, defeating the
-- audit purpose. This narrow SECURITY DEFINER RPC only ever touches the
-- *_final columns + edited_by_user, mirroring add_coach_client_by_email's
-- precedent for "RLS can't express this restriction, use an RPC" in this repo.
create or replace function public.update_meal_scan_correction(
  p_scan_id uuid,
  p_calories_final integer,
  p_protein_g_final numeric,
  p_carbs_g_final numeric,
  p_fat_g_final numeric
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.meal_photo_scans
  set calories_final = p_calories_final,
      protein_g_final = p_protein_g_final,
      carbs_g_final = p_carbs_g_final,
      fat_g_final = p_fat_g_final,
      edited_by_user = true
  where id = p_scan_id
    and client_id = auth.uid();

  if not found then
    raise exception 'Escaneo no encontrado.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.update_meal_scan_correction(uuid, integer, numeric, numeric, numeric) from public, anon;
grant execute on function public.update_meal_scan_correction(uuid, integer, numeric, numeric, numeric) to authenticated;
