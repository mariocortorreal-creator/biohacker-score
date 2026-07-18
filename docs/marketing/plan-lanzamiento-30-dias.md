# Plan director de lanzamiento — 30 días — Biohacker Score

**Inicio:** 18 julio 2026 · **Día 30:** ~17 agosto 2026
**Dirige:** Claude (marketing/ASO/contenido) + Mario (cuentas, pagos, dispositivo real, decisiones legales)
**Skills usados:** `launch` (marco ORB + 5 fases), `aso` (auditoría/optimización de ficha de tienda)

---

## 0. Chequeo de realidad honesto — antes de prometer nada

Pediste "top 10" en 30 días. Antes de armar el plan, esto es lo que hay que decir claro:

**La app hoy no está publicada en ninguna tienda.** Bloqueadores reales verificados en esta sesión (no supuestos):
- Cuentas de Apple Developer ($99/año) y Google Play Console ($25) — Mario las está tramitando, esperadas ~20 jul.
- RevenueCat: código completo, pero las claves siguen siendo placeholders (`REPLACE_WITH_REVENUECAT_...`) — depende de que existan las cuentas de arriba.
- **iOS no tiene pipeline de build firmado.** El workflow `ios-setup` en Codemagic solo genera el proyecto Xcode (`cap add ios`) — no archiva, firma ni sube nada. Hay que construir ese workflow desde cero (certificados, provisioning profiles) antes de poder someter a revisión.
- **Android sí tiene build automático** (`android-debug` en Codemagic, corre en cada push a `main`) pero produce un **APK de debug**, no un release firmado — Play Store exige un AAB/APK firmado con clave de release. Falta ese paso, pero es mucho más corto que armar el pipeline de iOS desde cero.
- Capturas de pantalla: no se pueden generar desde este entorno (sin SDK de Android/emulador ni dispositivo físico aquí) — es un bloqueador real para publicar, no solo para el ranking.
- App Privacy Labels (Apple) / Data Safety form (Google) — se llenan en las consolas, que aún no existen.
- Cero usuarios, cero reseñas, cero historial de descargas.

**Por qué "top 10 de la categoría Salud y Fitness" tal cual, en 30 días, en un mercado grande (ej. México completo) no es una meta creíble:** esa categoría la dominan apps con millones de usuarios (MyFitnessPal, Strava, Samsung Health, Fitbit, Calm) y el ranking se mueve principalmente por *velocidad de descargas concentradas* + volumen de reseñas + retención — cosas que no existen todavía y que $0 de presupuesto pagado no puede comprar de la nada en un mes.

**La meta que sí es alcanzable y todavía ambiciosa — y a la que voy a dirigir este plan:**

> **Top 10 en la lista "Novedades" (Nuevo y en tendencia) de la categoría Salud y Bienestar en Google Play México, dentro de los primeros 7-10 días desde que la app quede publicada.**

Por qué esta redefinición y no otra:
- **Google Play, no Apple, primero** — es la única plataforma con un camino real a estar publicada dentro de 30 días (Android ya tiene build automático; iOS necesita un pipeline que no existe). iOS avanza en paralelo pero su meta realista para el día 30 es "sometida a revisión o recién aprobada", no "rankeando".
- **Lista de Novedades, no el top general** — compite contra apps nuevas de la última semana/mes, no contra los gigantes establecidos. Es donde unos cientos de descargas concentradas el día de lanzamiento sí mueven la aguja.
- **México, no "LatAm" difuso** — un mercado específico concentra mejor un empujón de descargas con audiencia limitada que repartirlo entre 10 países. (Si tu audiencia real está más concentrada en otro país, dímelo y recalculamos el objetivo sobre ese mercado.)

Si insistes en medir contra el top 10 general de la categoría completa en México, lo puedo intentar, pero mi evaluación honesta es que la probabilidad con $0 de presupuesto pagado y cero base de usuarios es baja — y prefiero decírtelo ahora, no en el día 30.

---

## 1. Prioridades — en orden, no en paralelo desordenado

### P0 — Bloqueadores que tienen que resolverse antes de que cualquier táctica de marketing pueda mover el ranking (dueño: Mario, salvo donde digo "Claude")

| # | Bloqueador | Dueño | Nota |
|---|---|---|---|
| 1 | Cuenta Google Play Console activa | Mario | Esperada ~20 jul |
| 2 | Cuenta Apple Developer activa | Mario | Esperada ~20 jul (no bloquea el objetivo primario de Android) |
| 3 | Build de **release firmado** de Android (AAB) | Claude puede armar el workflow de Codemagic, pero Mario debe generar/guardar la keystore de firma — es un secreto que no debe vivir en el repo | Nuevo workflow, no existe hoy |
| 4 | RevenueCat: proyecto + productos reales en Play Console | Mario (cuenta) → Claude (código, ya listo) | Código ya completo, solo faltan las claves reales |
| 5 | Data Safety form (Google) | Mario, con ayuda de Claude para redactar las respuestas | Depende de #1 |
| 6 | Capturas de pantalla reales | Mario (necesita el APK corriendo en un dispositivo/emulador real) | Claude puede preparar los textos/orden de las capturas, no generarlas sin dispositivo |
| 7 | Cuenta demo para el revisor (si aplica a Android) | Claude puede crear los datos de ejemplo vía Supabase | Bajo, rápido |

**Sin estos 7, no hay "publicado" — y sin "publicado" no hay ranking que perseguir.** Esta fila manda sobre todo lo demás del plan.

