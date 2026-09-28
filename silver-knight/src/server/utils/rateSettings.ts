/**
 * Motor de vigencia de la tasa de cambio (USD/VES).
 *
 * Regla simple anclada a la FECHA de la tasa (2026-09-28 en adelante):
 *  - Cada captura lleva la fecha a la que corresponde (`effectiveDate`), tomada del
 *    BCV/DolarAPI o elegida por el operador en capturas manuales. Si no hay fecha
 *    (capturas antiguas), se usa el día de su captura (`date`).
 *  - La tasa ACTIVA es la captura más reciente (por `date`).
 *  - Es VIGENTE hasta que se acabe el día de su fecha (medianoche de Caracas). Si se
 *    publicó con anticipación (ej.: el viernes con fecha del lunes), sigue vigente
 *    hasta que se acabe el lunes.
 *  - Cuando ese día termina, la tasa queda VIEJA (`old`): el POS pide actualizarla
 *    dentro del cobro (Consultar BCV / Ingresar manual) pero permite cobrar igual si
 *    el operador confirma. `old` es informativo: NUNCA bloquea; el único bloqueo duro
 *    es no tener ninguna tasa (RATE_MISSING, manejado por las rutas).
 *
 * Zona horaria: Caracas (UTC-4 fijo, sin DST desde 2007). Los límites de día se
 * calculan aquí para no depender del TZ del contenedor del servidor (UTC por defecto
 * en Alpine).
 */

const VET_OFFSET_MS = 4 * 60 * 60 * 1000 // UTC-4
const DAY_MS = 24 * 60 * 60 * 1000

export interface RateLike {
  id: string
  rate: number
  source: string
  date: Date | string
  effectiveDate?: Date | string | null
  [key: string]: unknown
}

export interface ActiveRateResult {
  /** tasa activa (la captura más reciente), o null si no hay ninguna */
  rate: RateLike | null
  /** true cuando la tasa activa ya pasó el fin del día de su fecha (tasa vieja) */
  old: boolean
}

/**
 * Inicio (ms absoluto) del día calendario de Caracas que contiene `ts`.
 * Caracas = UTC-4: el día de Caracas de un instante es el día UTC de (ts - 4h),
 * y el inicio del día es su medianoche UTC + 4h.
 */
export function caracasDayStart(ts: number): number {
  return Math.floor((ts - VET_OFFSET_MS) / DAY_MS) * DAY_MS + VET_OFFSET_MS
}

/** Fin (ms absoluto, último ms) del día calendario de Caracas que contiene `ts`. */
export function caracasDayEnd(ts: number): number {
  return caracasDayStart(ts) + DAY_MS - 1
}

/** Inicio del día de Caracas al que corresponde una tasa (su `effectiveDate` o su captura). */
export function rateEffectiveDayStart(rate: RateLike): number {
  const src = rate.effectiveDate ?? rate.date
  const ts = new Date(src).getTime()
  if (Number.isNaN(ts)) {
    return caracasDayStart(new Date(rate.date).getTime())
  }
  return caracasDayStart(ts)
}

/** Fin del día (Caracas, último ms) al que corresponde la tasa. */
export function rateValidUntil(rate: RateLike): number {
  return rateEffectiveDayStart(rate) + DAY_MS - 1
}

/** `true` si `now` ya pasó el fin del día de la tasa (la tasa está vieja). */
export function isRateOld(rate: RateLike, now: number | Date): boolean {
  return new Date(now).getTime() >= rateEffectiveDayStart(rate) + DAY_MS
}

/**
 * Resuelve la tasa activa: la captura más reciente con `date <= now` (una captura
 * futura nunca es activa). Devuelve su estado `old`.
 */
export function resolveActiveRate(
  rawRates: RateLike[],
  now: number | Date = new Date()
): ActiveRateResult {
  const nowTs = new Date(now).getTime()
  const rates = (rawRates ?? [])
    .map((r) => ({ r, ts: new Date(r.date).getTime() }))
    .filter((x) => !Number.isNaN(x.ts) && x.ts <= nowTs)
    .sort((a, b) => b.ts - a.ts)

  if (rates.length === 0) return { rate: null, old: false }

  const active = rates[0].r
  return { rate: active, old: isRateOld(active, nowTs) }
}