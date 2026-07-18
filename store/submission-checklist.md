# Checklist de publicación — estado real (última verificación 2026-07-18)

**Nota:** este archivo quedó desactualizado en dos puntos (verificado contra `index.html` y `store/privacy-policy-es.md` reales, no solo memoria) — corregido abajo. Ver `docs/marketing/plan-lanzamiento-30-dias.md` para el plan completo de lanzamiento.

## Bloqueadores de ingeniería antes de enviar a revisión

- [x] **Eliminación de cuenta dentro de la app.** ~~Apple exige esto (guideline 5.1.1v)~~ **Ya implementado** (2026-07-15): Edge Function `delete-account` con service role + UI de zona de peligro en la pestaña "Metas" (flujo de 3 pasos: advertencia → escribir "ELIMINAR" → confirmación), incluye cancelación de la suscripción de Stripe. Confirmado presente en `index.html` (2026-07-18).
- [ ] **App Privacy Labels (Apple) / Data Safety form (Google Play).** Como la app recolecta datos de salud (sueño, ejercicio, y opcionalmente Health/Health Connect), ambas tiendas exigen declarar explícitamente qué se recolecta y para qué. Health data en Apple específicamente activa requisitos extra de revisión — dejar tiempo de sobra en el timeline. **Sigue pendiente** — se llena directo en App Store Connect/Play Console, requiere que las cuentas de developer existan primero.

## Fase D — Investigación de comisiones por pago externo (2026-07-08)

**No es asesoría legal — esto es un resumen de lo público, para que decidan con criterio informado, no para comprometerse a una ruta todavía.**

**Apple (EE.UU.):** desde mayo 2025, Apple permite enlazar a pago externo (web) en el storefront de EE.UU., tras el fallo Epic v. Apple. Pero en diciembre 2025 una corte de apelaciones (9th Circuit) revirtió la prohibición total de comisión: Apple **puede volver a cobrar una "comisión razonable"** sobre compras hechas vía enlace externo — antes cobraba 27%, ahora un tribunal de distrito debe determinar qué porcentaje es "razonable" (limitado a costos "genuina y razonablemente necesarios" de coordinar el enlace, sin incluir seguridad/protección de datos). **Esto significa que la premisa original del spec — "el checkout externo evita la comisión" — ya no es tan clara: probablemente vuelva a haber una comisión, solo que menor al 30% original y aún sin definir.** Además, la excepción de "reader apps" (que sí pueden usar *solo* pago externo sin ofrecer IAP) es específica para apps de contenido tipo lectura/música/video — un app de coaching/fitness como Biohacker Score probablemente no califica ahí, lo que puede obligar a ofrecer también compra dentro de la app (IAP) en iOS.

**Google Play:** más permisivo. Programas de "Alternative Billing" y "External Content Links" ya activos para desarrolladores en EE.UU. (fecha límite de inscripción para quienes ya usaban esto: 28 enero 2026, ya pasada — inscribirse desde cero al llegar a ese punto). Tarifas vigentes hasta 30 junio 2026: ~10% en enlaces externos para suscripciones auto-renovables (con descuento en el primer millón de USD anuales para desarrolladores elegibles) vs. la comisión estándar de Play Billing.

**Jurisdicción:** todo lo anterior es específico de EE.UU. — el spec ya señalaba que no está claro si aplica igual fuera de EE.UU./UE, y esta búsqueda no lo resolvió (fuera de scope de esta sesión). Recomiendo confirmar puntualmente para el mercado real de Biohacker Score (¿EE.UU., LatAm, ambos?) antes de decidir.

**Recomendación práctica:** no comprometerse todavía a "checkout 100% externo sin IAP" en iOS. Contemplar que Biohacker Score probablemente necesite ofrecer compra dentro de la app en iOS (con la comisión de Apple) además de, o en vez de, el checkout externo de Stripe — a confirmar cuando haya más claridad sobre el porcentaje "razonable" que fije el tribunal y sobre si la categoría de la app permite algo distinto.

## Cuentas y costos (acción de Mario, no de Claude Code)

- [ ] Apple Developer Program — $99/año (requiere tarjeta/cuenta de pago; Claude Code no crea cuentas ni introduce datos de pago)
- [ ] Google Play Console — $25 pago único
- [ ] Cuenta de Codemagic (gratis para arrancar) — pendiente, es el siguiente paso antes de `cap add ios`

## Assets — ver `listing-es.md` y `privacy-policy-es.md` en esta misma carpeta

- [x] Descripción de tienda (en español, optimizada para ASO) — `listing-es.md`
- [x] Política de privacidad — **completa y en vivo**, ya no tiene `[corchetes]` pendientes (email de soporte, dirección, edad mínima 13 años llenados por Mario entre sesiones), confirmado sirviendo en `https://biohackerlatino.com/privacidad/`. ~~falta completar~~ corregido, este ítem estaba desactualizado.
- [x] Ícono de la app — `assets/icon-only.png` (cerebro wireframe 3D, coincide con la marca) ya existe.
- [ ] Capturas de pantalla — requieren la app corriendo en un dispositivo/emulador real; no se pueden generar desde este entorno de desarrollo (sin Android SDK/emulador). **Bloqueador real para publicar**, no solo para el ranking — ver plan de lanzamiento.
