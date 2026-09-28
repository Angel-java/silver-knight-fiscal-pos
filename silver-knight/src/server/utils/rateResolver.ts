import { prisma } from '../database/prisma'
import { resolveActiveRate, type ActiveRateResult, type RateLike } from './rateSettings'

// Capturas consideradas para resolver la tasa activa. Con 20 alcanza de sobra: solo
// importa la más reciente (la activa por marca de tiempo).
const ACTIVE_RATE_LOOKBACK = 20

/**
 * Resuelve la tasa activa leyendo BD. Única fuente de verdad para facturación,
 * apartados y el endpoint público /exchange-rates/active.
 *
 * Regla (2026-09-28): activa = captura más reciente; `old` = ya pasó el fin del día
 * de la fecha de la tasa. `old` es informativo y nunca bloquea; las rutas solo
 * bloquean con RATE_MISSING (cero tasas).
 */
export async function getActiveExchangeRate(now: Date = new Date()): Promise<ActiveRateResult> {
  const rates = await prisma.exchangeRate.findMany({
    orderBy: { date: 'desc' },
    take: ACTIVE_RATE_LOOKBACK
  })

  return resolveActiveRate(rates as RateLike[], now)
}