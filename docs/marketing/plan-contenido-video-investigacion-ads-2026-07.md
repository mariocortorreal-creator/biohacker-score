# Plan de contenido, video, investigación de audiencia y promoción — Biohacker Latino

**Fecha:** 18 julio 2026
**Fase real del negocio:** pre-lanzamiento, bootstrapped, $0/mes de presupuesto de marketing pagado. App aún no está en tiendas (esperando cuentas de developer, previsto 20 jul 2026). Stripe en modo test (intencional, no bloqueante todavía).

Este documento cubre exactamente lo que se pidió: temas a investigar, videos a producir, investigación de intereses del futuro cliente, y cómo nos vamos a dar a conocer (anuncios/promoción). Está calibrado para lo que Mario puede ejecutar solo, con el teléfono y herramientas gratuitas — no es un plan de fCMO de 12 meses con presupuesto de ronda de inversión, porque esa no es la realidad del proyecto hoy.

---

## 0. Punto de partida real (para no planear en el vacío)

| Qué existe | Estado |
|---|---|
| 5 artículos de blog | Ayuno intermitente, cafeína+L-teanina, creatina, exposición al frío, magnesio para dormir |
| 5 fichas de suplementos | Cafeína+L-teanina ✅ video, Creatina ✅ video, Magnesio ✅ video, **Omega-3 ❌ sin video**, **Vitamina D3+K2 ❌ sin video** |
| YouTube Shorts publicados | 3: ducha fría, ashwagandha, creatina (viven en la sección "Mito contra verdad" del home) |
| Embed de YouTube al inicio del artículo | 0 de 5 artículos lo tienen (gap detectado en auditoría del 17 jul, pendiente de URLs) |
| Sección "Video Destacado" en home | No existe |
| Sección "Hacks por Categorías" en home | No existe |
| Lead magnet | Activo, guarda en tabla `web_leads` de Supabase (decisión pendiente: quedarse así o migrar a Jotform+Make) |
| Search Console | Verificado (17 jul) — **hay datos de búsquedas reales sin explotar todavía**, ver acción #1 abajo |
| Presupuesto pagado | $0/mes |
| Pilar de contenido más débil | Ejercicio/movimiento — 0 artículos, aunque es uno de los 4 scores de la app |

**Acción inmediata de bajo costo, antes que cualquier otra cosa de este plan:** entrar a Search Console (Rendimiento → Consultas) y revisar qué términos ya está trayendo tráfico o impresiones al sitio. Es investigación de audiencia gratis que ya está pagada y sin usar. Yo no tengo acceso directo a esos datos desde aquí — es un paso de 5 minutos para Mario.

---

## 1. Pilares de contenido

El producto mide 4 cosas (sueño, ayuno/nutrición, ejercicio, estrés), así que los pilares de contenido deben calcar eso — cada pilar conecta directo con una parte de la app, no son temas sueltos:

1. **Sueño y descanso** — magnesio, luz, temperatura, rutinas nocturnas
2. **Ayuno y nutrición** — ayuno intermitente, macros, creatina, cafeína
3. **Estrés y rendimiento mental** — frío, respiración, adaptógenos (ashwagandha)
4. **Movimiento / ejercicio** — rutinas, recuperación, fuerza — **pilar vacío hoy, 0 artículos**

Cada pilar en su madurez final: 1 artículo "hub" + 3-5 artículos "spoke" + 1 ficha de suplemento + 1-2 videos cortos, todos enlazados entre sí. Hoy el pilar de Ejercicio es la oportunidad de contenido más grande porque no compite con nada existente y conecta directo con uno de los 4 sliders de la app.

---

## 2. Temas a investigar y escribir

