import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./database/prisma', () => ({
  prisma: {
    syncConfig: {
      findFirst: vi.fn(),
      updateMany: vi.fn()
    },
    company: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    category: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    customer: { findMany: vi.fn() },
    fiscalControl: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
    exchangeRate: { findMany: vi.fn() },
    setting: { findMany: vi.fn() },
    syncLog: { create: vi.fn() }
  }
}))

vi.mock('./utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}))

import { prisma } from './database/prisma'
import { syncService } from './syncService'

function mockEnabledConfig(): void {
  vi.mocked(prisma.syncConfig.findFirst).mockResolvedValue({
    id: 'cfg-1',
    url: 'http://cloud.test',
    apiKey: 'k',
    enabled: true,
    interval: 60,
    lastSyncAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  } as any)
}

function mockAllEmpty(): void {
  for (const model of [
    'company',
    'user',
    'category',
    'product',
    'customer',
    'fiscalControl',
    'exchangeRate',
    'setting'
  ]) {
    ;(prisma as any)[model].findMany.mockResolvedValue([])
  }
  vi.mocked(prisma.invoice.findMany).mockResolvedValue([])
}

describe('syncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnabledConfig()
  })

  it('does NOT advance lastSyncAt when a sync fails (no lost changes)', async () => {
    mockAllEmpty()
    // One product that will fail to push
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: 'p1', name: 'A', updatedAt: new Date() }
    ] as any)
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))

    const result = await syncService.syncNow()

    expect(result.success).toBe(false)
    expect(result.errors.some((e) => e.includes('Product'))).toBe(true)
    // lastSyncAt must NOT advance so failed records are re-sent
    expect(prisma.syncConfig.updateMany).not.toHaveBeenCalled()
  })

  it('advances lastSyncAt when sync succeeds with no errors', async () => {
    mockAllEmpty()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await syncService.syncNow()

    expect(result.success).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(prisma.syncConfig.updateMany).toHaveBeenCalledWith({
      where: { enabled: true },
      data: { lastSyncAt: expect.any(Date) }
    })
  })

  it('advances lastSyncAt when all entities push successfully', async () => {
    mockAllEmpty()
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: 'p1', name: 'A', updatedAt: new Date() }
    ] as any)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('')
    } as any)

    const result = await syncService.syncNow()

    expect(result.success).toBe(true)
    expect(prisma.syncConfig.updateMany).toHaveBeenCalled()
  })
})
