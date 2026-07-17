-- Nullable YouTube link per supplement, rendered as a second "Ver el análisis" button on
-- biohackerlatino-web/suplementos/index.html next to the existing Amazon link
-- (amazon_affiliate_url on this same table). Null/absent means the button simply doesn't
-- render for that row — same non-event as a supplement currently missing a product photo.
alter table public.supplement_recommendations
  add column video_url text;
