import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

const roleState = vi.hoisted(() => ({ role: 'root' }))

vi.mock('../../database/prisma', () => ({
  prisma: {
    category: { findMany: vi.fn() },
    supplier: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    customer: { findMany: vi.fn() },
    fiscalControl: { findMany: vi.fn() },
    user: { findMany: vi.fn(), findFirst: vi.fn() },
    company: { findMany: vi.fn(), findFirst: vi.fn() },
    invoice: { findMany: vi.fn() },
    setting: { findMany: vi.fn() },
    migrationLog: { create: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn()
  }
}))

vi.mock('../../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { userId: 'u1', username: 'test', role: roleState.role }
    next()
  },
  rootMiddleware: (req: any, res: any, next: any) => {
    if (req.user?.role !== 'root') {
      res.status(403).json({ error: 'Solo root' })
      return
    }
    next()
  },
  rootOrAdminMiddleware: (req: any, res: any, next: any) => {
    if (req.user?.role !== 'root' && req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Solo root o admin' })
      return
    }
    next()
  },
  requirePermission: () => (_req: any, _res: any, next: any) => {
    next()
  }
}))

import { prisma } from '../../database/prisma'
import migrationRouter from '../migration'
import { errorHandler } from '../../middleware/errorHandler'

function createApp() {
  const app = express()
  app.use('/api/migration', migrationRouter)
  app.use(errorHandler)
  return app
}

function mockEmptyDb(): void {
  vi.mocked(prisma.category.findMany).mockResolvedValue([] as any)
  vi.mocked(prisma.supplier.findMany).mockResolvedValue([] as any)
  vi.mocked(prisma.product.findMany).mockResolvedValue([] as any)
  vi.mocked(prisma.customer.findMany).mockResolvedValue([] as any)
  vi.mocked(prisma.fiscalControl.findMany).mockResolvedValue([] as any)
  vi.mocked(prisma.user.findMany).mockResolvedValue([] as any)
  vi.mocked(prisma.company.findMany).mockResolvedValue([] as any)
  vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as any)
  vi.mocked(prisma.setting.findMany).mockResolvedValue([] as any)
  vi.mocked(prisma.user.findFirst).mockResolvedValue(null as any)
  vi.mocked(prisma.company.findFirst).mockResolvedValue(null as any)
  vi.mocked(prisma.migrationLog.findMany).mockResolvedValue([] as any)
  vi.mocked(prisma.migrationLog.create).mockResolvedValue({ id: 'log-1' } as any)
}

function mockTransaction(tx: Record<string, any>): void {
  vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx))
}

function makeTx(): Record<string, any> {
  const counters: Record<string, number> = {}
  const entity = (name: string) => ({
    create: vi.fn(async (args: any) => {
      counters[name] = (counters[name] ?? 0) + 1
      return { id: `${name}-${counters[name]}`, ...(args.data ?? {}) }
    }),
    update: vi.fn(async (args: any) => ({ id: args.where?.id ?? 'x', ...(args.data ?? {}) })),
    findUnique: vi.fn(async () => null)
  })
  return {
    company: entity('company'),
    user: entity('user'),
    category: entity('category'),
    supplier: entity('supplier'),
    product: entity('product'),
    customer: entity('customer'),
    fiscalControl: entity('fiscalControl'),
    invoice: entity('invoice'),
    inventoryMovement: entity('inventoryMovement'),
    exchangeRate: entity('exchangeRate'),
    setting: entity('setting')
  }
}

beforeEach(() => {
  roleState.role = 'root'
  vi.clearAllMocks()
})

describe('GET /api/migration/scopes', () => {
  it('returns format, scopes, entities and strategies', async () => {
    const res = await request(createApp()).get('/api/migration/scopes')

    expect(res.status).toBe(200)
    expect(res.body.backupFormat).toBe('silverknight-backup')
    expect(res.body.scopes.map((s: { value: string }) => s.value)).toContain('all')
    expect(res.body.csvEntities).toContain('products')
    expect(res.body.strategies.map((s: { value: string }) => s.value)).toEqual([
      'skip',
      'overwrite'
    ])
  })
})

describe('GET /api/migration/export', () => {
  it('exports csv as download', async () => {
    vi.mocked(prisma.category.findMany).mockResolvedValue([
      { name: 'Bebidas', description: null }
    ] as any)

    const res = await request(createApp()).get(
      '/api/migration/export?format=csv&entity=categories'
    )

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain('categories.csv')
    expect(res.text).toContain('name,description')
  })

  it('exports json backup', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([{ name: 'ACME', rif: 'J-1' }] as any)
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.setting.findMany).mockResolvedValue([] as any)

    const res = await request(createApp()).get('/api/migration/export?format=json&scope=config')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')
    const parsed = JSON.parse(res.text)
    expect(parsed.format).toBe('silverknight-backup')
  })

  it('rejects invalid entity', async () => {
    const res = await request(createApp()).get('/api/migration/export?format=csv&entity=nope')
    expect(res.status).toBe(400)
  })

  it('rejects invalid scope', async () => {
    const res = await request(createApp()).get('/api/migration/export?format=json&scope=nope')
    expect(res.status).toBe(400)
  })

  it('rejects non-root/non-admin roles', async () => {
    roleState.role = 'operador'
    const res = await request(createApp()).get('/api/migration/export?format=csv&entity=categories')
    expect(res.status).toBe(403)
  })

  it('allows admin role', async () => {
    roleState.role = 'admin'
    vi.mocked(prisma.category.findMany).mockResolvedValue([] as any)
    const res = await request(createApp()).get('/api/migration/export?format=csv&entity=categories')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/migration/templates', () => {
  it('returns headers-only csv', async () => {
    const res = await request(createApp()).get('/api/migration/templates?entity=products')
    expect(res.status).toBe(200)
    expect(res.headers['content-disposition']).toContain('template-products.csv')
    expect(res.text).toContain('name,code,barcode')
  })

  it('rejects invalid entity', async () => {
    const res = await request(createApp()).get('/api/migration/templates?entity=nope')
    expect(res.status).toBe(400)
  })
})

