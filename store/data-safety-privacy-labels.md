# Data Safety (Google Play) y App Privacy / Nutrition Labels (Apple) — borrador de respuestas

**Fecha:** 2026-07-18. Basado en `store/privacy-policy-es.md` (la política ya publicada y en vivo) — las respuestas de abajo tienen que coincidir con esa política, porque Apple/Google rechazan la app si detectan que la ficha de privacidad dice algo distinto de lo que la app realmente hace.

**No es asesoría legal.** Esto es un mapeo de lo que el código realmente hace hacia las categorías exactas de cada formulario, para que Mario lo pegue en App Store Connect / Play Console cuando las cuentas existan. Los nombres exactos de checkboxes pueden variar un poco respecto a como están escritos aquí — verificar contra el formulario real al momento de llenarlo.

---

## Hallazgo importante antes de llenar el formulario

**`index.html` es el mismo archivo para la web y para la app nativa** (Capacitor solo lo empaqueta). Eso significa que el tag de Google Analytics 4 (`G-WRNF27NX4J`, `gtag.js`) que se agregó para medir la web **también corre dentro de la app nativa** — confirmado leyendo el archivo, no es una suposición. Esto es fácil de pasar por alto y es una causa real de rechazo/incumplimiento si no se declara: hay que declarar Google Analytics como colección de datos de uso/dispositivo en ambos formularios, no solo pensar en Supabase/Stripe.

Si Mario prefiere que la app nativa NO mande analytics (para simplificar la ficha de privacidad o por preferencia de privacidad), es una línea de código a condicionar (`if (!isNativePlatform) loadGA()`) — avisar si se quiere ese cambio antes de enviar a revisión.

---

## Google Play — Data Safety form

| Categoría de dato | ¿Se recolecta? | ¿Se comparte con terceros? | Propósito | ¿Opcional o requerido? | ¿Se puede borrar? |
|---|---|---|---|---|---|
| **Correo electrónico** | Sí | No | Funcionalidad de la cuenta (login) | Requerido | Sí — botón "Eliminar cuenta" en la app |
| **Información de salud** (sueño, ayuno, calidad nutricional, ejercicio, estrés, peso, composición corporal) | Sí | No a terceros externos. Ver nota sobre el coach abajo | Funcionalidad de la app (el producto ES esto) | Requerido para usar la app | Sí — se borra junto con la cuenta |
| **Información de estado físico (fitness)** | Sí (minutos/intensidad de ejercicio) | No | Funcionalidad de la app | Requerido | Sí |
| **Historial de compras** | Sí, pero procesado por Google Play Billing / RevenueCat, no almacenado por nosotros más allá de si la suscripción está activa | Con Google Play (billing) y RevenueCat como procesador | Gestión de la suscripción Premium | Opcional (solo si compra Premium) | Se cancela desde la app; el registro de la transacción en sí lo retiene Google/RevenueCat, no nosotros |
| **Identificadores de dispositivo / datos de uso de la app** | Sí — vía Google Analytics 4 (ver hallazgo arriba) | Sí, con Google (Analytics) | Analítica de uso | Este dato no tiene toggle de opt-out hoy en la app | No aplica directamente (es dato de Google Analytics, no una fila en nuestra base de datos) |

**Nota sobre el coach:** cuando un cliente se vincula con un coach, el coach puede ver el progreso/rutinas de ese cliente dentro de la app — esto es una función social/colaborativa del producto, no una "venta" ni "compartir con terceros externos" en el sentido que el formulario de Google penaliza, pero **hay que marcarlo explícitamente** en la sección de "compartido con otros usuarios" si el formulario de Play Console distingue esa categoría (a confirmar contra el formulario real).

**Encriptación en tránsito:** sí, todo pasa por HTTPS (Supabase REST sobre TLS).
**Sigue el estándar "Family Policy" / apto para todo público:** revisar si aplica dado que hay datos de salud — Google puede pedir contexto adicional para apps de salud.

---

## Apple App Privacy / Nutrition Labels

Apple organiza esto por "tipo de dato" → "vinculado a tu identidad o no" → "usado para rastrearte o no". Ninguno de estos datos se usa para *tracking* publicitario cross-app (no hay SDK de ads ni Facebook Pixel en el código) — eso simplifica bastante el formulario.

| Tipo de dato (categoría de Apple) | ¿Vinculado a tu identidad? | ¿Usado para tracking? | Propósito declarado |
|---|---|---|---|
| **Contact Info → Email Address** | Sí | No | App Functionality (cuenta/login) |
| **Health & Fitness → Health** (sueño, ayuno, estrés, nutrición, peso, composición corporal) | Sí | No | App Functionality |
| **Health & Fitness → Fitness** (ejercicio) | Sí | No | App Functionality |
| **Usage Data → Product Interaction** (Google Analytics, ver hallazgo arriba) | Depende de la config de GA4 (revisar si IP anonimizada) | No (no es tracking cross-app, es analítica propia) | Analytics |
| **Financial Info → Purchase History** | Vinculado a tu cuenta vía RevenueCat/StoreKit | No | App Functionality (gestión de suscripción) |

**Apple exige extra escrutinio para apps con datos de salud** (ya señalado en `submission-checklist.md`) — dejar tiempo de sobra en el timeline de revisión para este punto específico, no asumir que pasa en el primer intento.

---

## Antes de enviar a revisión

1. Confirmar con Mario si el GA4 dentro de la app nativa se queda o se desactiva (ver hallazgo arriba) — cambia una fila de ambos formularios.
2. Pegar las tablas de arriba en Play Console (Data Safety) y App Store Connect (App Privacy) tal cual, ajustando el wording exacto al que muestre cada consola en ese momento.
3. Doble-checar que esto coincide palabra por palabra en espíritu con `store/privacy-policy-es.md` — cualquier discrepancia entre lo declarado en la tienda y lo que dice la política pública es motivo de rechazo.
