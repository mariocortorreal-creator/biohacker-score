-- Ejecutar en Supabase Studio > SQL Editor (proyecto bciwxtjgabbnuxjxrwzt).
-- Bloqueado para el asistente por el clasificador de auto-mode (mismo patrón que las migraciones);
-- los SELECT sí funcionan, los INSERT/escrituras en esta tabla no. Correr manualmente.
--
-- Agrega los 5 suplementos investigados el 18 julio 2026 (whey, ashwagandha, colágeno,
-- probióticos, melatonina). Los links de Amazon son búsquedas reales (no productos específicos
-- inventados) con tu tag de afiliado real, mismo patrón que los 5 suplementos ya existentes.
-- video_url queda NULL en los 5 hasta que tengas URLs reales de YouTube.

insert into supplement_recommendations (name, goal_category, why_it_works, dosage_range, evidence_tier, display_order, amazon_affiliate_url, video_url) values
('Proteína de suero (whey)', 'exercise_recovery', 'Perfil completo de aminoácidos con alta leucina y absorción rápida: la forma más práctica de cerrar la brecha cuando tu dieta no llega a la proteína total que necesita el músculo.', '20-40g por toma, según cuánto te falte para 1.6-2.2 g/kg/día total', 'strong', 6, 'https://www.amazon.com/s?k=proteina+whey+aislado&tag=biohackerlati-20', null),
('Ashwagandha (KSM-66)', 'stress', 'El extracto KSM-66 mostró una caída de 27.9% en cortisol sérico en un ensayo controlado de 60 días; un metaanálisis de 2025 con 873 adultos confirmó el efecto sobre cortisol y ansiedad.', '300mg de extracto KSM-66, dos veces al día', 'moderate', 7, 'https://www.amazon.com/s?k=ashwagandha+ksm-66&tag=biohackerlati-20', null),
('Colágeno hidrolizado', 'exercise_recovery', 'Los péptidos bioactivos sí llegan a la sangre y muestran mejoras en elasticidad de piel y dolor articular en ensayos clínicos, aunque el efecto es modesto y varios estudios positivos tienen financiamiento de la industria.', '10g/día, mínimo 8-12 semanas para ver efecto', 'moderate', 8, 'https://www.amazon.com/s?k=colageno+hidrolizado&tag=biohackerlati-20', null),
('Probióticos (multi-cepa)', 'fasting_metabolism', 'El efecto depende de la cepa específica, no de la especie: Lactobacillus rhamnosus GG, por ejemplo, redujo el riesgo de diarrea asociada a antibióticos de 22.4% a 12.3% en más de 1,300 pacientes.', 'Según cepa y objetivo; verifica que la etiqueta nombre la cepa exacta, no solo el género', 'moderate', 9, 'https://www.amazon.com/s?k=probioticos+multi+cepa&tag=biohackerlati-20', null),
('Melatonina', 'sleep', 'Es una señal circadiana, no un sedante: reduce el tiempo para quedarte dormido y es especialmente útil para jet lag y turnos nocturnos, no para insomnio general.', '0.5-3mg, 30-60 min antes de dormir (evita los frascos de 10mg)', 'moderate', 10, 'https://www.amazon.com/s?k=melatonina&tag=biohackerlati-20', null)
returning name, display_order, goal_category;
