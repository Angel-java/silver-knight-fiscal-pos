import { schedule, type ScheduledTask } from 'node-cron'
import { prisma } from '../database/prisma'
import { logger } from './utils/logger'

const DOLARAPI_URL = 'https://ve.dolarapi.com/v1/dolares/oficial'

const jobs: ScheduledTask[] = []

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
      logger.info('scheduler', `BCV auto-fetch: Bs. ${rate.toFixed(2)}`)
    }
  } catch {
    /* auto-fetch failures are silent */
  }
}

function parseTimes(timesStr: string | undefined): string[] {
  if (!timesStr) return []
  try {
    const times: unknown = JSON.parse(timesStr)
    return Array.isArray(times) ? times.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
}

function timeToCron(time: string): string | null {
  const parts = time.split(':')
  if (parts.length !== 2) return null
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return `${m} ${h} * * *`
}

function scheduleJobs(times: string[]): void {
  for (const job of jobs) job.stop()
  jobs.length = 0

  const seen = new Set<string>()
  for (const time of times) {
    const cronExpr = timeToCron(time)
    if (!cronExpr || seen.has(cronExpr)) continue
    seen.add(cronExpr)
    const job = schedule(cronExpr, () => {
      fetchBcvRate()
    })
    job.start()
    jobs.push(job)
    logger.info('scheduler', `Scheduled BCV fetch at ${time} (${cronExpr})`)
  }
}

async function loadAndSchedule(): Promise<void> {
  try {
    const all = await prisma.setting.findMany()
    const map: Record<string, string> = {}
    for (const s of all) map[s.key] = s.value

    if (map['bcvAutoFetch'] !== 'true') {
      logger.info('scheduler', 'BCV auto-fetch is disabled')
      return
    }

    const times = parseTimes(map['bcvFetchTimes'])
    if (times.length === 0) {
      logger.info('scheduler', 'No BCV fetch times configured')
      return
    }

    scheduleJobs(times)
  } catch {
    /* silent */
  }
}

export async function startBcvScheduler(): Promise<void> {
  await loadAndSchedule()
  logger.info('scheduler', 'BCV auto-fetch scheduler started')
}

export function stopBcvScheduler(): void {
  for (const job of jobs) job.stop()
  jobs.length = 0
  logger.info('scheduler', 'BCV auto-fetch scheduler stopped')
}
