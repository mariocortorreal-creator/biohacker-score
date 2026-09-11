# Activación y Retención — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir biohacker-score de una app que *pide* antes de *dar* (2 de 30 usuarios volvieron un segundo día; 0 entradas en 20 días) en un loop de hábito completo: el usuario recibe valor en el primer minuto, registra en un toque, recibe un insight distinto cada día, es recordado a la hora que eligió, y paga por lo que ya demostró querer (escáner y planes de dieta).

**Architecture:** Todo vive en `index.html` (React vía `React.createElement`, sin JSX, sin build). Las funciones puras nuevas van dentro de las secciones que los cargadores de test ya recortan por marcadores (`// ---------- ... ----------`) y se evalúan en un VM. La UI se monta como subárboles asignados a `const` antes de referenciarlos (convención del repo). Cada tarea termina en commit + push a `main`; Netlify despliega automáticamente en ~10 s, así cada mejora sale a producción de forma incremental y verificable.

**Tech Stack:** React 18 (CDN, `React.createElement`), Tailwind (CDN), Supabase PostgREST, Node `node --test` con VM slices (`test/lib/load-*.js`), Capacitor 8 + esbuild para `native-bridge.js`, Netlify (auto-deploy desde `main`).

**Spec:** Diagnóstico Hook y prioridades acordadas con Mario el 2026-09-10 (sesión de Claude Code). Datos base: 30 perfiles, 28 entradas totales, 2 usuarios con ≥2 días, última entrada 2026-08-21; 19 planes de dieta y 11 escaneos generados. Score Hook actual 1/10 (sin trigger externo, recompensa determinista, inversión sin siguiente trigger).

## Global Constraints

- **Un solo archivo de app:** todo el código de UI y lógica va en `index.html`. Nunca crear componentes en archivos aparte.
- **Sin JSX:** `React.createElement(...)` siempre. Subárboles complejos se asignan a `const` antes de usarlos (ver `premiumContentSection` en `Dashboard`).
- **Copy en español** con acentos correctos. Tono científico, directo, sin desesperación ni venta barata.
- **Paleta fija:** fondo `#060809`, panel `#11161F`, borde `#1E2535`, cian `#3DDCFF`, verde `#7FE3A3`, ámbar `#FFC857`, violeta `#C792FF`, rojo `#FF6B5E`. No introducir hex nuevos.
- **TDD obligatorio:** usuarios reales y datos de salud. Toda función pura nueva nace con un test que primero falla. Ninguna función pura sin test.
- **Tests:** `npm test` (lista explícita en `package.json` → añadir cada archivo de test nuevo ahí). Los cargadores en `test/lib/` recortan `index.html` entre marcadores de sección y exportan defensivamente (`typeof x !== "undefined" ? x : undefined`).
- **Ningún número inventado:** ninguna métrica se muestra con un valor por defecto que parezca real. Sin datos → `null` → la UI muestra `--` o el estado vacío.
- **Nunca gatear en `profiles.plan`:** el único gate premium es `isPremium` (RPC `is_premium`).
- **Cambios de esquema:** solo aditivos (columnas nullable). Cualquier migración se aplica **después** de que producción sirva el código que la entiende (lección del 2026-09-10: una migración de significado antes del deploy dejó a los usuarios sin poder entrar).
- **Commit por tarea** con `git config user.name "mariocortorreal-creator"` / `user.email "mariocortorreal@gmail.com"` (ya configurado en el repo). Push a `origin main` al cerrar cada tarea. Sin líneas de atribución en los mensajes.
- **Verificar producción tras cada push:** `curl -s "https://app.biohackerlatino.com/?v=$(date +%s)" | grep -c "<símbolo nuevo>"` debe devolver ≥1 antes de dar la tarea por cerrada.

---

## File Structure

| Archivo | Responsabilidad en este plan |
|---|---|
| `index.html` — sección `// ---------- Body composition -> nutrition direction ----------` | `BODY_STAGE_FAT_PCT`, `bmrMifflinStJeor`, `leanMassKg`, `bmrKatchMcArdle`, `estimatedMetabolicAge`, `ACTIVITY_FACTORS`, `tdeeFromBmr`, `startingPointDiagnosis` (Task 1) |
| `index.html` — sección `// ---------- Streaks & weekly comparison ----------` | `dailyInsight`, `INSIGHT_KINDS` (Task 4) |
| `index.html` — sección `// ---------- Daily entry fields ----------` | `QuickSleepCard` (Task 3) |
| `index.html` — `Dashboard` | `startingPointCard` (Task 2), reordenación del formulario y estado `showFullEntry` (Task 3), `insightCard` (Task 4), `reminderSection` + programación (Task 5), cambio de gates (Task 6) |
| `index.html` — `// ---------- Config ----------` | `REMINDER_TIME_KEY` (Task 5) |
| `src/native-bridge.js` | exponer `window.CapacitorLocalNotifications` (Task 5) |
| `package.json` | dependencia `@capacitor/local-notifications`, lista de tests |
| `test/lib/load-body-scale.js` | ampliar `EXPORT_NAMES` (Task 1) |
| `test/lib/load-scoring-engine.js` | ampliar `EXPORT_NAMES` con `dailyInsight`, `INSIGHT_KINDS` (Task 4) |
| `test/starting-point.test.js` | tests de Task 1 |
| `test/daily-insight.test.js` | tests de Task 4 |
| `supabase/migrations/20260910180000_profile_reminder_time.sql` | columna `reminder_time` (Task 5) |
| `docs/superpowers/plans/2026-09-10-activacion-retencion.md` | este plan |

---

### Task 1: Diagnóstico de punto de partida (funciones puras)

El primer minuto tiene que devolver algo. Con los datos que el perfil ya pide (edad, peso, altura, sexo, composición actual y objetivo, nivel de actividad) se calcula un diagnóstico sin necesidad de ningún registro diario: gasto en reposo (BMR), gasto diario (TDEE), % de grasa estimado a partir de la composición elegida, edad metabólica estimada y dirección nutricional.

**Sobre la edad metabólica:** es una estimación, no una medición. Se calcula como la edad a la que una persona promedio con el mismo peso y altura tendría el gasto en reposo que se le estima al usuario a partir de su masa magra. La UI la etiqueta siempre como "estimada" y dice que una báscula de bioimpedancia la afina. Nunca presentarla como dato clínico.

**Files:**
- Modify: `index.html` — sección `// ---------- Body composition -> nutrition direction ----------` (justo después de `suggestedGoals`)
- Modify: `test/lib/load-body-scale.js` — `EXPORT_NAMES`
- Create: `test/starting-point.test.js`
- Modify: `package.json` — añadir `test/starting-point.test.js` al script `test`

