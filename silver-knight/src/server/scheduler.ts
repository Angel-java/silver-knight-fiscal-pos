import { schedule, type ScheduledTask } from 'node-cron'
import { prisma } from './database/prisma'
import { logger } from './utils/logger'
import { obtainBcvRate } from './routes/exchangeRates'

const bcvJobs: ScheduledTask[] = []
let reservationJob: ScheduledTask | null = null

async function recordBcvStatus(status: string, error?: string): Promise<void> {
  try {
    await prisma.setting.upsert({
      where: { key: 'bcvLastFetchStatus' },
      update: { value: status },
      create: { key: 'bcvLastFetchStatus', value: status }
    })
    await prisma.setting.upsert({
      where: { key: 'bcvLastFetchAt' },
      update: { value: new Date().toISOString() },
      create: { key: 'bcvLastFetchAt', value: new Date().toISOString() }
    })
    if (error !== undefined) {
      await prisma.setting.upsert({
        where: { key: 'bcvLastFetchError' },
        update: { value: error },
        create: { key: 'bcvLastFetchError', value: error }
      })
    }
  } catch {
    /* status recording must not break the scheduler */
  }
}

async function fetchBcvRate(): Promise<void> {
  try {
    // Aprovecha el mismo pipeline de la ruta manual (DolarAPI + fallback a scrape del
    // sitio del BCV) para que el auto-fetch no dependa de un solo origen.
    const result = await obtainBcvRate('bcv-auto')
    if (result.ok) {
      await recordBcvStatus('ok')
      logger.info('scheduler', `BCV auto-fetch: Bs. ${result.rate.rate.toFixed(2)} (${result.source})`)
    } else {
      await recordBcvStatus('error', result.errors.join(' | '))
      logger.warn('scheduler', `BCV auto-fetch failed: ${result.errors.join(' | ')}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sin conexión'
    await recordBcvStatus('error', message)
    logger.warn('scheduler', `BCV auto-fetch failed: ${message}`)
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
  for (const job of bcvJobs) job.stop()
  bcvJobs.length = 0

  const seen = new Set<string>()
  for (const time of times) {
    const cronExpr = timeToCron(time)
    if (!cronExpr || seen.has(cronExpr)) continue
    seen.add(cronExpr)
    const job = schedule(cronExpr, () => {
      fetchBcvRate()
    })
    job.start()
    bcvJobs.push(job)
    logger.info('scheduler', `Scheduled BCV fetch at ${time} (${cronExpr})`)
  }
}

async function loadAndSchedule(): Promise<void> {
  try {
    const all = await prisma.setting.findMany()
    const map: Record<string, string> = {}
    for (const s of all) map[s.key] = s.value

    if (map['bcvAutoFetch'] !== 'true') {
      // Desactivado: detén cualquier job previo (recarga en caliente).
      for (const job of bcvJobs) job.stop()
      bcvJobs.length = 0
      logger.info('scheduler', 'BCV auto-fetch is disabled')
      return
    }

    const times = parseTimes(map['bcvFetchTimes'])
    // Fetch on start: la UI promete "al iniciar la aplicación", así que aunque no
    // haya horarios configurados, se intenta una vez al arrancar.
    void fetchBcvRate()

    if (times.length === 0) {
      logger.info('scheduler', 'No BCV fetch times configured (fetch-on-start only)')
      return
    }

    scheduleJobs(times)
  } catch {
    /* silent */
  }
}

export async function startBcvScheduler(): Promise<void> {
  await loadAndSchedule()
  scheduleExpiredReservations()
  logger.info('scheduler', 'BCV auto-fetch scheduler started')
}

/**
 * Re-aplica la configuración del scheduler sin reiniciar el servidor. Se invoca al
 * guardar `bcvAutoFetch`/`bcvFetchTimes` en Ajustes (M1: zero-restart).
 */
export async function reloadBcvSchedule(): Promise<void> {
  await loadAndSchedule()
}

export function stopBcvScheduler(): void {
  for (const job of bcvJobs) job.stop()
  bcvJobs.length = 0
  if (reservationJob) {
    reservationJob.stop()
    reservationJob = null
  }
  logger.info('scheduler', 'BCV auto-fetch scheduler stopped')
}

async function expireDueReservations(): Promise<void> {
  try {
    const overdue = await prisma.reservation.findMany({
      where: { status: 'active', dueDate: { lt: new Date() } },
      include: { items: true }
    })
    for (const reservation of overdue) {
      await prisma.$transaction(async (tx) => {
        for (const item of reservation.items) {
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } }
            })
            await tx.inventoryMovement.create({
              data: {
                productId: item.productId,
                type: 'unreserved',
                quantity: item.quantity,
                reference: reservation.number,
                notes: 'Apartado vencido',
                userId: null
              }
            })
          }
        }
        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            status: 'expired',
            cancelledAt: new Date(),
            cancelReason: 'Vencimiento automático de apartado'
          }
        })
      })
      logger.info('scheduler', `Apartado ${reservation.number} expirado por vencimiento`)
    }
  } catch (err) {
    logger.warn('scheduler', `Reservation expiry sweep failed: ${String(err)}`)
  }
}

function scheduleExpiredReservations(): void {
  if (reservationJob) reservationJob.stop()
  reservationJob = schedule('0 0 * * *', () => {
    expireDueReservations()
  })
  reservationJob.start()
  logger.info('scheduler', 'Scheduled reservation expiry sweep (daily 00:00)')
}
