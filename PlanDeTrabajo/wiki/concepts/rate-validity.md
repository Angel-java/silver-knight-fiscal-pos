---
type: concept
tags: [exchange-rate, bcv, rate-validity, scheduler, pos, architecture]
created: 2026-09-28
updated: 2026-09-28
sources: [db-schema, dolarapi]
---

# Rate Validity (vigencia anclada a la fecha de la tasa)

Modelo de vigencia de la tasa de cambio USD/VES en Silver Knight, vigente desde 2026-09-28.
Tercera iteración del modelo: reemplaza el esquema anterior de "estrategias configurables"
(`rateValidityMode`, 3 modos con takeover por timestamps) por una **regla simple anclada a la
fecha que publica la tasa** (el día al que corresponde). Ver también [[dual-currency]] y
[[exchange-rate]].

## Principio (una sola regla)

- **La fecha de la tasa viene de la fuente**: el campo `fechaActualizacion` de DolarAPI (ISO con
  offset -04:00) o la fecha publicada en el sitio del BCV; al ingresar manual la elige el
  operador. Se guarda en `ExchangeRate.effectiveDate` normalizada al **inicio del día de
  Caracas**.
- **Vigente hasta que se acabe su día**: la tasa es vigente hasta la medianoche de Caracas del
  día de su fecha. Si se publicó **con anticipación** (ej.: el viernes con fecha del lunes —
  "la tasa del lunes se publica los viernes"), sigue vigente hasta que se acabe el **lunes**.
- **Tasa vieja (`old`)**: cuando ese día termina, la tasa queda vieja. Es un estado
  **informativo que nunca bloquea**: el POS pide actualizarla dentro del cobro (Consultar BCV /
  Ingresar manual) pero permite **cobrar igual con confirmación** del operador. El único
  bloqueo duro sigue siendo `RATE_MISSING` (cero tasas).
- **Sin anclaje a días de la semana**: funciona igual sin importar qué días cambie la tasa.
  Los fines de semana no cambian la tasa por sí solos: una captura del viernes con fecha del
  lunes cubre vie/sáb/dom/lun sin configuración.
- **Zona horaria de Caracas (UTC-4 fijo, sin DST desde 2007)**: los límites de día se calculan
  en Caracas explícitamente (`caracasDayStart` / `caracasDayEnd`), sin depender del TZ del
  contenedor del servidor (UTC por defecto en Alpine).

## Resolución (compartido, simplificado)

- **Activa = captura más reciente** (por `date`, la marca de tiempo de captura; una captura
  futura nunca es activa). En capturas duplicadas el mismo día manda la de timestamp más nuevo.
- **`old` = `now >= fin del día de effectiveDate`** (si no hay `effectiveDate`, se usa el día de
  captura — tasas antiguas).
- **`src/server/utils/rateSettings.ts`**: motor puro (sin BD): `caracasDayStart/End`,
  `rateEffectiveDayStart`, `rateValidUntil`, `isRateOld` y `resolveActiveRate(rates, now)` →
  `{ rate, old }`. Se eliminaron `computeValidityWindows`, `parseValidityMode`,
  `parseStaleWarningDays` y `caracasDayGap`.
- **`src/server/utils/rateResolver.ts`**: `getActiveExchangeRate()` lee las 20 capturas más
  recientes (ya no lee settings) y delega en el motor. Única fuente de verdad para:
  - `POST /invoices` (si el body no trae `exchangeRate` útil);
  - `POST /reservations` (mismo motor que facturación);
  - `GET /exchange-rates/active` (endpoint público para el renderer).
- Los body con `exchangeRate` explícito (el valor confirmado por el operador en el panel)
  siguen siendo autoritativos y no se re-resuelven.

## Fuente de la fecha (`effectiveDate`)