**Interfaces:**
- Consumes: `BODY_STAGE_AXES` (ya existe), `goalDirectionFromBody(current, target)` (ya existe), `GOAL_DIRECTION_LABELS` (ya existe), `clamp` **no** está en esta sección — definir un `clampNum` local o pasar sin clamp (ver implementación).
- Produces:
  - `BODY_STAGE_FAT_PCT: { male: {1..6: number}, female: {1..6: number} }` — % de grasa estimado por stage.
  - `bmrMifflinStJeor(weightKg, heightCm, age, gender) → number|null`
  - `leanMassKg(weightKg, fatPct) → number|null`
  - `bmrKatchMcArdle(leanKg) → number|null`
  - `estimatedMetabolicAge({ weightKg, heightCm, age, gender, stage }) → number|null` (entero, acotado a `[18, 80]` y a `age ± 15`)
  - `ACTIVITY_FACTORS: { sedentario: 1.2, ligero: 1.375, moderado: 1.55, activo: 1.725, muy_activo: 1.9 }`
  - `tdeeFromBmr(bmr, activityLevel) → number|null`
  - `startingPointDiagnosis(profile) → { bmr, tdee, fatPct, metabolicAge, chronologicalAge, direction, directionLabel, missing: string[] } | null` donde `profile = { weightKg, heightCm, age, gender, currentStage, targetStage, activityLevel }`. Si falta cualquier dato obligatorio devuelve `{ missing: [...] }` con los nombres de los campos que faltan y el resto en `null`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `test/starting-point.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadBodyScale } = require("./lib/load-body-scale");

const {
  BODY_STAGE_FAT_PCT,
  bmrMifflinStJeor,
  leanMassKg,
  bmrKatchMcArdle,
  estimatedMetabolicAge,
  ACTIVITY_FACTORS,
  tdeeFromBmr,
  startingPointDiagnosis,
} = loadBodyScale();

// ---------- fat % table ----------

test("BODY_STAGE_FAT_PCT covers all six stages for both genders", () => {
  for (const gender of ["male", "female"]) {
    for (let stage = 1; stage <= 6; stage++) {
      const pct = BODY_STAGE_FAT_PCT[gender][stage];
      assert.ok(Number.isFinite(pct) && pct > 0 && pct < 60, `${gender} stage ${stage}: ${pct}`);
    }
  }
});

test("women carry more essential fat than men at every stage", () => {
  // Women carry ~10 points more essential fat, so the same visual stage means more fat.
  for (let stage = 1; stage <= 6; stage++) {
    assert.ok(BODY_STAGE_FAT_PCT.female[stage] > BODY_STAGE_FAT_PCT.male[stage], `stage ${stage}`);
  }
});

test("fat % rises with the fat axis and falls with the muscle axis", () => {
  const m = BODY_STAGE_FAT_PCT.male;
  assert.ok(m[1] < m[2] && m[2] < m[3] && m[3] < m[4], "fat axis 1<2<3<4");
  assert.ok(m[6] < m[5] && m[5] < m[2], "muscle axis 6<5<promedio");
});

// ---------- BMR ----------

test("bmrMifflinStJeor matches the published formula for a man", () => {
  // 80 kg, 175 cm, 35 y: 10*80 + 6.25*175 - 5*35 + 5 = 1723.75
  assert.equal(bmrMifflinStJeor(80, 175, 35, "male"), 1723.75);
});

test("bmrMifflinStJeor matches the published formula for a woman", () => {
  // 60 kg, 165 cm, 30 y: 10*60 + 6.25*165 - 5*30 - 161 = 1320.25
  assert.equal(bmrMifflinStJeor(60, 165, 30, "female"), 1320.25);
});

test("bmrMifflinStJeor returns null when any input is missing or non-positive", () => {
  assert.equal(bmrMifflinStJeor(null, 175, 35, "male"), null);
  assert.equal(bmrMifflinStJeor(80, 0, 35, "male"), null);
  assert.equal(bmrMifflinStJeor(80, 175, 35, "other"), null);
});

test("leanMassKg and bmrKatchMcArdle follow their formulas", () => {
  assert.equal(leanMassKg(80, 25), 60);
  // 370 + 21.6 * 60 = 1666
  assert.equal(bmrKatchMcArdle(60), 1666);
  assert.equal(leanMassKg(null, 25), null);
  assert.equal(bmrKatchMcArdle(null), null);
});

// ---------- metabolic age ----------

test("estimatedMetabolicAge is higher than chronological age for an overweight body", () => {
  const age = estimatedMetabolicAge({ weightKg: 80, heightCm: 175, age: 35, gender: "male", stage: 3 });
  assert.ok(Number.isInteger(age), `expected integer, got ${age}`);
  assert.ok(age > 35, `expected > 35 for sobrepeso, got ${age}`);
});

test("estimatedMetabolicAge is lower than chronological age for a muscular body", () => {
  const age = estimatedMetabolicAge({ weightKg: 80, heightCm: 175, age: 35, gender: "male", stage: 6 });
  assert.ok(age < 35, `expected < 35 for musculoso, got ${age}`);
});

test("estimatedMetabolicAge never drifts more than 15 years from chronological age", () => {
  const obese = estimatedMetabolicAge({ weightKg: 130, heightCm: 170, age: 40, gender: "male", stage: 4 });
  const ripped = estimatedMetabolicAge({ weightKg: 95, heightCm: 180, age: 40, gender: "male", stage: 6 });
  assert.ok(obese <= 55, `obese drifted too far: ${obese}`);
  assert.ok(ripped >= 25, `ripped drifted too far: ${ripped}`);
});

test("estimatedMetabolicAge stays within 18 and 80", () => {
  assert.ok(estimatedMetabolicAge({ weightKg: 70, heightCm: 180, age: 19, gender: "male", stage: 6 }) >= 18);
  assert.ok(estimatedMetabolicAge({ weightKg: 120, heightCm: 160, age: 78, gender: "female", stage: 4 }) <= 80);
});

test("estimatedMetabolicAge returns null when the profile is incomplete", () => {
  assert.equal(estimatedMetabolicAge({ weightKg: 80, heightCm: 175, age: null, gender: "male", stage: 3 }), null);
  assert.equal(estimatedMetabolicAge({ weightKg: 80, heightCm: 175, age: 35, gender: "male", stage: null }), null);
});

// ---------- TDEE ----------

test("ACTIVITY_FACTORS uses the standard Harris-Benedict multipliers", () => {
  assert.equal(ACTIVITY_FACTORS.sedentario, 1.2);
  assert.equal(ACTIVITY_FACTORS.ligero, 1.375);
  assert.equal(ACTIVITY_FACTORS.moderado, 1.55);
  assert.equal(ACTIVITY_FACTORS.activo, 1.725);
  assert.equal(ACTIVITY_FACTORS.muy_activo, 1.9);
});

test("tdeeFromBmr multiplies by the activity factor and rounds to whole kcal", () => {
  assert.equal(tdeeFromBmr(1723.75, "moderado"), 2672);
  assert.equal(tdeeFromBmr(1723.75, "unknown"), null);
  assert.equal(tdeeFromBmr(null, "moderado"), null);
});

// ---------- the full diagnosis ----------

const fullProfile = {
  weightKg: 80, heightCm: 175, age: 35, gender: "male",
  currentStage: 2, targetStage: 5, activityLevel: "moderado",
};

test("startingPointDiagnosis assembles every number the first-minute card needs", () => {
  const d = startingPointDiagnosis(fullProfile);
  assert.deepEqual(d.missing, []);
  assert.equal(d.chronologicalAge, 35);
  assert.ok(Number.isInteger(d.metabolicAge));
  assert.ok(d.bmr > 1500 && d.bmr < 2000, `bmr ${d.bmr}`);
  assert.ok(d.tdee > d.bmr, "tdee must exceed bmr");
  assert.equal(d.fatPct, 22);
  assert.equal(d.direction, "recomp");
  assert.equal(d.directionLabel, "Perder grasa y ganar músculo");
});

test("startingPointDiagnosis names exactly what is missing instead of guessing", () => {
  const d = startingPointDiagnosis({ ...fullProfile, weightKg: null, activityLevel: "" });
  assert.deepEqual([...d.missing].sort(), ["activityLevel", "weightKg"]);
  assert.equal(d.bmr, null);
  assert.equal(d.metabolicAge, null);
});

test("startingPointDiagnosis returns null for a null profile", () => {
  assert.equal(startingPointDiagnosis(null), null);
});
```

- [ ] **Step 2: Añadir los nombres al cargador**

En `test/lib/load-body-scale.js`, `EXPORT_NAMES` pasa a:

```js
const EXPORT_NAMES = [
  "BODY_STAGE_AXES",
  "BODY_SCALE_VERSION",
  "goalDirectionFromBody",
  "migrateBodyStageV1ToV2",
  "GOAL_DIRECTION_LABELS",
  "suggestedGoals",
  "BODY_STAGE_FAT_PCT",
  "bmrMifflinStJeor",
  "leanMassKg",
  "bmrKatchMcArdle",
  "estimatedMetabolicAge",
  "ACTIVITY_FACTORS",
  "tdeeFromBmr",
  "startingPointDiagnosis",
];
```

- [ ] **Step 3: Registrar el test en package.json**

Añadir ` test/starting-point.test.js` al final del script `"test"` en `package.json`.

- [ ] **Step 4: Verificar que fallan**

Run: `node --test test/starting-point.test.js 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail` igual a `tests` (todas fallan con `is not a function` / `Cannot read properties of undefined`).

- [ ] **Step 5: Implementar en index.html**

En `index.html`, dentro de la sección `// ---------- Body composition -> nutrition direction ----------`, inmediatamente después de la función `suggestedGoals(...)` y antes de `const MAINTENANCE_KCAL_PER_KG`:

