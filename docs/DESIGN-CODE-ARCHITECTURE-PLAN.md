# Design Code Architecture — Journey Tracker

**Feature:** Galería de recetas saludables (planes Pro/Elite)
**Started:** 2026-07-18
**Scope:** Feature addition to an existing, already-architected single-file app (not a greenfield app) — most phases are light-touch or skipped by design, not by omission. See "Why so many phases are skipped" below.

## Intake summary

1. **Feature & differentiator:** galería de recetas saludables (foto, ingredientes, preparación) exclusiva para planes Pro y Elite — primer feature de la app gateado por tier específico, no solo por premium sí/no.
2. **Stack:** sin cambios — sigue siendo el `index.html` único (React.createElement, sin build) + Supabase (Postgres/RLS) + Cloudinary para imágenes, mismo stack que todo lo demás.
3. **Carga esperada:** trivial. Contenido estático de solo lectura, mismo volumen de tráfico que `supplement_recommendations`/`exercises` hoy (decenas de usuarios, no miles).
4. **Dependencias salientes nuevas:** ninguna — Cloudinary ya está integrado (imágenes de composición corporal), se reutiliza tal cual.
5. **Sistema de registro:** tabla nueva `recipes` en Supabase, contenido curado manualmente por Mario vía SQL (mismo flujo que `supplement_recommendations` hoy). Sin segundo patrón de lectura (no hay búsqueda/analytics sobre recetas en v1).
6. **Validación:** decisión de producto de Mario para diferenciar los planes de pago; no requiere validación de mercado adicional, ya existe la base de usuarios/planes.
7. **Equipo:** una persona (Mario) + asistencia de Claude Code. Fase de team-topologies no aplica.

## Why so many phases are skipped

Este feature vive completamente dentro de un patrón arquitectónico que la app ya usa tres veces (contenido estático curado, RLS abierta, cache de 15 min). No hay boundary nuevo que trazar, no hay motor de datos nuevo que elegir, no hay carga real que dimensionar, no hay dependencia saliente nueva que hacer resiliente. Forzar las 8 fases completas sería ceremonia, no arquitectura — el principio del propio skill ("stay aggressively simple everywhere else") pide precisamente saltarlas aquí. La única decisión genuinamente nueva y cara-de-revertir es el gating por tier específico (primera vez en la app), así que ahí es donde se puso el esfuerzo real.

## Phase status

| Phase | Skill | Status | Note |
|---|---|---|---|
| 1 — Boundaries | clean-architecture | done (light) | Confirma que encaja en el patrón existente de contenido estático; no se traza boundary nuevo. |
| 2 — Domain | domain-driven-design | done | Recipe como agregado nuevo; el concepto realmente nuevo es el gating por tier (`tierAtLeast`). |
| 3 — Sizing | system-design | skipped: carga trivial, mismo volumen que exercises/supplement_recommendations hoy | — |
| 4 — Data | ddia-systems | done | Tabla `recipes`, jsonb para ingredients/steps, Cloudinary para imágenes. |
| 5 — Deep modules | software-design-philosophy | skipped: una tabla + un helper de 2 líneas, no hay superficie para classitis | — |
| 6 — Resilience | release-it | skipped: Cloudinary ya es dependencia existente y ya degrada bien (imagen rota nativa del navegador); sin dependencia saliente nueva | — |
| 7 — Tracer bullet | pragmatic-programmer | skipped: no hay vendor nuevo que abstraer; las URLs de Cloudinary ya se usan como strings crudos en todo el código existente, mismo estilo | — |
| 8 — Scope cut | 37signals-way | done | Corte explícito abajo. |
| Team topologies | team-topologies | skipped: equipo de una persona | — |

## Key Decisions

| # | Decisión | Por qué | Alternativas rechazadas |
|---|---|---|---|
| 1 | Tabla `recipes` nueva, mismo patrón que `supplement_recommendations`/`exercises` (RLS SELECT abierta a `authenticated`, sin gating server-side) | Consistencia con el resto de la app; el gating de contenido premium siempre fue responsabilidad del cliente (`isPremium` en `Dashboard`), no de RLS | RLS que oculte filas por tier — se rechazó porque rompe el patrón existente y complica el modelo de permisos sin necesidad real (el contenido no es sensible) |
| 2 | `ingredients` y `prep_steps` como columnas `jsonb` (array de strings) | Mismo patrón que `routines.content`; evita una tabla de ingredientes normalizada que nadie pidió | Tabla `recipe_ingredients` normalizada — rechazada, sobre-ingeniería para 20 recetas de solo lectura |
| 3 | Imágenes en Cloudinary, URL cruda en columna `image_url` | Cero integración nueva, mismo proveedor y mismo patrón (string crudo, sin capa de abstracción) que ya usa `BODY_IMAGES` | Supabase Storage — rechazada, agrega una integración nueva (buckets, políticas) sin beneficio real sobre lo que ya funciona |
| 4 | Gating por tier específico vía nuevo helper `tierAtLeast(tier, minTier)` sobre `TIER_ORDER = ["basico","pro","elite"]`, reutilizando `resolveClientTier` existente | Primera vez que la app necesita "tier X o superior" en vez de "premium sí/no"; 3 líneas de código, reutiliza toda la lógica de resolución de tier ya existente | Nueva columna booleana `can_see_recipes` en `profiles` calculada server-side — rechazada, duplica información que ya vive en `subscription_tier`/`subscription_plans`, fuente de verdad doble |
| 5 | v1 sin categorías, sin info nutricional, sin favoritos, sin búsqueda | Mantener el alcance al tamaño real del contenido (20 recetas) y del problema (mostrar una galería, no un sistema de recetas) | Construir todo desde el día 1 — rechazado, ninguna de esas piezas tiene evidencia de que se necesite todavía |

## Next Actions

- [ ] Mario decide y escribe (o me pasa) el contenido de las primeras ~20 recetas (título, foto en Cloudinary, ingredientes, pasos)
- [ ] Yo escribo la migración/SQL de la tabla `recipes` + el INSERT de las recetas (mismo flujo manual que supplement_recommendations — el INSERT probablemente necesite que Mario lo corra él mismo si el clasificador de auto-mode lo bloquea, como pasó antes)
- [ ] Yo implemento `tierAtLeast`/`TIER_ORDER`, la card de galería en el Dashboard, y el teaser borroso para usuarios Básico/Free
- [ ] Revisitar categorías/info nutricional/favoritos/búsqueda solo si el catálogo crece más allá de ~40-50 recetas o si Mario lo pide explícitamente (ver docs/TECH-DEBT.md)
