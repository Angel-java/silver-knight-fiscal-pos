import { Router, Request, Response } from 'express'
import { prisma } from '../database/prisma'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createExchangeRateSchema } from '../validation/schemas'
import { asyncHandler } from '../middleware/errorHandler'
import { DEFAULT_EXCHANGE_RATE_PAGE_SIZE } from '../config'
import { connectionFailureMessage } from '../utils/connectionError'
import {
  caracasDayStart,
  rateEffectiveDayStart,
  rateValidUntil,
  isRateOld,
  type RateLike
} from '../utils/rateSettings'
import { getActiveExchangeRate } from '../utils/rateResolver'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('exchange-rates'))

const BCV_URL = 'https://www.bcv.org.ve/'
const DOLARAPI_URL = 'https://ve.dolarapi.com/v1/dolares/oficial'

const MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11
}

export function parseBcvRate(html: string): number | null {
  const patterns = [
    /<strong[^>]*>\s*(\d+[.,]\d+)\s*<span[^>]*>Bs\.?\s*<\/span>\s*<\/strong>/i,
    /<span[^>]*class="[^"]*tasa[^"]*"[^>]*>\s*(\d+[.,]\d+)\s*<\/span>/i,
    /<div[^>]*class="[^"]*view-tasa[^"]*"[^>]*>.*?<span[^>]*class="[^"]*field-content[^"]*"[^>]*>\s*(\d+[.,]\d+)\s*<\/span>/is,
    /<span[^>]*class="[^"]*field-content[^"]*"[^>]*>\s*(\d+[.,]\d+)\s*Bs\s*<\/span>/i,
    /(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*Bs/i
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m) {
      const num = parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
      if (!isNaN(num) && num > 0) return num
    }
  }
  return null
}

/** Fecha publicada en el sitio del BCV ("28 de septiembre de 2026"), si se puede parsear. */
export function parseBcvDate(html: string): Date | null {
  const monthRe = Object.keys(MONTHS).join('|')
  const re = new RegExp(`(\\d{1,2})\\s+de\\s+(${monthRe})\\s+de\\s+(\\d{4})`, 'i')

  const span = html.match(/<span[^>]*class="[^"]*date-display-single[^"]*"[^>]*>\s*(.*?)\s*<\/span>/is)
  const text = (span?.[1] ?? html).replace(/<[^>]+>/g, ' ')

  const m = text.match(re)
  if (!m) return null

  const day = Number(m[1])
  const month = MONTHS[m[2].toLowerCase()]
  const year = Number(m[3])
  if (!Number.isFinite(day) || month === undefined || !Number.isFinite(year)) return null
  if (day < 1 || day > 31 || year < 2000 || year > 2100) return null

  // Mediodía UTC y luego normalizamos al inicio del día de Caracas (mismo día).
  const noonUtc = Date.UTC(year, month, day, 12, 0, 0)
  return new Date(caracasDayStart(noonUtc))
}

export async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<globalThis.Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    return res
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Normaliza la fecha efectiva de una tasa (string ISO u otra representación parseable)
 * al inicio del día correspondiente en Caracas. Devuelve null si no es parseable.
 */
export function normalizeEffectiveDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null

  // 'YYYY-MM-DD' (fecha elegida por el operador, sin zona horaria): se interpreta
  // como fecha calendario de Caracas. Se usa el mediodía UTC (mismo día en Caracas)
  // y se normaliza al inicio del día — evitar el caso clásico de `new Date('YYYY-MM-DD')`
  // que parsea medianoche UTC y cae un día antes en Caracas.
  const dateOnly = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) {
    const ts = Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12)
    if (Number.isNaN(ts)) return null
    return new Date(caracasDayStart(ts))
  }

  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return new Date(caracasDayStart(d.getTime()))
}

/** Tasa serializable con su ventana de validez (fin del día de su fecha) en ISO. */
function decorateRate(rate: RateLike): Record<string, unknown> {
  return {
    id: rate.id,
    rate: rate.rate,
    source: rate.source,
    date: new Date(rate.date).toISOString(),
    effectiveDate: rate.effectiveDate ? new Date(rate.effectiveDate).toISOString() : null,
    validFrom: new Date(rateEffectiveDayStart(rate)).toISOString(),
    validUntil: new Date(rateValidUntil(rate)).toISOString()
  }
}