```js
// ---------- Starting-point diagnosis: value before the first daily entry ----------
// Everything the profile already asks for (age, weight, height, sex, composition,
// activity) is enough to hand the user a diagnosis on day one. Body fat comes from the
// visual stage they picked, so every figure derived from it is an estimate and the UI
// must say so; a bioimpedance scale is what turns it into a measurement.
const BODY_STAGE_FAT_PCT = {
    //       1 Delgado, 2 Promedio, 3 Sobrepeso, 4 Obesidad, 5 Atlético, 6 Musculoso
    male:   { 1: 15, 2: 22, 3: 28, 4: 36, 5: 13, 6: 10 },
    female: { 1: 22, 2: 30, 3: 36, 4: 44, 5: 21, 6: 18 },
};
function isPositiveNumber(n) {
    return typeof n === "number" && Number.isFinite(n) && n > 0;
}
function bmrMifflinStJeor(weightKg, heightCm, age, gender) {
    if (!isPositiveNumber(weightKg) || !isPositiveNumber(heightCm) || !isPositiveNumber(age))
        return null;
    if (gender !== "male" && gender !== "female")
        return null;
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return gender === "male" ? base + 5 : base - 161;
}
function leanMassKg(weightKg, fatPct) {
    if (!isPositiveNumber(weightKg) || typeof fatPct !== "number" || fatPct < 0 || fatPct >= 100)
        return null;
    return weightKg * (1 - fatPct / 100);
}
function bmrKatchMcArdle(leanKg) {
    if (!isPositiveNumber(leanKg))
        return null;
    return 370 + 21.6 * leanKg;
}
const METABOLIC_AGE_MIN = 18;
const METABOLIC_AGE_MAX = 80;
const METABOLIC_AGE_MAX_DRIFT = 15;
// The age at which an average person of this weight and height would have the resting
// expenditure we estimate from lean mass. Mifflin-St Jeor is linear in age (-5 kcal/yr),
// so it can be solved for age directly. Drift is capped: the fat % behind it is a visual
// estimate, and a 20-year swing would be claiming a precision the input doesn't have.
function estimatedMetabolicAge({ weightKg, heightCm, age, gender, stage }) {
    const table = BODY_STAGE_FAT_PCT[gender];
    if (!table || !isPositiveNumber(age))
        return null;
    const fatPct = table[stage];
    if (fatPct === undefined)
        return null;
    const realBmr = bmrKatchMcArdle(leanMassKg(weightKg, fatPct));
    if (realBmr == null || !isPositiveNumber(heightCm))
        return null;
    // Mifflin at age 0 for this body, then solve base - 5 * a = realBmr for a.
    const baseAtAgeZero = bmrMifflinStJeor(weightKg, heightCm, 1, gender) + 5;
    let solved = (baseAtAgeZero - realBmr) / 5;
    solved = Math.min(age + METABOLIC_AGE_MAX_DRIFT, Math.max(age - METABOLIC_AGE_MAX_DRIFT, solved));
    solved = Math.min(METABOLIC_AGE_MAX, Math.max(METABOLIC_AGE_MIN, solved));
    return Math.round(solved);
}
const ACTIVITY_FACTORS = { sedentario: 1.2, ligero: 1.375, moderado: 1.55, activo: 1.725, muy_activo: 1.9 };
function tdeeFromBmr(bmr, activityLevel) {
    const factor = ACTIVITY_FACTORS[activityLevel];
    if (!isPositiveNumber(bmr) || !factor)
        return null;
    return Math.round(bmr * factor);
}
function startingPointDiagnosis(profile) {
    if (!profile || typeof profile !== "object")
        return null;
    const { weightKg, heightCm, age, gender, currentStage, targetStage, activityLevel } = profile;
    const missing = [];
    if (!isPositiveNumber(weightKg)) missing.push("weightKg");
    if (!isPositiveNumber(heightCm)) missing.push("heightCm");
    if (!isPositiveNumber(age)) missing.push("age");
    if (gender !== "male" && gender !== "female") missing.push("gender");
    if (!BODY_STAGE_AXES[currentStage]) missing.push("currentStage");
    if (!BODY_STAGE_AXES[targetStage]) missing.push("targetStage");
    if (!ACTIVITY_FACTORS[activityLevel]) missing.push("activityLevel");
    const empty = { bmr: null, tdee: null, fatPct: null, metabolicAge: null, chronologicalAge: null, direction: null, directionLabel: null, missing };
    if (missing.length > 0)
        return empty;
    const bmr = Math.round(bmrMifflinStJeor(weightKg, heightCm, age, gender));
    const direction = goalDirectionFromBody(currentStage, targetStage);
    return {
        bmr,
        tdee: tdeeFromBmr(bmr, activityLevel),
        fatPct: BODY_STAGE_FAT_PCT[gender][currentStage],
        metabolicAge: estimatedMetabolicAge({ weightKg, heightCm, age, gender, stage: currentStage }),
        chronologicalAge: age,
        direction,
        directionLabel: GOAL_DIRECTION_LABELS[direction] || null,
        missing: [],
    };
}
```

- [ ] **Step 6: Verificar que pasan**

Run: `node --test test/starting-point.test.js 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`.

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`, `tests` ≥ 119.

Si el test "is lower than chronological age for a muscular body" falla porque el cap de deriva lo deja en 35: revisar que el musculoso (stage 6, 10 % de grasa) produce `realBmr` = 370 + 21.6·72 = 1925.2 y `baseAtAgeZero` = 1728.75 + 5 = 1733.75 ⇒ solved negativo ⇒ cap inferior `age − 15` = 20 ⇒ 20 < 35. Pasa. El sobrepeso (28 %): realBmr = 370 + 21.6·57.6 = 1614.16 ⇒ solved = (1733.75 − 1614.16)/5 = 23.9 … **eso da menor que 35, no mayor.** Esto significa que la fórmula tal cual está sesgada hacia abajo para todos porque Katch-McArdle da BMR más altos que Mifflin para el mismo cuerpo. **Corrección obligatoria antes de dar por buena la implementación:** calibrar comparando contra el BMR Mifflin del propio usuario, no contra la edad 0:

```js
    // Compare against what Mifflin predicts for THIS person at THEIR age; the lean-mass
    // estimate moves the answer up (more fat than average -> older) or down (more muscle).
    const mifflinAtOwnAge = bmrMifflinStJeor(weightKg, heightCm, age, gender);
    // Reference lean mass for this stage's gender at an "average" 22/30 % body fat.
    const referenceFat = gender === "male" ? BODY_STAGE_FAT_PCT.male[2] : BODY_STAGE_FAT_PCT.female[2];
    const referenceBmr = bmrKatchMcArdle(leanMassKg(weightKg, referenceFat));
    // Each 5 kcal/day of resting expenditure is worth one year in Mifflin.
    let solved = age + (referenceBmr - realBmr) / 5;