Prioridad por: qué tan directo conecta con lo que el producto ya hace (`biohacker-score`), qué tan vacío está el pilar, y qué tan fácil es de producir sin datos que aún no tenemos (volumen de búsqueda real vendrá de Search Console, acción #1).

| # | Tema | Pilar | Etapa del comprador | Formato | Por qué ahora |
|---|---|---|---|---|---|
| 1 | "¿Qué es el Score de Biohacking?" — explicador de cómo la app calcula sueño/ayuno/ejercicio/estrés | Transversal | Awareness → Decisión | Artículo + video corto | Es contenido "producto" que además sirve de landing para SEO de marca; no existe hoy |
| 2 | Rutina de fuerza mínima viable (3 días/semana) para gente que no pisa gimnasio | Ejercicio | Awareness | Artículo pilar (hub) | Pilar vacío, alto potencial de compartir |
| 3 | Zona 2 / cardio de baja intensidad: qué es y por qué los biohackers la usan | Ejercicio | Awareness | Artículo spoke | Tema con tracción fuerte en biohacking angloparlante, casi sin cobertura en español |
| 4 | Omega-3: cuál comprar y cuál evitar (EPA/DHA, forma triglicérido vs. etil-éster) | Ayuno/nutrición | Consideración | Artículo + ficha de suplemento (ya existe, falta contenido y video) | Cierra el gap de video ya identificado; mismo molde que magnesio/creatina que ya funcionó |
| 5 | Vitamina D3+K2: dosis real, por qué van juntas | Sueño / transversal | Consideración | Artículo + ficha de suplemento | Mismo gap que #4 |
| 6 | Mejores apps de biohacking en español (comparativa) | Transversal | Consideración | Artículo comparativo | Categoría de "vs./alternativas" — casi no hay competencia en español, oportunidad de posicionarse como la opción nativa |
| 7 | Cómo armar tu propio protocolo de exposición al frío en casa (sin crioterapia cara) | Estrés | Implementación | Artículo spoke + video | Profundiza el artículo de frío ya publicado, con pasos accionables |
| 8 | Ashwagandha: qué dice la evidencia real (más allá del Short ya publicado) | Estrés | Consideración | Artículo | El Short de ashwagandha ya existe sin artículo de respaldo — cierre de embudo fácil |
| 9 | Ayuno intermitente para mujeres: qué cambia | Ayuno/nutrición | Awareness (segmento específico) | Artículo spoke | Segmento con dudas específicas y muy buscado, no cubierto |
| 10 | "Biohacking de bajo presupuesto": 10 hábitos gratis que mueven el score | Transversal | Awareness | Artículo + video shareable | Contenido diseñado para compartirse (shareable, no solo buscable) — baja fricción, alto potencial viral |
| 11 | Cafeína + entrenamiento: timing real antes de entrenar | Ejercicio / Ayuno | Implementación | Artículo spoke | Conecta 2 pilares, aprovecha el artículo de cafeína+L-teanina ya existente |
| 12 | Historias reales: "Mi score subió de 40 a 80 en 60 días" (usuario real, cuando existan) | Transversal | Decisión | Artículo caso + video | Requiere usuarios activos primero — anotado como pendiente hasta tener 1-2 casos reales |

**Nota sobre investigación de palabras clave:** esta tabla está priorizada por relevancia de producto y huecos de contenido, no por volumen de búsqueda real todavía — eso se corrige con la acción #1 (Search Console) y, más adelante, con Google Trends / respuestas del lead magnet.

---

## 3. Investigación de intereses del futuro cliente

### Lo que ya encontré en esta sesión (research rápido, hoy)

- **Reddit en español sobre biohacking es casi inexistente** — las búsquedas devuelven hilos de r/Biohackers (en inglés) con traducción automática de título. Esto es una señal importante: **no hay una comunidad nativa en español establecida todavía** — es un vacío que Biohacker Latino puede ocupar, no un mercado saturado que hay que pelear.
- **Contenido en español que sí está funcionando:** el podcast "Tengo un Plan" tiene un video de rutina diaria de salud/biohacking con ~50K vistas — señal de que el formato "rutina diaria" funciona en español. Ray Ramis aparece como "experto en bio-hacking" con contenido tipo "cómo sentirte con 20 años a los 40". Biogena.com tiene un blog de biohacking en español (más corporativo/farmacéutico, no un competidor directo pero sí referencia de estructura).
- Esto sugiere que el ángulo ganador en español no es "biohacking extremo" (crionerapia, nootrópicos raros) sino **biohacking práctico y con evidencia** — que es exactamente el posicionamiento actual del sitio ("Biohacking con evidencia, en español"). No cambiar el posicionamiento, doblar la apuesta en él.

### Investigación continua que Mario puede correr sin gastar dinero

1. **Minar las respuestas del lead magnet** (`web_leads`) — si el formulario captura algo más que el email (interés, objetivo), revisar patrones cada 2-4 semanas. Si solo captura email, considerar agregar 1 campo opcional ("¿qué te gustaría mejorar primero: sueño, ayuno, ejercicio o estrés?") — da segmentación gratis y de intención real.
2. **Comentarios en los propios Shorts/Reels** — leer qué preguntan o objetan en los 3 Shorts ya publicados; es la señal más barata y más ignorada.
3. **Comentarios en contenido de competencia/referencia** (Tengo un Plan, Ray Ramis) — no para copiar, sino para ver qué preguntas repetidas aparecen ahí que Biohacker Latino podría responder mejor.
4. **Encuesta de 1 pregunta en Instagram/TikTok Stories** ("¿Qué te cuesta más: dormir bien, no comer de más, moverte, o el estrés?") — validación directa de qué pilar priorizar en contenido.
5. **Cuando existan usuarios reales de la app:** revisar qué metas configuran con más frecuencia (`goal_sleep_hours`, `goal_fasting_hours`, etc. — dato que ya vive en Supabase) — es investigación de intereses que el producto ya está generando y que hoy no se está mirando con lente de marketing.
6. **Cuando la app esté en tiendas:** las reseñas de 1-3 estrellas son la fuente de mayor señal para saber qué falta o confunde (siguiendo el mismo principio que usan equipos de soporte/research: las quejas no filtradas valen más que los elogios).

---

## 4. Videos a producir

### A. Cerrar gaps que ya están identificados (prioridad más alta — barato y rápido)

| Video | Qué es | Duración | Dónde vive | Prioridad |
|---|---|---|---|---|
| Omega-3: análisis | Mismo formato que los 3 ya hechos (cafeína+L-teanina, creatina, magnesio) | 3-6 min | `suplementos/index.html` | Alta — cierra el gap de 2/5, patrón ya probado |
| Vitamina D3+K2: análisis | Mismo formato | 3-6 min | `suplementos/index.html` | Alta |
| 5 embeds de apertura de artículo | Un video corto (puede ser el Short correspondiente o uno nuevo) insertado al inicio de cada uno de los 5 artículos de blog | 1-3 min | Cada artículo del blog | Alta — gap de 0/5 señalado en auditoría, y ya hay 3 Shorts que pueden reutilizarse para 3 de los 5 |

### B. Contenido nuevo para el home (decisión de diseño + contenido, no solo código)

| Video/sección | Qué es | Prioridad |
|---|---|---|
| "Video Destacado" | Un video ancla en el home — candidato natural: el explicador del Score de Biohacking (tema #1 de la sección 2) | Media-alta, requiere decidir el contenido antes de que se pueda construir la sección |
| "Hacks por Categorías" | Grid de videos cortos organizados por los 4 pilares (sueño/ayuno/ejercicio/estrés) — reutiliza los Shorts existentes + los nuevos | Media, depende de tener al menos 1-2 videos por pilar primero (hoy Ejercicio no tiene ninguno) |

### C. Formato de crecimiento — Shorts/Reels nuevos (bajo costo, alta frecuencia)

Objetivo: 1 Short/Reel nuevo por semana, filmado con el teléfono, sin producción cara — el formato que domina orgánico en 2026 es nativo, no pulido.

Ideas concretas para las próximas 8 semanas (una por pilar, rotando):
1. "3 segundos de agua fría no hacen nada — esto es lo que sí" (refuerza el artículo de frío ya existente)
2. Rutina de fuerza de 10 minutos sin gimnasio (cierra el pilar Ejercicio)
3. "Por qué tu magnesio no te está ayudando a dormir" (gancho de mito, mismo ángulo que la serie "Mito contra verdad")
4. Timing real de cafeína antes de entrenar
5. Demo de 20 segundos de cómo se ve el Score en la app (contenido de producto, no solo educativo)
6. Ayuno intermitente: el error #1 que comete la gente al empezar
7. Omega-3: cómo saber si el que compraste es bueno
8. Testimonio/caso real de un usuario (cuando haya uno disponible)

Herramientas gratuitas: grabar con el teléfono, editar y subtitular en **CapCut** (gratis, subtítulos automáticos — 85% del video en redes se ve sin sonido, los subtítulos no son opcionales).

### D. Contenido específico de app (necesario para el lanzamiento en tiendas, no solo marketing)

- Video corto de producto (15-30 seg) mostrando el flujo real: registrar día → ver score → recomendación — se necesita para el listado de App Store/Play Store y sirve también como el primer anuncio pagado cuando llegue el momento (ver sección 5).

---

## 5. Plan de anuncios / promoción

### Fase actual: 100% orgánico ($0/mes) — esto es correcto para la etapa, no una limitación temporal a lamentar

Con $0 de presupuesto pagado, el orden de prioridad es:

1. **SEO** (ya en marcha: GA4 + Search Console activos, sitemap correcto) — completar los gaps de contenido de la sección 2 y 3 antes que cualquier otra cosa, porque es el canal que sigue trabajando mientras Mario duerme.
2. **Shorts/Reels orgánicos** (sección 4C) — el canal de mayor apalancamiento sin presupuesto en 2026: el contenido nativo bien hecho compite directo con el pagado.
3. **Siembra con micro-influencers** (costo $0, no dinero): identificar 2-3 creadores de fitness/salud en español con audiencia pequeña pero comprometida (5K-50K), ofrecerles acceso premium gratis a cambio de una reseña honesta. Esto es "pago en producto", no en efectivo — perfectamente ejecutable en fase bootstrapped.
4. **Comunidad**: responder con valor real (no autopromoción) en foros/grupos de Facebook e Instagram de biohacking/fitness en español — dado que el research de hoy mostró que casi no hay comunidad nativa en español, ser la voz consistente y útil ahí es barato y compuesto.
5. **Lead magnet → nutrición por email**: ya existe el pipeline (`web_leads`); falta decidir si se queda simple o migra a Jotform+Make (ver decisiones pendientes). Independiente de esa decisión, cada nuevo artículo/video debería alimentar ese loop.

### Punto de activación para presupuesto pagado

No recomiendo activar pago hasta que se cumplan **ambas** condiciones:
- Stripe está en modo live (paga de verdad)
- La app está publicada en al menos una tienda (para no pagar tráfico hacia algo que el usuario no puede completar)

Cuando esas dos condiciones se cumplan, el primer test pagado recomendado (no antes):
- **Plataforma:** Meta (Instagram/Facebook) — mejor ajuste para un producto visual/consumidor con contenido que ya funciona en formato nativo.
- **Presupuesto de prueba:** $10-15/día (~$300-450/mes) durante 2-3 semanas — consistente con la franja "pre-seed/bootstrapped" de gasto de marketing.
- **Creativo:** usar el Reel/Short orgánico de mejor desempeño como el anuncio, tal cual — es la táctica de mayor apalancamiento ("si un video orgánico ya tiene tracción, correrlo pagado tal cual supera a producir un anuncio nuevo desde cero").
- **Targeting:** amplio (solo país/idioma), dejar que el algoritmo encuentre a la audiencia — apilar intereses hoy en día rinde peor que un creativo específico con targeting amplio.
- **Medir:** UTM + GA4 (ya instalado) para blended CAC, no solo el ROAS que reporta la plataforma.

---

## 6. Cronograma sugerido — próximas 12 semanas (desde 18 jul 2026)

| Semana | Foco |
|---|---|
| 1-2 | Acción #1 (revisar Search Console), decidir contenido del "Video Destacado", conseguir/grabar los 2 videos de suplementos faltantes (Omega-3, D3+K2) |
| 3-4 | Publicar los 5 embeds de YouTube en los artículos de blog (reutilizando los 3 Shorts existentes donde aplique), primer artículo del pilar Ejercicio (tema #2) |
| 5-8 | 1 Short/Reel nuevo por semana (lista de la sección 4C), 2-3 artículos más de la tabla de la sección 2, construir "Hacks por Categorías" una vez haya al menos 1 video por pilar |
| 9-12 | Contactar 2-3 micro-influencers para siembra, encuesta de 1 pregunta en redes, revisar qué se aprendió en Search Console/comentarios y ajustar la tabla de temas |

---

## 7. Decisiones que solo Mario puede tomar (no adivinar, preguntar en el momento)

- Lead magnet: ¿quedarse en `web_leads` o migrar a Jotform+Make?
- Social proof: ¿mostrar el número de suscriptores de YouTube? ¿cuál es el número real hoy?
- ¿Aprobar la siembra con micro-influencers (acceso gratis, no dinero) como estrategia?
- URLs de YouTube reales para los 2 videos de suplementos faltantes y para los embeds de blog
- Confirmar el ángulo del "Video Destacado" del home antes de que se construya la sección

---

## Resumen de una línea

Con $0 de presupuesto: cerrar los gaps de video ya identificados (2 suplementos + 5 embeds), llenar el pilar de Ejercicio que está vacío, correr un Short/Reel nativo por semana, y no activar nada pagado hasta que Stripe esté en modo live y la app esté en tiendas — en ese momento, usar el Reel orgánico con mejor desempeño como el primer anuncio.