| Origen | Fecha tomada | Normalización |
|--------|--------------|---------------|
| DolarAPI (principal) | `fechaActualizacion` (ej. `2026-09-28T00:00:00-04:00`) | `caracasDayStart(parsed)` |
| Scrape sitio BCV (fallback) | fecha publicada ("28 de septiembre de 2026", best-effort `parseBcvDate`) | ídem; si no se parsea → captura del día |
| Manual (POS / Ajustes) | fecha elegida por el operador (`YYYY-MM-DD`, interpreteada como día de Caracas) | ídem, con guard para no caer un día antes (ver `normalizeEffectiveDate`) |
| Capturas antiguas (sin `effectiveDate`) | el día de `date` (captura) | — |

Nota: `new Date('YYYY-MM-DD')` parsea medianoche **UTC**; en Caracas caería un día antes. Por
eso `normalizeEffectiveDate` interpreta las fechas calendas manuales con mediodía UTC y luego
normaliza a Caracas.

## UX en el cobro (sin salir del cobro)

- El `PaymentModal` consulta `/exchange-rates/active` al abrir y muestra el panel de tasa:
  tasa activa + fecha de captura + "válida hasta {fin del día de su fecha}".
- Tasa **vieja** (amarillo): aviso "ya venció su día" + checkbox **"Cobrar con esta tasa de
  todos modos"** (Cobrar habilitado solo con confirmación cuando hay tasa vieja) + botones:
  - **Consultar BCV**: `POST /exchange-rates/bcv` (DolarAPI → fallback scrape BCV).
  - **Ingresar manual**: `POST /exchange-rates` con fecha opcional (funciona offline).
- Si **no hay tasa** (rojo): bloquea el botón Cobrar y pide registrar una ahí mismo.
- `GET /exchange-rates/active` → `{ rate, old }`.

## Scheduler (auto-fetch BCV)

- **Fetch al iniciar**: si `bcvAutoFetch` está activo, intenta una captura al arrancar aunque
  no haya horarios configurados.
- **Recarga en caliente**: guardar `bcvAutoFetch`/`bcvFetchTimes` re-aplica el scheduler sin
  reiniciar (`reloadBcvSchedule` + hook en `PUT /settings/:key`). Desactivar el auto-fetch
  detiene los jobs previos.
- **Fallback de orígenes**: el pipeline compartido `obtainBcvRate(source)` prueba DolarAPI y,
  si falla, hace scrape del sitio del BCV (`parseBcvRate` + `parseBcvDate`). El scheduler
  persiste con `source: 'bcv-auto'`; la ruta manual con `source: 'bcv'`.
- El sweep de apartados vencidos se separó en su propio job para que la recarga en caliente no
  lo mate.

## Settings relacionadas

- `rateValidityMode` → **eliminada** (la estrategia ya no existe; la regla única no se
  configura). El valor residual en BD se ignora.
- `rateStaleWarningDays` → **eliminada** (el estado `old` es binario y lo define la fecha de la
  tasa; no hay umbral).
- `bcvRateVigencyDays` → **eliminada** (obsoleta desde la 1ra iteración).
- `bcvAutoFetch` / `bcvFetchTimes` / `bcvLastFetchStatus` / `bcvLastFetchAt` /
  `bcvLastFetchError` → sin cambios de semántica.

## Fuentes de tasa histórica

- Manual desde el POS/Ajustes: `source: 'manual'`.
- Botón "Obtener del BCV" en Ajustes: `source: 'bcv'` (dolarapi) o `'bcv-scrape'`.
- Auto-fetch del scheduler: `source: 'bcv-auto'`.

## Hitos relacionados

- [[dual-currency]], [[exchange-rate]],
  [[log#2026-09-28-build--vigencia-de-tasa-anclada-a-la-fecha-del-bcv-panel-inline-y-confirmacion-para-cobrar-con-tasa-vieja|log 2026-09-28]]
  (entrada de log de esta implementación).
- [[log#2026-09-28-release--v130-publicada--vigencia-de-tasa-anclada-a-la-fecha-del-bcv--fallback-de-compatibilidad|log 2026-09-28 — release v1.3.0]]
  (publicación de esta implementación; incluye fallback de compat `/active` → `?latest=true` ante 404).