```

Sustituir el bloque `const baseAtAgeZero ... let solved = ...` por el de arriba y eliminar `mifflinAtOwnAge` si queda sin usar. Con esto: sobrepeso (28 %) ⇒ realBmr 1614.16, referenceBmr (22 %) = 370 + 21.6·62.4 = 1717.84 ⇒ solved = 35 + 20.7 ⇒ cap +15 ⇒ **50**. Musculoso (10 %) ⇒ realBmr 1925.2 ⇒ solved = 35 − 41.5 ⇒ cap −15 ⇒ **20**. Promedio (22 %) ⇒ **35** exacto. Volver a correr los tests: deben pasar todos.

- [ ] **Step 7: Commit y push**

```bash
git add index.html test/starting-point.test.js test/lib/load-body-scale.js package.json
git commit -m "feat: starting-point diagnosis (BMR, TDEE, estimated body fat and metabolic age)"
git push origin main
```

---

### Task 2: Tarjeta "Tu punto de partida" en Inicio

Se muestra en la pestaña Inicio **por encima del anillo de score** mientras el usuario tenga **cero entradas** (`entries.length === 0`). Cuando ya registró algo, desaparece (el score ocupa su lugar). Si el perfil está incompleto, la tarjeta dice exactamente qué falta y lleva al sitio donde se completa.

**Files:**
- Modify: `index.html` — `Dashboard`, justo antes del `return` que monta `main`; y dentro de `activeTab === "inicio"`, delante de `React.createElement(ScoreRing, ...)`.

**Interfaces:**
- Consumes: `startingPointDiagnosis(profile)` (Task 1); estado ya existente en `Dashboard`: `entries`, `weightKg` (buscar `const [weightKg` — si el nombre difiere, usar el real), `dietProfileDraft`/perfil cargado (`age`, `height_cm`, `activity_level` — se cargan en el `fetch` de `profiles` cerca de `body_gender`), `savedGender`/`savedCurrent`/`savedTarget` (nombres reales en `Dashboard` para `body_gender`, `body_current_stage`, `body_target_stage`), `setActiveTab`.
- Produces: `startingPointCard` (subárbol React) montado en Inicio.

- [ ] **Step 1: Localizar los nombres reales del estado**

Run: `grep -n "const \[weightKg\|const \[bodySaved\|const \[savedBody\|body_current_stage\b" index.html | head`
Run: `grep -n "const \[profileValues\|profileValues = \|age: data\[0\].age" index.html | head`
Anotar los nombres exactos de: peso guardado, género/stage guardados, edad/altura/actividad guardadas. Usarlos en el paso 2 en lugar de los nombres de ejemplo.

- [ ] **Step 2: Montar la tarjeta**

Dentro de `Dashboard`, antes del `return (React.createElement("div"...` principal, añadir (sustituyendo los nombres por los reales del paso 1):

```js
    // ---------- First minute: a diagnosis before any daily entry ----------
    const diagnosis = useMemo(() => startingPointDiagnosis({
        weightKg: weightKg != null ? Number(weightKg) : null,
        heightCm: profileValues.height_cm != null && profileValues.height_cm !== "" ? Number(profileValues.height_cm) : null,
        age: profileValues.age != null && profileValues.age !== "" ? Number(profileValues.age) : null,
        gender: savedGender || null,
        currentStage: savedCurrent || null,
        targetStage: savedTarget || null,
        activityLevel: profileValues.activity_level || null,
    }), [weightKg, profileValues, savedGender, savedCurrent, savedTarget]);
    const MISSING_LABELS = {
        weightKg: "tu peso", heightCm: "tu altura", age: "tu edad", gender: "tu sexo",
        currentStage: "tu composición actual", targetStage: "tu composición objetivo", activityLevel: "tu nivel de actividad",
    };
    let startingPointCard = null;
    if (entries.length === 0 && diagnosis) {
        const ageDelta = diagnosis.metabolicAge != null ? diagnosis.metabolicAge - diagnosis.chronologicalAge : null;
        const ageColor = ageDelta == null ? "#3DDCFF" : ageDelta > 0 ? "#FFC857" : ageDelta < 0 ? "#7FE3A3" : "#3DDCFF";
        const stat = (value, label, color) => React.createElement("div", { className: "text-center" },
            React.createElement("div", { className: "font-mono text-2xl", style: { color: color || "#F1F5F9" } }, value),
            React.createElement("div", { className: "text-[10px] uppercase tracking-wider text-slate-400 mt-1" }, label));
        const body = diagnosis.missing.length > 0
            ? React.createElement("div", null,
                React.createElement("p", { className: "text-sm text-slate-300" }, "Con tres datos te doy tu diagnóstico de arranque, sin registrar nada todavía."),
                React.createElement("p", { className: "text-xs text-slate-400 mt-2" }, "Falta: ", diagnosis.missing.map((k) => MISSING_LABELS[k]).join(", "), "."),
                React.createElement("button", { type: "button", onClick: () => setActiveTab("nutricion"), className: "mt-4 bg-[#3DDCFF] text-[#06121A] font-medium text-sm rounded-lg px-5 py-2 hover:brightness-110 transition" }, "Completar mis datos"))
            : React.createElement("div", null,
                React.createElement("div", { className: "grid grid-cols-3 gap-3" },
                    stat(`${diagnosis.metabolicAge}`, "edad metabólica est.", ageColor),
                    stat(`${diagnosis.bmr}`, "kcal en reposo"),
                    stat(`${diagnosis.tdee}`, "kcal al día")),
                React.createElement("div", { className: "mt-4 pt-4 border-t border-[#1E2535]" },
                    React.createElement("div", { className: "text-[10px] uppercase tracking-wider text-slate-400" }, "Tu dirección"),
                    React.createElement("div", { className: "text-sm text-slate-100 font-medium mt-0.5" }, diagnosis.directionLabel),
                    React.createElement("div", { className: "text-xs text-slate-400 mt-1" }, `Grasa corporal estimada: ~${diagnosis.fatPct} %. `,
                        ageDelta > 0 ? `Tu cuerpo gasta como uno ${ageDelta} años mayor: hay margen real de mejora.`
                            : ageDelta < 0 ? `Tu cuerpo gasta como uno ${Math.abs(ageDelta)} años más joven.`
                                : "Tu gasto en reposo está donde corresponde a tu edad.")),
                React.createElement("p", { className: "text-[11px] text-slate-500 mt-3" }, "Estimado a partir de tu composición visual. Una báscula de bioimpedancia lo afina."),
                React.createElement("div", { className: "flex flex-wrap gap-2 mt-4" },
                    React.createElement("button", { type: "button", onClick: () => setActiveTab("nutricion"), className: "bg-[#3DDCFF] text-[#06121A] font-medium text-sm rounded-lg px-5 py-2 hover:brightness-110 transition" }, "Generar mi plan de comidas"),
                    React.createElement("button", { type: "button", onClick: () => { const el = document.getElementById("registro-de-hoy"); if (el) el.scrollIntoView({ behavior: "smooth" }); }, className: "border border-[#1E2535] text-slate-300 text-sm rounded-lg px-5 py-2 hover:border-[#3DDCFF]/50 transition" }, "Registrar mi primera noche")));
        startingPointCard = React.createElement("section", { className: "w-full max-w-md bg-gradient-to-br from-[#11161F] to-[#060809] border border-[#3DDCFF]/30 rounded-2xl p-5 mb-8" },
            React.createElement("h2", { className: "text-xs uppercase tracking-[0.2em] text-[#3DDCFF] mb-4" }, "Tu punto de partida"),
            body);
    }
```

Después, en `activeTab === "inicio"`, inmediatamente antes de `React.createElement(ScoreRing, { categories: categories, total: total }),` añadir:

```js
                startingPointCard,
```

Y en la sección del formulario diario, al `<section>` que contiene el `h2` "Registro de hoy" añadirle `id: "registro-de-hoy"` en sus props.

- [ ] **Step 3: Verificar sintaxis y tests**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0` (el `syntax-check.test.js` parsea `index.html`).

- [ ] **Step 4: Verificar en navegador**

Arrancar `preview_start` con `name: "biohacker-score"` (config en `../.claude/launch.json`, sirve en `http://localhost:5055`). Inyectar por `javascript_tool` un render de prueba que llame a `startingPointDiagnosis` con un perfil completo y otro incompleto y confirme que devuelve números; la tarjeta completa solo se ve con sesión iniciada, así que la verificación visual final la hace Mario.

- [ ] **Step 5: Commit, push y verificar producción**

```bash
git add index.html
git commit -m "feat: starting-point card on Inicio for users with no entries yet"
git push origin main
```

Run (hasta 6 intentos con 10 s entre ellos, en background): `curl -s "https://app.biohackerlatino.com/?v=$(date +%s)" | grep -c "Tu punto de partida"`
Expected: `1`.

---

### Task 3: Registro rápido de un toque

El registro mínimo pasa a ser **solo el sueño**: las dos horas de reloj y "¿Cómo dormiste?". Con eso ya hay score. El resto (ayuno, comida, ejercicio, estrés) queda plegado bajo un botón "Registro completo". Al guardar solo sueño, los campos no tocados van como `null` (el motor ya los ignora).

**Files:**
- Modify: `index.html` — `Dashboard`: estado nuevo `showFullEntry`; la sección "Registro de hoy" (buscar `"Registro de hoy"`).

**Interfaces:**
- Consumes: componentes existentes `ClockPairField`, `ChoiceField`, `ChecklistField`, `MinutesField`; estado `bedtime/waketime/sleepQuality/...`; función `saveEntry` (o el nombre real del handler del botón guardar — localizar con `grep -n "daily_entries?on_conflict"`).
- Produces: nada nuevo para otras tareas.

- [ ] **Step 1: Leer el bloque actual**

Run: `sed -n "$(grep -n '"Registro de hoy"' index.html | cut -d: -f1),+40p" index.html`
Identificar: el `h2`, el contenedor `grid`/`space-y` con los 7 campos, y el botón "Guardar" con su handler.

- [ ] **Step 2: Añadir el estado**

Junto al resto de `useState` de `Dashboard`:

```js
    const [showFullEntry, setShowFullEntry] = useState(false);
```

- [ ] **Step 3: Reestructurar el bloque**

Sustituir el contenedor de los 7 campos por dos bloques. El primero, siempre visible:

```js
                const quickFields = React.createElement("div", { className: "space-y-3" },
                    React.createElement(ClockPairField, {
                        icon: Moon, label: "Sueño", color: "#3DDCFF",
                        startLabel: "Me acosté a las", endLabel: "Me levanté a las",
                        startValue: bedtime, endValue: waketime,
                        onStartChange: setBedtime, onEndChange: setWaketime,
                        derived: sleepHours, derivedUnit: "h",
                        hint: "Pon las dos horas y calculo lo que dormiste.",
                    }),
                    React.createElement(ChoiceField, { icon: Moon, label: "¿Cómo dormiste?", color: "#3DDCFF", options: SLEEP_QUALITY_OPTIONS, value: sleepQuality, onChange: setSleepQuality }));
                const fullFields = showFullEntry && React.createElement("div", { className: "space-y-3 mt-3" },
                    React.createElement(ClockPairField, {
                        icon: Flame, label: "Ayuno", color: "#7FE3A3",
                        startLabel: "Última comida de ayer", endLabel: "Primera comida de hoy",
                        startValue: lastMealTime, endValue: firstMealTime,
                        onStartChange: setLastMealTime, onEndChange: setFirstMealTime,
                        derived: fastingHours, derivedUnit: "h",
                        hint: "Con las dos horas calculo tu ventana de ayuno.",
                    }),
                    React.createElement(ChecklistField, { icon: Flame, label: "¿Qué comiste hoy?", color: "#7FE3A3", items: NUTRITION_CHECKLIST, checks: nutritionChecks || {}, onToggle: toggleNutritionCheck, derived: nutritionQuality }),
                    React.createElement(MinutesField, { icon: Activity, label: "Ejercicio", color: "#FFC857", value: exerciseMinutes, onChange: setExerciseMinutes }),
                    React.createElement(ChoiceField, { icon: Activity, label: "¿Qué tan fuerte fue?", color: "#FFC857", options: EXERCISE_INTENSITY_OPTIONS, value: exerciseIntensity, onChange: setExerciseIntensity }),
                    React.createElement(ChoiceField, { icon: Brain, label: "¿Cómo te sentiste de estrés?", color: "#C792FF", options: STRESS_LEVEL_OPTIONS, value: stressLevel, onChange: setStressLevel }));
                const fullToggle = React.createElement("button", {
                    type: "button",
                    onClick: () => setShowFullEntry((v) => !v),
                    className: "w-full mt-3 text-xs text-slate-400 hover:text-slate-200 border border-dashed border-[#1E2535] rounded-lg py-2 transition",
                }, showFullEntry ? "Ocultar el registro completo" : "Registro completo: ayuno, comida, ejercicio y estrés");
```

Estas tres `const` deben declararse **antes** del `return` de `Dashboard` (no dentro del árbol), y luego referenciarse dentro de la sección "Registro de hoy" en este orden: `quickFields, fullToggle, fullFields, <botón guardar existente>`.

El botón guardar existente cambia su texto a: `sleepHours != null && !showFullEntry ? "Guardar mi noche" : "Guardar el día"`.

- [ ] **Step 4: Abrir el registro completo automáticamente si el día ya tiene datos extra**

En el `useEffect`/bloque donde se carga `todayEntry` (donde se llama `setStoredFastingHours(...)`), añadir al final:

```js
                    setShowFullEntry(todayEntry.fasting_hours != null || todayEntry.exercise_minutes != null || todayEntry.stress_level != null || todayEntry.nutrition_quality != null);
```

- [ ] **Step 5: Tests y sintaxis**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`.

- [ ] **Step 6: Verificación visual**

Con el preview en `http://localhost:5055`, inyectar por `javascript_tool` un render de `ClockPairField` + `ChoiceField` + un botón que alterne un estado local, y hacer screenshot en móvil (`resize_window` preset `mobile`). Confirmar que con el toggle cerrado solo se ven dos tarjetas.

- [ ] **Step 7: Commit, push, verificar producción**

```bash
git add index.html
git commit -m "feat: one-tap daily entry — sleep first, everything else collapsed"
git push origin main
```

Run: `curl -s "https://app.biohackerlatino.com/?v=$(date +%s)" | grep -c "Registro completo: ayuno"`
Expected: `1`.

---

### Task 4: Insight diario variable (función pura + tarjeta)

Cada día que el usuario abre la app ve una frase distinta, derivada de sus propios datos. La variabilidad viene de dos sitios: los datos cambian, y entre varios insights igualmente válidos se elige uno con una semilla por fecha, así el mismo día siempre muestra el mismo (estable) pero mañana muestra otro.

**Files:**
- Modify: `index.html` — sección `// ---------- Streaks & weekly comparison ----------` (después de `weeklyComparison`)
- Modify: `test/lib/load-scoring-engine.js` — `EXPORT_NAMES` añade `"dailyInsight"`, `"INSIGHT_KINDS"`
- Create: `test/daily-insight.test.js`
- Modify: `package.json` — añadir el test
- Modify: `index.html` — `Dashboard`: `insightCard` en Inicio debajo de la racha

**Interfaces:**
- Consumes: `sleepScore`, `nutritionScore`, `exerciseScore`, `stressScore`, `totalScore`, `computeStreak`, `weeklyComparison` (todas existen en la misma sección).
- Produces: `INSIGHT_KINDS: string[]`; `dailyInsight(entries, goals, todayStr) → { kind, text, tone: "up"|"down"|"neutral" } | null`.

- [ ] **Step 1: Tests que fallan**

Crear `test/daily-insight.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadScoringEngine } = require("./lib/load-scoring-engine");

const { dailyInsight, INSIGHT_KINDS, DEFAULT_GOALS } = loadScoringEngine();

function isoDaysAgo(n, from = "2026-09-10") {
  const d = new Date(from + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
function entry(daysAgo, overrides) {
  return {
    entry_date: isoDaysAgo(daysAgo),
    sleep_hours: 7, sleep_quality: 7, fasting_hours: 14, nutrition_quality: 7,
    exercise_minutes: 30, exercise_intensity: 5, stress_level: 4,
    ...overrides,
  };
}
const TODAY = "2026-09-10";

test("dailyInsight returns null with no entries", () => {
  assert.equal(dailyInsight([], DEFAULT_GOALS, TODAY), null);
  assert.equal(dailyInsight(null, DEFAULT_GOALS, TODAY), null);
});

test("dailyInsight returns a well-formed insight for a single entry", () => {
  const insight = dailyInsight([entry(0)], DEFAULT_GOALS, TODAY);
  assert.ok(insight, "expected an insight");
  assert.ok(INSIGHT_KINDS.includes(insight.kind), `unknown kind ${insight.kind}`);
  assert.ok(typeof insight.text === "string" && insight.text.length > 10);
  assert.ok(["up", "down", "neutral"].includes(insight.tone));
});

test("dailyInsight is stable for the same data on the same day", () => {
  const entries = [entry(0), entry(1), entry(2)];
  const a = dailyInsight(entries, DEFAULT_GOALS, TODAY);
  const b = dailyInsight(entries, DEFAULT_GOALS, TODAY);
  assert.deepEqual(a, b);
});

test("dailyInsight varies across days for the same data when several insights apply", () => {
  // Enough history for streak, weekly comparison and sleep correlation to all be eligible.
  const entries = [];
  for (let i = 0; i < 14; i++) entries.push(entry(i, { sleep_hours: i % 2 ? 6 : 8, stress_level: i % 2 ? 7 : 3 }));
  const seen = new Set();
  for (let d = 0; d < 7; d++) {
    const ins = dailyInsight(entries, DEFAULT_GOALS, isoDaysAgo(-d));
    if (ins) seen.add(ins.kind);
  }
  assert.ok(seen.size >= 2, `expected at least 2 distinct insight kinds over a week, got ${[...seen]}`);
});

test("dailyInsight reports a weekly improvement with an 'up' tone", () => {
  const entries = [];
  for (let i = 0; i < 7; i++) entries.push(entry(i, { sleep_hours: 8, sleep_quality: 9, nutrition_quality: 9, exercise_minutes: 45, stress_level: 2 }));
  for (let i = 7; i < 14; i++) entries.push(entry(i, { sleep_hours: 5, sleep_quality: 4, nutrition_quality: 4, exercise_minutes: 0, stress_level: 8 }));
  // Force the weekly kind by scanning a week of dates until it comes up.
  let found = null;
  for (let d = 0; d < 7 && !found; d++) {
    const ins = dailyInsight(entries, DEFAULT_GOALS, isoDaysAgo(-d));
    if (ins && ins.kind === "weekly_delta") found = ins;
  }
  assert.ok(found, "weekly_delta insight never surfaced");
  assert.equal(found.tone, "up");
  assert.match(found.text, /semana/);
});

test("dailyInsight surfaces the sleep-stress link when the data shows one", () => {
  const entries = [];
  for (let i = 0; i < 10; i++) entries.push(entry(i, { sleep_hours: i % 2 ? 5.5 : 8, stress_level: i % 2 ? 8 : 2 }));
  let found = null;
  for (let d = 0; d < 10 && !found; d++) {
    const ins = dailyInsight(entries, DEFAULT_GOALS, isoDaysAgo(-d));
    if (ins && ins.kind === "sleep_stress_link") found = ins;
  }
  assert.ok(found, "sleep_stress_link never surfaced");
  assert.match(found.text, /dorm/);
});

test("dailyInsight never shows a weekly comparison with fewer than 2 weeks of data", () => {
  const entries = [entry(0), entry(1), entry(2)];
  for (let d = 0; d < 14; d++) {
    const ins = dailyInsight(entries, DEFAULT_GOALS, isoDaysAgo(-d));
    assert.notEqual(ins && ins.kind, "weekly_delta");
  }
});
```

- [ ] **Step 2: Ampliar el cargador y package.json**

En `test/lib/load-scoring-engine.js`, añadir `"dailyInsight"` y `"INSIGHT_KINDS"` a `EXPORT_NAMES`. **Ese cargador no exporta defensivamente**: mientras las funciones no existan, `pure-functions.test.js` fallará con `ReferenceError`. Es esperado y se resuelve en el Step 4; correr solo `test/daily-insight.test.js` en el Step 3.

En `package.json`, añadir ` test/daily-insight.test.js` al script `test`.

- [ ] **Step 3: Verificar RED**

Run: `node --test test/daily-insight.test.js 2>&1 | grep -E "^ℹ (tests|pass|fail)|ReferenceError" | head -3`
Expected: falla (ReferenceError `dailyInsight is not defined` al cargar).

- [ ] **Step 4: Implementar**

En `index.html`, dentro de `// ---------- Streaks & weekly comparison ----------`, después de `weeklyComparison`:

```js
// ---------- Daily insight: one different sentence per day, derived from the user's data ----------
// The score is deterministic, which makes opening the app predictable. This picks, among
// the insights the data currently supports, one per calendar day (seeded by the date), so
// the same day always shows the same line but tomorrow shows a different one.
const INSIGHT_KINDS = ["streak", "weekly_delta", "sleep_stress_link", "best_category", "sleep_vs_goal", "first_entry"];
function scoreEntry(e, goals) {
    return {
        sleep: sleepScore(e.sleep_hours, e.sleep_quality, goals.sleepHours),
        nutrition: nutritionScore(e.fasting_hours, e.nutrition_quality, goals.fastingHours),
        exercise: exerciseScore(e.exercise_minutes, e.exercise_intensity, goals.exerciseMinutes),
        stress: stressScore(e.stress_level, goals.stressMax),
    };
}
function daySeed(todayStr) {
    // Small deterministic hash of the date string; enough to rotate between candidates.
    let h = 0;
    for (let i = 0; i < todayStr.length; i++)
        h = (h * 31 + todayStr.charCodeAt(i)) >>> 0;
    return h;
}
function dailyInsight(entries, goals, todayStr) {
    if (!Array.isArray(entries) || entries.length === 0)
        return null;
    const g = goals || DEFAULT_GOALS;
    const candidates = [];
    if (entries.length === 1) {
        candidates.push({ kind: "first_entry", tone: "neutral", text: "Primer día registrado. Con tres más empiezo a ver tus patrones." });
    }
    const streak = computeStreak(entries);
    if (streak >= 2) {
        candidates.push({ kind: "streak", tone: "up", text: `${streak} días seguidos registrando. La constancia es el dato que más predice resultados.` });
    }
    const weekly = weeklyComparison(entries, g);
    if (weekly && weekly.lastAvg != null && weekly.deltaPct != null && Math.abs(weekly.deltaPct) >= 3) {
        const up = weekly.deltaPct > 0;
        candidates.push({
            kind: "weekly_delta",
            tone: up ? "up" : "down",
            text: up
                ? `Tu score de esta semana va ${Math.round(weekly.deltaPct)} % por encima de la semana pasada.`
                : `Tu score de esta semana va ${Math.abs(Math.round(weekly.deltaPct))} % por debajo de la semana pasada. Mira qué cambió.`,
        });
    }
    // Sleep <-> stress link: compare stress on nights with >= 7 h against nights with less.
    const withStress = entries.filter((e) => e.sleep_hours != null && e.stress_level != null);
    if (withStress.length >= 6) {
        const long = withStress.filter((e) => e.sleep_hours >= 7);
        const short = withStress.filter((e) => e.sleep_hours < 7);
        if (long.length >= 2 && short.length >= 2) {
            const avg = (arr) => arr.reduce((a, e) => a + e.stress_level, 0) / arr.length;
            const diff = avg(short) - avg(long);
            if (diff >= 1.5) {
                candidates.push({ kind: "sleep_stress_link", tone: "neutral", text: `Los días que dormiste menos de 7 h tu estrés subió ${diff.toFixed(1)} puntos. Dormir es tu palanca más barata.` });
            }
        }
    }
    // Best category over the last 7 entries.
    const recent = [...entries].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1)).slice(0, 7);
    if (recent.length >= 3) {
        const sums = { sleep: [], nutrition: [], exercise: [], stress: [] };
        recent.forEach((e) => {
            const s = scoreEntry(e, g);
            Object.keys(sums).forEach((k) => { if (s[k] != null) sums[k].push(s[k]); });
        });
        const avgs = Object.keys(sums).filter((k) => sums[k].length > 0).map((k) => ({ k, v: sums[k].reduce((a, b) => a + b, 0) / sums[k].length }));
        if (avgs.length >= 2) {
            avgs.sort((a, b) => b.v - a.v);
            const labels = { sleep: "el sueño", nutrition: "la nutrición", exercise: "el ejercicio", stress: "el estrés" };
            candidates.push({ kind: "best_category", tone: "up", text: `Tu punto más fuerte esta semana es ${labels[avgs[0].k]} (${Math.round(avgs[0].v)}). Tu mayor margen está en ${labels[avgs[avgs.length - 1].k]} (${Math.round(avgs[avgs.length - 1].v)}).` });
        }
    }
    // Sleep against goal.
    const sleeps = recent.filter((e) => e.sleep_hours != null);
    if (sleeps.length >= 3) {
        const avgSleep = sleeps.reduce((a, e) => a + e.sleep_hours, 0) / sleeps.length;
        const gap = g.sleepHours - avgSleep;
        if (gap >= 0.5) {
            candidates.push({ kind: "sleep_vs_goal", tone: "down", text: `Duermes ${avgSleep.toFixed(1)} h de media, ${gap.toFixed(1)} h por debajo de tu meta. Acostarte ${Math.round(gap * 60)} minutos antes lo cierra.` });
        } else if (gap <= -0.5) {
            candidates.push({ kind: "sleep_vs_goal", tone: "up", text: `Duermes ${avgSleep.toFixed(1)} h de media, por encima de tu meta. Ese margen se nota en el estrés.` });
        }
    }
    if (candidates.length === 0)
        return null;
    return candidates[daySeed(todayStr || "") % candidates.length];
}
```

- [ ] **Step 5: Verificar GREEN**

Run: `node --test test/daily-insight.test.js 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`.
Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`.

Si "varies across days" falla con solo 1 kind: comprobar que con 14 entradas alternando sueño 6/8 y estrés 7/3 se generan al menos `streak`, `best_category`, `sleep_stress_link` (diff = 4) y `sleep_vs_goal` (media 7.0 vs meta 8 ⇒ gap 1.0). Con 4 candidatos y 7 semillas distintas, ≥2 kinds es casi seguro; si la semilla cae siempre en el mismo índice, sustituir `daySeed` por `(h ^ (h >>> 16))` antes del módulo.

- [ ] **Step 6: Tarjeta en Inicio**

En `Dashboard`, después de `const streak = useMemo(...)`:

```js
    const insight = useMemo(() => dailyInsight(entries, goals, todayStr), [entries, goals, todayStr]);
    const insightCard = insight && React.createElement("div", { className: "w-full max-w-md mt-4 bg-[#11161F] border rounded-2xl px-4 py-3 flex items-start gap-3", style: { borderColor: insight.tone === "up" ? "#7FE3A355" : insight.tone === "down" ? "#FFC85755" : "#1E2535" } },
        React.createElement("span", { className: "font-mono text-lg leading-none mt-0.5", style: { color: insight.tone === "up" ? "#7FE3A3" : insight.tone === "down" ? "#FFC857" : "#3DDCFF" } }, insight.tone === "up" ? "↑" : insight.tone === "down" ? "↓" : "→"),
        React.createElement("p", { className: "text-sm text-slate-200 leading-relaxed" }, insight.text));
```

(`todayStr` ya existe en `Dashboard`; confirmar con `grep -n "const todayStr" index.html`.)

En `activeTab === "inicio"`, justo después del bloque de la racha (`streak > 0 && (...)`) y antes de `React.createElement(WeeklyShareCard, ...)`, añadir `insightCard,`.

- [ ] **Step 7: Tests, commit, push, producción**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"` → `fail 0`.

```bash
git add index.html test/daily-insight.test.js test/lib/load-scoring-engine.js package.json
git commit -m "feat: daily insight card — one data-derived sentence per day"
git push origin main
```

Run: `curl -s "https://app.biohackerlatino.com/?v=$(date +%s)" | grep -c "function dailyInsight"` → `1`.

---

### Task 5: Recordatorio diario (notificación local)

Sin trigger externo no hay hábito. El usuario elige una hora; la app programa una notificación local diaria con un texto que nombra la acción concreta. Solo funciona dentro de la app nativa (Capacitor); en el navegador el ajuste se guarda pero no se programa nada, y la UI lo dice.

**Files:**
- Modify: `package.json` — dependencia `@capacitor/local-notifications`
- Modify: `src/native-bridge.js` — exponer `window.CapacitorLocalNotifications`
- Modify: `index.html` — `// ---------- Config ----------`: `REMINDER_TIME_KEY`; `Dashboard`: estado `reminderTime`, `reminderSection`, `scheduleDailyReminder`
- Create: `supabase/migrations/20260910180000_profile_reminder_time.sql`
- Modify: `android/app/src/main/AndroidManifest.xml` — permiso `POST_NOTIFICATIONS` (Android 13+) si no está

**Interfaces:**
- Consumes: `window.Capacitor` (inyectado por el shell nativo), `window.CapacitorLocalNotifications` (este task), `computeStreak(entries)`, `clockToMinutes(hhmm)` (existe en Scoring engine).
- Produces: `scheduleDailyReminder(hhmm, streak) → Promise<boolean>`; `cancelDailyReminder() → Promise<void>`.

- [ ] **Step 1: Instalar el plugin**

Run: `npm install @capacitor/local-notifications@^8`
Expected: `package.json` lista `"@capacitor/local-notifications": "^8.x"` en `dependencies`.

- [ ] **Step 2: Exponerlo en el bridge**

En `src/native-bridge.js` añadir tras los imports existentes:

```js
import { LocalNotifications } from '@capacitor/local-notifications';
```

y tras `window.CapacitorInAppReview = InAppReview;`:

```js
window.CapacitorLocalNotifications = LocalNotifications;
```

- [ ] **Step 3: Migración aditiva**

Crear `supabase/migrations/20260910180000_profile_reminder_time.sql`:

```sql
-- Daily reminder preference. Nullable: no reminder until the user picks a time.
alter table public.profiles
  add column if not exists reminder_time time;

comment on column public.profiles.reminder_time is
  'Local clock time at which the app schedules the daily "log your night" notification. Null = no reminder.';
```

**Aplicarla solo después del push de esta tarea y de verificar que producción sirve el código nuevo** (es aditiva, así que el orden no rompe nada; se mantiene la regla por disciplina). Aplicar con el MCP de Supabase `apply_migration` (proyecto `bciwxtjgabbnuxjxrwzt`, nombre `profile_reminder_time`).

- [ ] **Step 4: Config y lógica en index.html**

En `// ---------- Config ----------`, tras `const REVIEW_PROMPT_KEY = ...`:

```js
const REMINDER_TIME_KEY = "biohacker_score_reminder_time";
const REMINDER_NOTIFICATION_ID = 4101;
```

En `Dashboard`, junto a los `useState`:

```js
    const [reminderTime, setReminderTime] = useState(() => { try { return localStorage.getItem(REMINDER_TIME_KEY) || ""; } catch (_e) { return ""; } });
    const [reminderStatus, setReminderStatus] = useState("");
```

Y como funciones dentro de `Dashboard` (antes del `return`):

```js
    const nativeNotifications = typeof window !== "undefined" && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.CapacitorLocalNotifications ? window.CapacitorLocalNotifications : null;
    async function cancelDailyReminder() {
        if (!nativeNotifications) return;
        try { await nativeNotifications.cancel({ notifications: [{ id: REMINDER_NOTIFICATION_ID }] }); } catch (_e) { /* nothing scheduled */ }
    }
    async function scheduleDailyReminder(hhmm, currentStreak) {
        if (!nativeNotifications) return false;
        const minutes = clockToMinutes(hhmm);
        if (minutes == null) return false;
        const perm = await nativeNotifications.requestPermissions();
        if (!perm || perm.display !== "granted") return false;
        await cancelDailyReminder();
        const body = currentStreak >= 2
            ? `Llevas ${currentStreak} días seguidos. Dos toques y sigues.`
            : "¿A qué hora te acostaste anoche? Con eso ya tienes tu score de hoy.";
        await nativeNotifications.schedule({ notifications: [{
            id: REMINDER_NOTIFICATION_ID,
            title: "Biohacker Score",
            body,
            schedule: { on: { hour: Math.floor(minutes / 60), minute: minutes % 60 }, allowWhileIdle: true },
        }] });
        return true;
    }
    async function saveReminderTime(hhmm) {
        setReminderTime(hhmm);
        try { if (hhmm) localStorage.setItem(REMINDER_TIME_KEY, hhmm); else localStorage.removeItem(REMINDER_TIME_KEY); } catch (_e) { /* storage unavailable */ }
        try {
            await fetch(`${REST}/profiles?id=eq.${session.user.id}`, { method: "PATCH", headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ reminder_time: hhmm || null }) });
        } catch (_e) { /* preference still lives in localStorage */ }
        if (!hhmm) { await cancelDailyReminder(); setReminderStatus("Recordatorio desactivado."); return; }
        const ok = await scheduleDailyReminder(hhmm, streak);
        setReminderStatus(ok ? `Te aviso todos los días a las ${hhmm}.` : nativeNotifications ? "No se pudo activar: revisa el permiso de notificaciones." : "Guardado. Los avisos llegan en la app del teléfono.");
    }
    const reminderSection = React.createElement("section", { className: "bg-[#11161F] border border-[#1E2535] rounded-2xl p-4" },
        React.createElement("div", { className: "flex items-center justify-between gap-3" },
            React.createElement("div", null,
                React.createElement("div", { className: "text-sm text-slate-200" }, "Recordatorio diario"),
                React.createElement("div", { className: "text-[11px] text-slate-400 mt-0.5" }, "Un aviso a la hora que elijas para registrar tu noche.")),
            React.createElement("input", { type: "time", value: reminderTime, onChange: (e) => saveReminderTime(e.target.value), "aria-label": "Hora del recordatorio diario", className: "bg-[#060809] border border-[#1E2535] rounded-lg px-3 py-2 text-slate-100 text-sm outline-none focus:border-[#3DDCFF]" })),
        reminderStatus && React.createElement("div", { className: "text-[11px] mt-2", style: { color: "#7FE3A3" } }, reminderStatus));
```

(`authHeaders` ya existe en `Dashboard`; `streak` viene de Task 4 o del `useMemo` original.)

Al cargar el perfil (el `fetch` de `profiles` con `select=goal_sleep_hours,...`), **añadir `reminder_time` al `select`** y, si viene un valor y `reminderTime` está vacío, `setReminderTime(clockFromDb(data[0].reminder_time))`.

Montar `reminderSection` en Inicio **debajo del formulario "Registro de hoy"** (misma sección, tras el botón guardar) — es donde el usuario acaba de invertir y donde la pregunta "¿te aviso mañana?" cierra el loop.

Re-programar al guardar una entrada con racha nueva: en el handler de guardado, tras el `POST` exitoso, si `reminderTime` tiene valor: `scheduleDailyReminder(reminderTime, computeStreak([...entries, savedEntry]))` (usar la lista actualizada que ya calcule el handler; si no la calcula, `streak + 1` es aceptable).

- [ ] **Step 5: Permiso Android**

Run: `grep -n "POST_NOTIFICATIONS" android/app/src/main/AndroidManifest.xml || echo FALTA`
Si falta, añadir dentro de `<manifest>` junto a los otros `<uses-permission>`:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
```

- [ ] **Step 6: Sync nativo y tests**

Invocar la skill `native-build` y seguir su sección de sync. Como mínimo:

Run: `npm run sync`
Expected: `www/native-bridge.js` reconstruido y `npx cap sync` sin errores. Si `cap sync` falla por SDK de Android ausente en esta máquina, es aceptable: el build lo hace Codemagic; dejar constancia en el mensaje de commit.

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"` → `fail 0`.

- [ ] **Step 7: Commit, push, migración, producción**

```bash
git add package.json package-lock.json src/native-bridge.js native-bridge.js www index.html supabase/migrations/20260910180000_profile_reminder_time.sql android/app/src/main/AndroidManifest.xml
git commit -m "feat: daily local-notification reminder at a user-chosen time"
git push origin main
```

Run: `curl -s "https://app.biohackerlatino.com/?v=$(date +%s)" | grep -c "Recordatorio diario"` → `1`.
Después, y solo después: aplicar la migración `profile_reminder_time`.

---

### Task 6: Mover el paywall

Lo que forma el hábito (registro, score, metas, recomendaciones del día) pasa a ser gratis. Lo que ya demostró demanda (planes de dieta, escáner de comida, recetas, suplementos) sigue premium. El teaser deja de decir "Accede a Premium ¡YA!" y nombra lo que se compra.

**Files:**
- Modify: `index.html` — `Dashboard`: gates de "Recomendaciones de hoy" (≈ línea del `isPremium ? (React.createElement("div", { className: "space-y-3" }` cerca de `weakestKey && React.createElement(ProtocolCard`) y de `activeTab === "metas"`; función `premiumTeaser`.

**Interfaces:**
- Consumes: `isPremium`, `premiumTeaser(label)`.
- Produces: nada.

- [ ] **Step 1: Localizar los dos gates**

Run: `grep -n 'activeTab === "metas"' index.html` y `grep -n "weakestKey && React.createElement(ProtocolCard" index.html`
Leer ±15 líneas alrededor de cada uno y confirmar que la forma es `isPremium ? (<contenido>) : (<teaser>)`.

- [ ] **Step 2: Quitar el gate de Metas**

En `activeTab === "metas" && React.createElement("section", {...}, isPremium ? (<A>) : (<teaser>))`, sustituir `isPremium ? (<A>) : (<teaser>)` por `<A>` — es decir, dejar solo la rama premium. Cuidado con los paréntesis: asignar `<A>` a `const metasContent = ...` justo antes del `return` de `Dashboard` y usar `metasContent` dentro de la sección.

- [ ] **Step 3: Quitar el gate de Recomendaciones de hoy**

Mismo tratamiento: la rama premium pasa a `const todayRecsContent = ...` y se usa sin condición. `ProtocolCard` (protocolo de 7 días de la categoría más débil) **sí sigue premium**: envolverlo como `isPremium ? React.createElement(ProtocolCard, { categoryKey: weakestKey }) : premiumTeaser("Protocolo de 7 días para tu punto débil")`.

- [ ] **Step 4: Copy del teaser**

En `premiumTeaser`, sustituir el texto `"Accede a Premium ¡YA!"` por `"Esto es Premium"` y, si existe un subtítulo, por: `"Planes de comida generados para ti, escáner de comida por foto, recetas y protocolos. Desde $9.99/mes."`. Mantener el botón/enlace de pago tal cual.

- [ ] **Step 5: Tests y verificación**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"` → `fail 0`.
Run: `grep -c "Accede a Premium ¡YA!" index.html` → `0`.

- [ ] **Step 6: Commit, push, producción**

```bash
git add index.html
git commit -m "feat: free habit loop — goals and daily recommendations no longer paywalled; premium is diet plans, scanner, recipes, protocols"
git push origin main
```

Run: `curl -s "https://app.biohackerlatino.com/?v=$(date +%s)" | grep -c "Esto es Premium"` → `1`.

---

### Task 7: Cierre — docs pendientes, verificación end-to-end y memoria

**Files:**
- Modify (commit): `MACRO_INPUT_FIX_REPORT.md`, `docs/marketing/ig-assets/build-carrusel-ashwagandha.py`, `docs/superpowers/plans/2026-07-17-visual-audit-fixes*.md`, `OFERTAS-PRIMER-COBRO-2026-08-19.md`, `docs/superpowers/plans/2026-09-10-activacion-retencion.md`
- Modify: `CLAUDE.md` del repo — actualizar las secciones "Scoring engine", "Body composition", "Premium gating" y "daily_entries" para reflejar el estado nuevo.

- [ ] **Step 1: Commit de los docs que estaban sin commitear**

```bash
git add MACRO_INPUT_FIX_REPORT.md docs/marketing/ig-assets/build-carrusel-ashwagandha.py docs/superpowers/plans/ OFERTAS-PRIMER-COBRO-2026-08-19.md
git commit -m "docs: commit pending reports and plans (line-ending normalisation + activation plan)"
```

- [ ] **Step 2: Actualizar CLAUDE.md del repo**

En `biohacker-score/CLAUDE.md`:
- En "Scoring engine" añadir: "Metric capture helpers (`clockToMinutes`, `hoursBetweenClock`, `sleepHoursFromClock`, `fastingHoursFromClock`, `nutritionQualityFromChecklist`, option tables) live in the same section; `dailyInsight` lives in Streaks."
- En "`daily_entries` table" añadir las columnas `sleep_bedtime`, `sleep_waketime`, `fast_last_meal`, `fast_first_meal`, `nutrition_checks` y que las derivadas se calculan en cliente.
- En "Body composition" sustituir la mención de 4 imágenes por: "`BODY_STAGES` (6 stages, two axes: 1-4 body fat, 5-6 muscle) + `BODY_STAGE_AXES`; `goalDirectionFromBody` returns `cut | bulk | recomp | maintain`; `profiles.body_scale_version = 2`; `startingPointDiagnosis` gives BMR/TDEE/estimated fat %/estimated metabolic age from the profile alone."
- En "Premium gating" sustituir la lista de secciones gateadas por: "Free: score, daily entry, goals, daily recommendations, daily insight, reminder. Premium (`isPremium`): diet plans, meal scanner, recipes (pro+), supplements, 7-day protocols."

- [ ] **Step 3: Push final y verificación completa en producción**

```bash
git push origin main
```

Run:
```bash
u="https://app.biohackerlatino.com/?v=$(date +%s)"; for s in "Tu punto de partida" "Registro completo: ayuno" "function dailyInsight" "Recordatorio diario" "Esto es Premium" "const BODY_STAGES"; do printf "%s  %s\n" "$(curl -s "$u" | grep -c "$s")" "$s"; done
```
Expected: `1` en las seis líneas.

- [ ] **Step 4: Memoria**

Actualizar `~/.claude/projects/C--Users-User-Desktop-proyecto1/memory/app_captura_metricas_y_escala_6_2026_09_10.md` con una sección "Activación y retención (mismo día)" que liste las 5 mejoras desplegadas, el score Hook antes (1/10) y la estimación después, y lo que sigue pendiente: Stripe live, RevenueCat, cuota Elite, las dos imágenes femeninas.

---

## Self-review

**Cobertura del spec:** (1) primer minuto → Tasks 1-2. (2) un toque → Task 3. (3) insight variable → Task 4. (4) notificación → Task 5. (5) paywall → Task 6. Cierre y docs → Task 7. ✔

**Placeholders:** ninguno; cada paso lleva el código. La corrección de la fórmula de edad metabólica está resuelta dentro del Step 6 de Task 1 con los números verificados a mano. ✔

**Consistencia de nombres:** `startingPointDiagnosis` (Tasks 1, 2), `dailyInsight`/`INSIGHT_KINDS` (Task 4, cargador), `clockToMinutes`/`clockFromDb` (existen; usadas en Task 5), `scheduleDailyReminder`/`cancelDailyReminder`/`saveReminderTime` (Task 5), `premiumTeaser` (existe; Task 6), `showFullEntry` (Task 3). ✔

**Riesgo conocido:** los nombres de estado de `Dashboard` para peso/perfil/composición guardada se localizan en el Step 1 de Task 2 en vez de asumirse; el implementador debe sustituirlos. ✔
