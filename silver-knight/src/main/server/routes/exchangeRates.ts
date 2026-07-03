import { Router, Request, Response } from 'express'
import { prisma } from '../../database/prisma'
import { authMiddleware } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

const BCV_URL = 'https://www.bcv.org.ve/'
const DOLARAPI_URL = 'https://ve.dolarapi.com/v1/dolares/oficial'

function parseBcvRate(html: string): number | null {
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

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<globalThis.Response> {
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

router.post('/bcv', async (_req: Request, res: Response) => {
  const errors: string[] = []

  // Try DolarAPI first (JSON, more reliable)
  try {
    const response = await fetchWithTimeout(DOLARAPI_URL)
    if (response.ok) {
      const data = await response.json() as { promedio?: number; promedio_real?: number; precio?: number }
      const rate = data.promedio || data.promedio_real || data.precio
      if (rate && typeof rate === 'number' && rate > 0) {
        const exchangeRate = await prisma.exchangeRate.create({
          data: { rate: parseFloat(rate.toFixed(2)), source: 'bcv', date: new Date() }
        })
        res.json({ rate: exchangeRate, source: 'dolarapi' })
        return
      }
    }
    errors.push(`DolarAPI: status ${response.status}`)
  } catch (e) {
    errors.push('DolarAPI: ' + (e instanceof Error ? e.message : 'error'))
  }

  // Fallback: scrape BCV website
  try {
    const response = await fetchWithTimeout(BCV_URL, 10000)
    if (response.ok) {
      const html = await response.text()
      const rate = parseBcvRate(html)
      if (rate) {
        const exchangeRate = await prisma.exchangeRate.create({
          data: { rate, source: 'bcv', date: new Date() }
        })
        res.json({ rate: exchangeRate, source: 'bcv-scrape' })
        return
      }
      errors.push('BCV web: estructura no reconocida')
    } else {
      errors.push(`BCV web: status ${response.status}`)
    }
  } catch (e) {
    errors.push('BCV web: ' + (e instanceof Error ? e.message : 'error'))
  }

  res.status(502).json({
    error: 'No se pudo obtener la tasa del BCV. Intenta ingresarla manualmente.',
    detail: errors.join(' | ')
  })
})

router.get('/', async (req: Request, res: Response) => {
  try {
    const latest = req.query.latest === 'true'
    if (latest) {
      const rate = await prisma.exchangeRate.findFirst({ orderBy: { date: 'desc' } })
      res.json({ rate })
      return
    }
    const rates = await prisma.exchangeRate.findMany({ orderBy: { date: 'desc' }, take: 50 })
    res.json({ rates })
  } catch (error) {
    console.error('[exchange-rates] error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const { rate, source } = req.body
    if (!rate || rate <= 0) {
      res.status(400).json({ error: 'Tasa inválida' })
      return
    }
    const exchangeRate = await prisma.exchangeRate.create({
      data: { rate: parseFloat(rate), source: source || 'manual', date: new Date() }
    })
    res.status(201).json({ rate: exchangeRate })
  } catch (error) {
    console.error('[exchange-rates] create error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
