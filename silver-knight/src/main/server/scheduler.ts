import { prisma } from '../database/prisma'

let intervalId: ReturnType<typeof setInterval> | null = null
const lastFetchedSlots = new Set<string>()

const DOLARAPI_URL = 'https://ve.dolarapi.com/v1/dolares/oficial'

async function fetchBcvRate(): Promise<void> {
  try {
    const res = await fetch(DOLARAPI_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    })
    if (!res.ok) return
    const data = (await res.json()) as {
      promedio?: number
      promedio_real?: number
      precio?: number
    }
    const rate = data.promedio || data.promedio_real || data.precio
    if (rate && typeof rate === 'number' && rate > 0) {
      await prisma.exchangeRate.create({
        data: { rate: parseFloat(rate.toFixed(2)), source: 'bcv-auto', date: new Date() }
      })
      console.log(`[scheduler] BCV auto-fetch: Bs. ${rate.toFixed(2)}`)
    }
  } catch {
    // auto-fetch failures are silent
  }
}

async function checkAndFetch(): Promise<void> {
  try {
    const all = await prisma.setting.findMany()
    const map: Record<string, string> = {}
    for (const s of all) map[s.key] = s.value

    if (map['bcvAutoFetch'] !== 'true') return

    const timesStr = map['bcvFetchTimes']
    if (!timesStr) return

    const times: string[] = JSON.parse(timesStr)
    if (!Array.isArray(times) || times.length === 0) return

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    for (const time of times) {
      if (currentTime === time) {
        const slotKey = `${today}-${time}`
        if (!lastFetchedSlots.has(slotKey)) {
          lastFetchedSlots.add(slotKey)
          await fetchBcvRate()
        }
      }
    }

    // keep set from growing indefinitely
    if (lastFetchedSlots.size > 100) {
      const arr = Array.from(lastFetchedSlots)
      lastFetchedSlots.clear()
      for (const k of arr.slice(-50)) lastFetchedSlots.add(k)
    }
  } catch {
    // silent
  }
}

export function startBcvScheduler(): void {
  // fetch immediately on startup (if enabled)
  checkAndFetch()
  // then poll every 60 seconds
  intervalId = setInterval(checkAndFetch, 60000)
  console.log('[scheduler] BCV auto-fetch started (poll every 60s)')
}

export function stopBcvScheduler(): void {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
    console.log('[scheduler] BCV auto-fetch stopped')
  }
}
