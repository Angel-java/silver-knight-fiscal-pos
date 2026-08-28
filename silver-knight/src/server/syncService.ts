import { prisma } from './database/prisma'
import { logger } from './utils/logger'
import { connectionFailureMessage } from './utils/connectionError'

interface SyncConfig {
  url: string
  apiKey: string
  enabled: boolean
  interval: number
  lastSyncAt: Date | null
}

interface SyncResult {
  success: boolean
  entitiesSynced: number
  errors: string[]
  duration: number
}

class SyncService {
  private timer: NodeJS.Timeout | null = null
  private _syncing = false
  private _lastResult: SyncResult | null = null
  private retryDelays = [60_000, 5 * 60_000, 15 * 60_000]
  private retryAttempt = 0
  private intervalMs = 60 * 60 * 1000

  get isSyncing(): boolean {
    return this._syncing
  }

  get lastResult(): SyncResult | null {
    return this._lastResult
  }

  async getConfig(): Promise<SyncConfig> {
    const config = await prisma.syncConfig.findFirst()
    if (!config) {
      return { url: '', apiKey: '', enabled: false, interval: 60, lastSyncAt: null }
    }
    return {
      url: config.url,
      apiKey: config.apiKey,
      enabled: config.enabled,
      interval: config.interval,
      lastSyncAt: config.lastSyncAt
    }
  }

  async saveConfig(data: {
    url?: string
    apiKey?: string
    enabled?: boolean
    interval?: number
  }): Promise<SyncConfig> {
    const existing = await prisma.syncConfig.findFirst()
    if (existing) {
      const updated = await prisma.syncConfig.update({
        where: { id: existing.id },
        data: {
          ...(data.url !== undefined && { url: data.url }),
          ...(data.apiKey !== undefined && { apiKey: data.apiKey }),
          ...(data.enabled !== undefined && { enabled: data.enabled }),
          ...(data.interval !== undefined && { interval: data.interval })
        }
      })
      return {
        url: updated.url,
        apiKey: updated.apiKey,
        enabled: updated.enabled,
        interval: updated.interval,
        lastSyncAt: updated.lastSyncAt
      }
    }
    const created = await prisma.syncConfig.create({
      data: {
        url: data.url || '',
        apiKey: data.apiKey || '',
        enabled: data.enabled ?? false,
        interval: data.interval || 60
      }
    })
    return {
      url: created.url,
      apiKey: created.apiKey,
      enabled: created.enabled,
      interval: created.interval,
      lastSyncAt: created.lastSyncAt
    }
  }

  async start(intervalMinutes?: number): Promise<void> {
    const config = await this.getConfig()
    const interval = intervalMinutes || config.interval || 60
    this.intervalMs = interval * 60 * 1000
    this.stop()
    this.scheduleNext(0)
    logger.info('sync', `Auto-sync cada ${interval} minuto(s)`)
    if (config.enabled && config.url) {
      this.syncNow().catch(() => {})
    }
  }