describe('POST /api/migration/preview', () => {
  it('requires root role', async () => {
    roleState.role = 'admin'
    const res = await request(createApp()).post('/api/migration/preview').send({ payload: {} })
    expect(res.status).toBe(403)
  })

  it('rejects missing payload', async () => {
    const res = await request(createApp()).post('/api/migration/preview').send({})
    expect(res.status).toBe(400)
  })

  it('returns csv preview for root', async () => {
    mockEmptyDb()
    const res = await request(createApp())
      .post('/api/migration/preview')
      .send({ payload: { format: 'csv', entity: 'categories', csvText: 'name\r\nCafé\r\n' } })

    expect(res.status).toBe(200)
    expect(res.body.format).toBe('csv')
    expect(res.body.summary[0].total).toBe(1)
  })

  it('returns backup preview for root', async () => {
    mockEmptyDb()
    const res = await request(createApp())
      .post('/api/migration/preview')
      .send({
        payload: {
          format: 'silverknight-backup',
          version: 1,
          data: { categories: [{ name: 'Bebidas' }] }
        }
      })

    expect(res.status).toBe(200)
    const cat = res.body.summary.find((s: { entity: string }) => s.entity === 'categories')
    expect(cat.total).toBe(1)
  })

  it('returns preview with overwrite classification when strategy is overwrite', async () => {
    mockEmptyDb()
    vi.mocked(prisma.category.findMany).mockResolvedValue([
      { id: 'c1', name: 'Bebidas' }
    ] as any)

    const res = await request(createApp())
      .post('/api/migration/preview')
      .send({
        payload: {
          format: 'silverknight-backup',
          version: 1,
          data: { categories: [{ name: 'Bebidas' }] }
        },
        strategy: 'overwrite'
      })

    expect(res.status).toBe(200)
    const cat = res.body.summary.find((s: { entity: string }) => s.entity === 'categories')
    expect(cat.toOverwrite).toBe(1)
    expect(cat.toSkip).toBe(0)
  })
})

describe('POST /api/migration/import', () => {
  it('requires root role', async () => {
    roleState.role = 'admin'
    const res = await request(createApp())
      .post('/api/migration/import')
      .send({ payload: {}, strategy: 'skip' })
    expect(res.status).toBe(403)
  })

  it('rejects missing strategy', async () => {
    mockEmptyDb()
    const res = await request(createApp())
      .post('/api/migration/import')
      .send({ payload: { format: 'csv', entity: 'categories', csvText: 'name\r\nCafé\r\n' } })
    expect(res.status).toBe(400)
  })

  it('rejects invalid strategy', async () => {
    mockEmptyDb()
    const res = await request(createApp())
      .post('/api/migration/import')
      .send({ payload: {}, strategy: 'nope' })
    expect(res.status).toBe(400)
  })

  it('imports a csv file and logs it', async () => {
    mockEmptyDb()
    const tx = makeTx()
    mockTransaction(tx)

    const res = await request(createApp())
      .post('/api/migration/import')
      .send({
        payload: { format: 'csv', entity: 'categories', csvText: 'name\r\nCafé\r\n' },
        strategy: 'skip'
      })

    expect(res.status).toBe(200)
    expect(res.body.summary[0].imported).toBe(1)
    expect(prisma.migrationLog.create).toHaveBeenCalled()
  })

  it('returns 500 and rolls back on transaction failure', async () => {
    mockEmptyDb()
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error('db down'))

    const res = await request(createApp())
      .post('/api/migration/import')
      .send({
        payload: { format: 'csv', entity: 'categories', csvText: 'name\r\nCafé\r\n' },
        strategy: 'skip'
      })

    expect(res.status).toBe(500)
    expect(res.body.error).toContain('revertida')
    expect(prisma.migrationLog.create).not.toHaveBeenCalled()
  })

  it('rejects create-new strategy', async () => {
    mockEmptyDb()
    const res = await request(createApp())
      .post('/api/migration/import')
      .send({ payload: { format: 'csv', entity: 'categories', csvText: 'name\r\nCafé\r\n' }, strategy: 'create-new' })
    expect(res.status).toBe(400)
  })

  it('passes fileName to migration log', async () => {
    mockEmptyDb()
    const tx = makeTx()
    mockTransaction(tx)

    await request(createApp())
      .post('/api/migration/import')
      .send({
        payload: { format: 'csv', entity: 'categories', csvText: 'name\r\nCafé\r\n' },
        strategy: 'skip',
        fileName: 'test.csv'
      })

    expect(prisma.migrationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fileName: 'test.csv' })
      })
    )
  })
})

describe('GET /api/migration/logs', () => {
  it('returns logs for root', async () => {
    vi.mocked(prisma.migrationLog.findMany).mockResolvedValue([
      { id: 'l1', kind: 'csv', strategy: 'skip', imported: 1, skipped: 0, errors: 0 }
    ] as any)

    const res = await request(createApp()).get('/api/migration/logs')

    expect(res.status).toBe(200)
    expect(res.body.logs).toHaveLength(1)
    expect(prisma.migrationLog.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      take: 100
    })
  })

  it('rejects operator role', async () => {
    roleState.role = 'operador'
    const res = await request(createApp()).get('/api/migration/logs')
    expect(res.status).toBe(403)
  })
})