/**
 * Obtiene la tasa oficial (DolarAPI primero, fallback a scrape del sitio del BCV),
 * la persiste con `source` y la fecha efectiva que el origen publica, y devuelve el
 * resultado. Compartida por la ruta manual (source 'bcv') y el scheduler (source
 * 'bcv-auto').
 */
export async function obtainBcvRate(
  source: 'bcv' | 'bcv-auto' = 'bcv'
): Promise<
  | { ok: true; rate: Awaited<ReturnType<typeof prisma.exchangeRate.create>>; source: 'dolarapi' | 'bcv-scrape' }
  | { ok: false; errors: string[] }
> {
  const errors: string[] = []

  try {
    const response = await fetchWithTimeout(DOLARAPI_URL)
    if (response.ok) {
      const data = (await response.json()) as {
        promedio?: number
        promedio_real?: number
        precio?: number
        fechaActualizacion?: string
      }
      const rate = data.promedio || data.promedio_real || data.precio
      if (rate && typeof rate === 'number' && rate > 0) {
        const effectiveDate = normalizeEffectiveDate(data.fechaActualizacion)
        const exchangeRate = await prisma.exchangeRate.create({
          data: {
            rate: parseFloat(rate.toFixed(2)),
            source,
            date: new Date(),
            ...(effectiveDate ? { effectiveDate } : {})
          }
        })
        return { ok: true, rate: exchangeRate, source: 'dolarapi' }
      }
    }
    errors.push(`DolarAPI: status ${response.status}`)
  } catch (e) {
    errors.push(
      'DolarAPI: ' + (connectionFailureMessage(e) ?? (e instanceof Error ? e.message : 'error'))
    )
  }

  try {
    const response = await fetchWithTimeout(BCV_URL, 10000)
    if (response.ok) {
      const html = await response.text()
      const rate = parseBcvRate(html)
      if (rate) {
        const effectiveDate = parseBcvDate(html)
        const exchangeRate = await prisma.exchangeRate.create({
          data: {
            rate,
            source,
            date: new Date(),
            ...(effectiveDate ? { effectiveDate } : {})
          }
        })
        return { ok: true, rate: exchangeRate, source: 'bcv-scrape' }
      }
      errors.push('BCV web: estructura no reconocida')
    } else {
      errors.push(`BCV web: status ${response.status}`)
    }
  } catch (e) {
    errors.push(
      'BCV web: ' + (connectionFailureMessage(e) ?? (e instanceof Error ? e.message : 'error'))
    )
  }

  return { ok: false, errors }
}

router.post('/bcv', asyncHandler(async (_req: Request, res: Response) => {
  const result = await obtainBcvRate('bcv')
  if (result.ok) {
    res.json({ rate: decorateRate(result.rate), source: result.source })
    return
  }

  res.status(502).json({
    error:
      result.errors.some((err) => err.includes('No hay conexión'))
        ? 'No se pudo obtener la tasa del BCV por un problema de conexión a internet. Verifica tu conexión o ingresa la tasa manualmente.'
        : 'No se pudo obtener la tasa del BCV. Intenta ingresarla manualmente.',
    detail: result.errors.join(' | ')
  })
}))

router.get('/active', asyncHandler(async (_req: Request, res: Response) => {
  const resolved = await getActiveExchangeRate()
  res.json({
    rate: resolved.rate ? decorateRate(resolved.rate) : null,
    old: resolved.old
  })
}))

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const latest = req.query.latest === 'true'

  if (latest) {
    const rate = await prisma.exchangeRate.findFirst({ orderBy: { date: 'desc' } })
    res.json({
      rate: rate ? decorateRate(rate as RateLike) : null,
      old: rate ? isRateOld(rate as RateLike, new Date()) : false
    })
    return
  }

  const rates = await prisma.exchangeRate.findMany({
    orderBy: { date: 'desc' },
    take: DEFAULT_EXCHANGE_RATE_PAGE_SIZE
  })
  res.json({ rates: rates.map((r) => decorateRate(r as RateLike)) })
}))

router.post('/', validate(createExchangeRateSchema), asyncHandler(async (req: Request, res: Response) => {
  const { rate, source } = req.body
  const effectiveDate = normalizeEffectiveDate(req.body.effectiveDate)
  const exchangeRate = await prisma.exchangeRate.create({
    data: {
      rate: parseFloat(rate),
      source: source || 'manual',
      date: new Date(),
      ...(effectiveDate ? { effectiveDate } : {})
    }
  })
  res.status(201).json({ rate: decorateRate(exchangeRate as RateLike) })
}))

export default router