  private scheduleNext(delayMs: number): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      this.syncNow()
        .then((result) => {
          const delay = this.nextDelay(result)
          this.scheduleNext(delay)
        })
        .catch((err) => {
          logger.error('sync', 'auto-sync error', err)
          this.scheduleNext(60_000)
        })
    }, delayMs)
  }

  private nextDelay(result: SyncResult): number {
    if (result.success) {
      this.retryAttempt = 0
      return this.intervalMs
    }
    const attempt = Math.min(this.retryAttempt, this.retryDelays.length - 1)
    this.retryAttempt++
    return this.retryDelays[attempt]
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.retryAttempt = 0
  }

  async syncNow(): Promise<SyncResult> {
    const config = await this.getConfig()
    if (!config.enabled || !config.url) {
      const result: SyncResult = {
        success: false,
        entitiesSynced: 0,
        errors: ['Sync no habilitado o URL no configurada'],
        duration: 0
      }
      this._lastResult = result
      return result
    }

    if (this._syncing) {
      return { success: false, entitiesSynced: 0, errors: ['Sync en progreso'], duration: 0 }
    }

    this._syncing = true
    const start = Date.now()
    const errors: string[] = []
    let entitiesSynced = 0

    try {
      const since = config.lastSyncAt || new Date(0)
      const now = new Date()

      const entities: Array<{ name: string; data: unknown }> = []

      const company = await prisma.company.findMany({
        where: { updatedAt: { gt: since } }
      })
      if (company.length) entities.push({ name: 'Company', data: company })

      const users = await prisma.user.findMany({
        where: { updatedAt: { gt: since } },
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      })
      if (users.length) entities.push({ name: 'User', data: users })

      const categories = await prisma.category.findMany({
        where: { updatedAt: { gt: since } }
      })
      if (categories.length) entities.push({ name: 'Category', data: categories })

      const products = await prisma.product.findMany({
        where: { updatedAt: { gt: since } }
      })
      if (products.length) entities.push({ name: 'Product', data: products })

      const customers = await prisma.customer.findMany({
        where: { updatedAt: { gt: since } }
      })
      if (customers.length) entities.push({ name: 'Customer', data: customers })

      const fiscalControls = await prisma.fiscalControl.findMany({
        where: { updatedAt: { gt: since } }
      })
      if (fiscalControls.length) entities.push({ name: 'FiscalControl', data: fiscalControls })

      const invoices = await prisma.invoice.findMany({
        where: { updatedAt: { gt: since } },
        include: { items: true, customer: true, fiscalControl: true }
      })
      if (invoices.length) entities.push({ name: 'Invoice', data: invoices })

      const exchangeRates = await prisma.exchangeRate.findMany({
        where: { updatedAt: { gt: since } }
      })
      if (exchangeRates.length) entities.push({ name: 'ExchangeRate', data: exchangeRates })

      const settings = await prisma.setting.findMany({
        where: { updatedAt: { gt: since } }
      })
      if (settings.length) entities.push({ name: 'Setting', data: settings })

      for (const entity of entities) {
        try {
          const cloudRes = await fetch(`${config.url}/api/sync/push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': config.apiKey
            },
            body: JSON.stringify({
              entity: entity.name,
              records: entity.data,
              timestamp: now.toISOString()
            }),
            signal: AbortSignal.timeout(30000)
          })
          if (!cloudRes.ok) {
            const errText = await cloudRes.text().catch(() => '')
            errors.push(`${entity.name}: HTTP ${cloudRes.status} ${errText}`)
          } else {
            entitiesSynced += Array.isArray(entity.data) ? entity.data.length : 1
            await prisma.syncLog.create({
              data: {
                entity: entity.name,
                action: 'sync',
                entityId: `${entity.name}:${Array.isArray(entity.data) ? entity.data.length : 1} registros`,
                status: 'synced'
              }
            })
          }
        } catch (err) {
          const friendly =
            connectionFailureMessage(err) ?? (err instanceof Error ? err.message : String(err))
          errors.push(`${entity.name}: ${friendly}`)
          await prisma.syncLog.create({
            data: {
              entity: entity.name,
              action: 'sync',
              entityId: `${entity.name}:falló`,
              status: 'failed',
              error: err instanceof Error ? err.message : String(err)
            }
          })
        }
      }

      if (errors.length === 0) {
        await prisma.syncConfig.updateMany({
          where: { enabled: true },
          data: { lastSyncAt: now }
        })
      } else {
        logger.warn(
          'sync',
          `Sync finalizó con ${errors.length} error(es); lastSyncAt NO se avanzó para no perder cambios`
        )
      }
    } catch (err) {
      errors.push(`General: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      this._syncing = false
    }

    const duration = Date.now() - start
    this._lastResult = { success: errors.length === 0, entitiesSynced, errors, duration }
    return this._lastResult
  }

  async getLogs(limit = 50): Promise<
    Array<{
      id: string
      entity: string
      action: string
      status: string
      error: string | null
      createdAt: Date
    }>
  > {
    return prisma.syncLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    })
  }
}

export const syncService = new SyncService()
