-- goalDirectionFromBody now returns "recomp" (lose fat + gain muscle at once) for the
-- most common real goal (promedio/sobrepeso -> atlético). Without a matching row the
-- premium Nutrición tab showed "faltan datos" to 14 of the 16 profiles with a composition.
-- Applied to production 2026-09-11 (Supabase migration `nutrition_recommendations_recomp`).

alter table public.nutrition_recommendations
  drop constraint if exists nutrition_recommendations_goal_direction_check;
alter table public.nutrition_recommendations
  add constraint nutrition_recommendations_goal_direction_check
    check (goal_direction = any (array['cut'::text, 'bulk'::text, 'maintain'::text, 'recomp'::text]));

insert into public.nutrition_recommendations
  (goal_direction, title, macro_guidance, meal_timing_guidance, food_examples, foods_to_limit, adaptive_note, premium_only, display_order, protein_g_per_kg_min, protein_g_per_kg_max, calorie_adjustment_min, calorie_adjustment_max)
select
  'recomp',
  'Recomposición — perder grasa y ganar músculo a la vez',
  'Proteína muy alta: 2.0-2.4g por kg de peso corporal — es lo que permite construir músculo mientras el cuerpo usa la grasa como energía. Déficit leve de 100-250 kcal, no más: la recomposición ocurre cerca del mantenimiento, no en un déficit agresivo.',
  'Carbohidrato complejo en la comida previa y en la posterior al entrenamiento de fuerza; el resto del día, proteína + vegetales + grasa de calidad. Sin entrenamiento de fuerza no hay recomposición, solo un déficit lento.',
  'Pollo, pescado, huevo entero, yogur griego, carne magra, arroz o papa alrededor del entrenamiento, legumbres, aceite de oliva, frutos secos',
  'Déficit grande "para acelerar" (frena la ganancia muscular), alcohol frecuente, saltarte comidas con proteína los días de entrenamiento',
  'Si `exercise_minutes` del día fue bajo o nulo, mueve el carbohidrato de ese día a la cena y mantén la proteína — el estímulo de fuerza es el que decide si las calorías van a músculo o a grasa.',
  true,
  4,
  2.0,
  2.4,
  -250,
  -100
where not exists (select 1 from public.nutrition_recommendations where goal_direction = 'recomp');
