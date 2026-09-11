# Paquete de ofertas — primer cobro del ecosistema
**2026-08-19.** Acción 3 del kernel vigente. **Borradores para aprobación de Mario — no se envía nada sin su OK.**

---

## Lo que dicen los datos (verificado en Supabase hoy)

| Hecho | Valor |
|---|---|
| Perfiles totales | 23 |
| **Usuarios con uso real** | **1** (17 entradas — el 63% de las 27 entradas de toda la historia) |
| Usuarios con 1-2 entradas | 9 |
| **Usuarios con 0 entradas** | **13** |
| Coaches registrados | 1 |
| **Vínculos coach↔cliente** | **0** |
| Entradas en los últimos 30 días | 12 |
| Cobros reales en la historia | **0** |

### Dos correcciones que estos datos imponen

**1. No se puede vender el plan Coach ($20/mes).** Hay 1 coach y **cero** clientes vinculados: la
función que ese plan cobra **nunca ha sido ejercida por nadie**. Vender un asiento de coach hoy es
vender una promesa sin uso detrás. La oferta real es el **plan personal ($7.99 Básico)**, que es lo
único que alguien usó de verdad.

**2. Los 13 con 0 entradas no son prospectos, son ruido.** Nunca abrieron la app. Escribirles no
mide demanda — mide nada, y contamina la lectura con silencios que no significan "no".

### Jerarquía real de los asks

- **Ask A (1 persona)** — vale más que los otros nueve juntos.
- **Ask B (2 personas)** — los otros `comp_trainer`, 1 entrada cada uno hace más de un mes.
- **Ask C (7 personas)** — trials que abrieron al menos una vez. **Todos vencidos**, así que ya
  perdieron el acceso premium (`is_premium` expira correctamente por `trial_ends_at`): hay motivo
  real y honesto para escribirles.

Total: **10 asks**. Los emails salen de Supabase (`profiles.email`); no los reproduzco aquí.

---

## ASK A — el único con evidencia de valor
*Destinatario: `comp_trainer`, 17 entradas, última el 2026-08-09. Tiene premium gratis permanente.*

> Hola [nombre], te escribo directo y sin vuelta.
>
> Te di acceso gratis a Biohacker Score y eres, con diferencia, quien más lo ha usado: 17 registros
> desde finales de junio. Nadie más se le acerca.
>
> Estoy por empezar a cobrarlo y quiero preguntártelo a ti primero, porque tu respuesta es la que
> más me sirve: **¿vale $7.99 al mes para ti?**
>
> Si la respuesta es sí, te paso cómo pagarlo. Si es no, también quiero saberlo — y me ayuda más
> todavía si me dices qué le falta para que lo valga. Tu acceso no se te quita en ninguno de los
> dos casos; esto no es un ultimátum, es una pregunta de verdad.
>
> Una cosa por transparencia: por ahora corre en el navegador, todavía no está en Play Store ni App
> Store.

**Por qué así:** no se le pide pagar por lo que ya tiene gratis sin decirlo — se le pide una
*valoración*, que es el dato que falta. Y se quita la presión explícitamente para que el "no" sea
barato de decir; un "no" sincero aquí vale más que un "sí" por compromiso.

---

## ASK B — los otros dos accesos de cortesía
*Destinatario: `comp_trainer` con 1 entrada (altas 2026-07-08 y 2026-07-19).*

> Hola [nombre], te di acceso a Biohacker Score hace unas semanas y veo que lo abriste una vez y no
> volviste. No te escribo a reclamarte nada — al revés, eso es información que necesito.
>
> ¿Qué pasó? ¿No era para ti, no era el momento, o algo no funcionó?
>
> Y la otra pregunta, directa: voy a empezar a cobrarlo en **$7.99 al mes**. ¿Es algo que pagarías?
> Un "no" me sirve igual que un "sí".

---

## ASK C — trials vencidos que sí llegaron a usarla
*Destinatario: los 7 `trial` con ≥1 entrada. Todos vencidos entre el 2026-07-19 y el 2026-08-16.*

> Hola [nombre], tu prueba de Biohacker Score se venció hace [X] y con ella el acceso a lo premium.
>
> Antes de darlo por cerrado quiero preguntarte una sola cosa: **¿lo pagarías a $7.99 al mes?**
>
> Si sí, te lo reactivo hoy mismo y te paso cómo. Si no, dime por qué en una línea — si es el
> precio, si le falta algo o si simplemente no era para ti. Esa respuesta me sirve más que el pago.
>
> (Por ahora funciona en el navegador; todavía no está en las tiendas de apps.)

---

## Hoja de conteo — la métrica de gobierno

Lo que se mide **no es el cierre**, es la tasa de ask. Anotar aquí según lleguen respuestas:

| | Enviados | Respondieron | Dijeron SÍ | Dijeron NO | Motivo del NO |
|---|---|---|---|---|---|
| Ask A (1) | | | | | |
| Ask B (2) | | | | | |
| Ask C (7) | | | | | |
| **Total** | **/10** | | | | |

**Cómo leerlo (fijado ANTES de enviar, para no racionalizar después):**
- **≥1 sí de A o B** → hay disposición a pagar en gente que usó el producto. Se cablea Stripe y se
  cobra. El kernel se confirma.
- **0 síes pero ≥5 respuestas con motivo** → el motivo ES el hallazgo. La restricción es el
  producto o el precio, no la caja registradora, y el kernel se reescribe alrededor de eso.
- **≤2 respuestas de 10** → la base instalada está muerta. La restricción es demanda, no
  monetización: no hay a quién venderle todavía y el trabajo vuelve a adquisición.

---

## Cobro sin Stripe

No hace falta el riel para estos 10. Si alguien dice que sí: transferencia, PayPal o efectivo, y
Mario le pone `premium_source = 'paid'` a mano en Supabase (2 minutos). El webhook, los 4 Payment
Links y `COACH_PRICE_ID` **no se tocan hasta que haya al menos un pago real** — ese es el orden que
evita 2-4 h de cableado para cero cobros.
