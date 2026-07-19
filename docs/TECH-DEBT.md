# Tech Debt

Deliberately-taken debt from feature design, tracked with the trigger that would make it worth revisiting. Extended by the `design-code-architecture` skill's Phase 8 (37signals-way) — these are scope cuts, not accidents.

## Debt Ledger

| Feature | Cut for v1 | Why cut | Revisit trigger |
|---|---|---|---|
| Galería de recetas | Categorías/filtros (desayuno, almuerzo, snack, etc.) | Con 20 recetas una grilla plana es fácil de recorrer; categorías son ceremonia sin el volumen que las justifique | El catálogo crece más allá de ~40-50 recetas, o Mario reporta que a los usuarios les cuesta encontrar algo |
| Galería de recetas | Información nutricional por receta (calorías, macros) | Requiere carga manual extra por receta o integrar una API nutricional nueva (dependencia saliente nueva); sin evidencia de que se necesite todavía | Usuarios lo piden explícitamente, o se decide integrar una API nutricional por otra razón (ej. para el generador de dietas) que se pueda reutilizar acá |
| Galería de recetas | Favoritos/guardados | Feature de engagement real pero no bloquea el valor central (mostrar la receta) | Se lanza v1 y hay señal de que la gente vuelve seguido a las mismas recetas |
| Galería de recetas | Búsqueda por ingrediente | Con 20 recetas no hace falta; agrega superficie de UI sin necesidad real | El catálogo crece lo suficiente como para que desplazarse ya no alcance |

## Smell Inventory

_(vacío — Phase 5 se saltó para este feature por ser una tabla + un helper de 2 líneas, sin superficie real para módulos superficiales o fuga de información)_

## Adopted Conventions

- Contenido estático curado (recetas, suplementos, ejercicios, nutrición): siempre RLS abierta a `authenticated`, gating de acceso premium/tier resuelto en el cliente, nunca en RLS — mantiene un solo modelo de permisos en toda la app.
- Imágenes: siempre Cloudinary, URL cruda como string, sin capa de abstracción de proveedor — consistente con el resto del código de una sola página.
- Comparaciones de tier: siempre vía `TIER_ORDER`/`tierAtLeast()` sobre el `subscription_tier` ya resuelto por `resolveClientTier()` — nunca una columna booleana nueva que duplique esa fuente de verdad.