### P1 — Lo que se ejecuta en paralelo mientras P0 se resuelve (esto no espera a nadie)

Ya cubierto en el plan de contenido anterior (`plan-contenido-video-investigacion-ads-2026-07.md`), reordenado aquí por lo que más mueve la meta de ranking específicamente:

1. **Ficha de tienda optimizada para ASO** — ✅ ya reescrita en `store/listing-es.md` en esta sesión (nombre con keywords, subtítulo de Apple nuevo, campo de keywords sin duplicados, descripción con mejor densidad).
2. **Acumular la lista de lanzamiento** (para el empujón de descargas del día 1) — todo contacto de `web_leads`, seguidores de IG/TikTok, grupo de WhatsApp/Telegram si existe, familia y amigos dispuestos a descargar y calificar el primer día. Esto es lo único que reemplaza presupuesto pagado para generar velocidad de descarga.
3. **Cerrar los gaps de video/contenido ya identificados** (2 videos de suplementos, 5 embeds de blog) — cada pieza de contenido nueva es una puerta de entrada más para captar interés antes del día de lanzamiento.
4. **Preparar (no lanzar todavía) la campaña del día de lanzamiento**: 1 post/Reel de "ya está disponible", mensaje directo a la lista de `web_leads`, mensaje a los 2-3 micro-influencers identificados en el plan anterior para pedirles que publiquen ese mismo día.
5. **Prompt de reseña dentro de la app** — pedir calificación en el momento de mayor satisfacción (ej. después de completar el 3er día seguido de registro, o al ver su Score subir). **Esto no existe todavía en el código** — lo marco como una pieza de producto nueva a construir, no solo de marketing, porque el volumen y la velocidad de reseñas es un factor de ranking real.

### P2 — Importante pero no gate del ranking de 30 días

- Configuración de iOS/build de Apple (avanza en paralelo, meta realista: sometida a revisión para el día 30, no publicada ni rankeando)
- Sentry / monitoreo de errores
- Migración del lead magnet (Jotform+Make) si Mario decide hacerlo
- Contenido de largo plazo del pilar "Ejercicio" que no alcance a salir antes del lanzamiento

---

## 2. Calendario de 30 días

| Días | Foco | Qué se mueve |
|---|---|---|
| **1-3** | P0: cuentas activas, arrancar el workflow de Android release firmado | Mario: cuentas + keystore. Claude: workflow de Codemagic para AAB firmado, redacción de Data Safety form. |
| **4-7** | P0: RevenueCat con claves reales, capturas de pantalla, cuenta demo | En cuanto haya un build instalable en un dispositivo real, generar capturas siguiendo el orden ya definido en `listing-es.md`. |
| **8-10** | **Enviar a revisión en Google Play.** Mientras se revisa (horas a pocos días en Android): terminar de acumular la lista de lanzamiento, cerrar los 2 videos de suplementos + 5 embeds pendientes | Este es el tramo más ajustado — si P0 se atrasa, todo el calendario se recorre, no la meta. |
| **11-13** | **Día de lanzamiento en Google Play** (asumiendo aprobación ~día 11-12): empujón coordinado — mensaje a `web_leads`, post/Reel de lanzamiento, aviso a micro-influencers, pedir a la lista personal que descargue y califique el mismo día 1 | Esta ventana de 48-72h concentradas es la que más pesa para entrar a "Novedades". |
| **14-20** | Sostener: 1 Short/Reel nuevo (del calendario del plan de contenido), responder cada reseña, seguir empujando la lista de lanzamiento en oleadas (no todo el día 1) | Reseñas + retención de los primeros usuarios importan tanto como las descargas iniciales. |
| **21-30** | Evaluar dónde quedó el ranking real en "Novedades" México, decidir si vale la pena el primer test pagado (solo si Stripe/RevenueCat ya cobran en modo real — ver plan de contenido, sección 5), avance de iOS hacia someter a revisión | Cierre del ciclo de 30 días con datos reales, no solo intención. |

---

## 3. Qué hace Claude directamente vs. qué necesita a Mario

**Claude puede hacer ya, sin esperar nada:**
- Armar el workflow de Codemagic para el build de release de Android (falta que Mario suba la keystore como secreto, pero el YAML se puede escribir ahora)
- Redactar las respuestas del Data Safety form (Google) y del Privacy Labels (Apple) — solo necesita que Mario las pegue en la consola
- Seguir cerrando el contenido pendiente (videos, embeds, artículos) del plan anterior
- Construir el prompt de reseña dentro de la app (nueva pieza de producto)
- Preparar los mensajes/copy exactos del día de lanzamiento (email a `web_leads`, post de redes, mensaje a influencers) para que estén listos, no para enviarlos sin tu ok

**Solo Mario puede:**
- Crear/pagar las cuentas de Apple/Google
- Generar y guardar la keystore de firma de Android (nunca debe vivir en el repo ni pasar por mí)
- Instalar el build en un dispositivo/emulador real para tomar las capturas
- Aprobar y enviar los mensajes del día de lanzamiento a su lista/red personal
- Decidir si el mercado objetivo es México u otro país

---

## Resumen de una línea

"Top 10 de la categoría completa en 30 días" no es creíble desde cero con $0 de presupuesto — la meta redirigida y perseguible es **top 10 en Novedades de Salud y Bienestar, Google Play México, en la primera semana desde que la app quede publicada**, y todo este plan existe para llegar publicados lo antes posible dentro de esos 30 días y concentrar el empujón de descargas en esa ventana.
