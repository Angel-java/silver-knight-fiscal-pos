import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../database/prisma', () => ({
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
    migrationLog: { create: vi.fn() },
    $transaction: vi.fn()
  }
}))

import { prisma } from '../database/prisma'
import { previewImport, applyImport } from './importer'
import { AppError } from '../middleware/errorHandler'

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
}

function makeTx(): Record<string, any> {
  const counters: Record<string, number> = {}
  const entity = (name: string) => ({
    create: vi.fn(async (args: any) => {
      counters[name] = (counters[name] ?? 0) + 1
      return { id: `${name}-${counters[name]}`, ...(args.data ?? {}) }
    }),
    update: vi.fn(async (args: any) => ({
      id: args.where?.id ?? 'x',
      ...(args.data ?? {})
    })),
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

function mockTransaction(tx: Record<string, any>): void {
  vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx))
}

beforeEach(() => {
  vi.clearAllMocks()
})

const VALID_BACKUP = {
  format: 'silverknight-backup',
  version: 1,
  data: {
    categories: [{ id: 'old-cat', name: 'Bebidas', description: 'Gaseosas' }],
    suppliers: [{ id: 'old-sup', name: 'Distribuidora X', rif: 'J-123' }],
    products: [
      {
        id: 'old-prod',
        name: 'Café',
        code: 'CAF-1',
        priceUsd: 5,
        ivaRate: 16,
        stock: 10,
        categoryId: 'old-cat',
        supplierId: 'old-sup'
      }
    ],
    invoices: [
      {
        id: 'old-inv',
        number: 'INV-0001',
        documentType: 'FACT',
        controlNumber: 'CF-001',
        customerId: null,
        userId: null,
        totalUsd: 10,
        totalVes: 920,
        ivaUsd: 1.6,
        ivaVes: 147,
        currency: 'USD',
        exchangeRate: 92,
        status: 'active',
        payments: null,
        createdAt: '2026-01-01T10:00:00Z',
        items: [{ productId: 'old-prod', productName: 'Café', quantity: 2, unitPriceUsd: 5, ivaRate: 16, totalUsd: 10, totalVes: 920 }]
      }
    ]
  }
}

describe('previewImport', () => {
  it('rejects unsupported formats', async () => {
    await expect(previewImport({ format: 'nope' })).rejects.toThrow(AppError)
  })

  it('rejects future backup versions', async () => {
    await expect(
      previewImport({ format: 'silverknight-backup', version: 999, data: {} })
    ).rejects.toThrow(/Versión/)
  })

  it('summarizes backup entities with classification', async () => {
    mockEmptyDb()
    const preview = await previewImport(VALID_BACKUP)

    expect(preview.format).toBe('backup')
    const byEntity = new Map(preview.summary.map((s) => [s.entity, s]))
    expect(byEntity.get('categories')).toMatchObject({ total: 1, toCreate: 1 })
    expect(byEntity.get('products')).toMatchObject({ total: 1, toCreate: 1 })
    expect(byEntity.get('invoices')).toMatchObject({ total: 1, toCreate: 1 })
  })

  it('marks existing records as skip', async () => {
    mockEmptyDb()
    vi.mocked(prisma.category.findMany).mockResolvedValue([
      { id: 'c1', name: 'Bebidas' }
    ] as any)

    const preview = await previewImport(VALID_BACKUP)
    const cat = preview.summary.find((s) => s.entity === 'categories')
    expect(cat?.toSkip).toBe(1)
    expect(cat?.toCreate).toBe(0)
  })

  it('parses csv preview', async () => {
    mockEmptyDb()
    const preview = await previewImport({
      format: 'csv',
      entity: 'categories',
      csvText: 'name,description\r\nCafé,Arábica\r\n'
    })

    expect(preview.format).toBe('csv')
    expect(preview.entity).toBe('categories')
    expect(preview.totalRecords).toBe(1)
    expect(preview.summary[0]).toMatchObject({ toCreate: 1, toSkip: 0 })
  })

  it('collects validation errors for bad rows', async () => {
    mockEmptyDb()
    const preview = await previewImport({
      format: 'csv',
      entity: 'products',
      csvText: 'name,priceUsd\r\nCafé,abc\r\n'
    })

    expect(preview.summary[0].errors.length).toBeGreaterThan(0)
  })

  it('classifies conflicts as toOverwrite when strategy is overwrite', async () => {
    mockEmptyDb()
    vi.mocked(prisma.category.findMany).mockResolvedValue([
      { id: 'c1', name: 'Bebidas' }
    ] as any)

    const preview = await previewImport(VALID_BACKUP, 'overwrite')
    const cat = preview.summary.find((s) => s.entity === 'categories')
    expect(cat?.toOverwrite).toBe(1)
    expect(cat?.toSkip).toBe(0)
    expect(cat?.toCreate).toBe(0)
  })

  it('classifies conflicts as toSkip when strategy is skip', async () => {
    mockEmptyDb()
    vi.mocked(prisma.category.findMany).mockResolvedValue([
      { id: 'c1', name: 'Bebidas' }
    ] as any)

    const preview = await previewImport(VALID_BACKUP, 'skip')
    const cat = preview.summary.find((s) => s.entity === 'categories')
    expect(cat?.toSkip).toBe(1)
    expect(cat?.toOverwrite).toBe(0)
  })

  it('classifies conflicts as toSkip when no strategy provided', async () => {
    mockEmptyDb()
    vi.mocked(prisma.category.findMany).mockResolvedValue([
      { id: 'c1', name: 'Bebidas' }
    ] as any)

    const preview = await previewImport(VALID_BACKUP)
    const cat = preview.summary.find((s) => s.entity === 'categories')
    expect(cat?.toSkip).toBe(1)
    expect(cat?.toOverwrite).toBe(0)
  })
})

describe('applyImport', () => {
  it('rejects invalid strategy', async () => {
    await expect(
      applyImport(VALID_BACKUP, 'other' as any, 'u1')
    ).rejects.toThrow(AppError)
  })

  it('rejects unsupported format', async () => {
    await expect(applyImport({ format: 'nope' }, 'skip', 'u1')).rejects.toThrow(AppError)
  })

  it('creates backup records and logs the import', async () => {
    mockEmptyDb()
    const tx = makeTx()
    mockTransaction(tx)

    const result = await applyImport(VALID_BACKUP, 'skip', 'u1')

    expect(tx.category.create).toHaveBeenCalledTimes(1)
    expect(tx.supplier.create).toHaveBeenCalledTimes(1)
    expect(tx.product.create).toHaveBeenCalledTimes(1)
    expect(tx.invoice.create).toHaveBeenCalledTimes(1)

    const invoiceData = tx.invoice.create.mock.calls[0][0].data
    expect(invoiceData.importedFrom).toBe('backup')
    expect(invoiceData.createdAt).toEqual(new Date('2026-01-01T10:00:00Z'))
    expect(invoiceData.items.create).toHaveLength(1)

    expect(result.summary).toHaveLength(4)
    const importedTotal = result.summary.reduce((a, s) => a + s.imported, 0)
    expect(importedTotal).toBe(4)

    expect(prisma.migrationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'backup', strategy: 'skip', imported: 4 })
      })
    )
  })

  it('maps category references to new product ids', async () => {
    mockEmptyDb()
    const tx = makeTx()
    mockTransaction(tx)

    await applyImport(VALID_BACKUP, 'skip', 'u1')

    const productData = tx.product.create.mock.calls[0][0].data
    expect(productData.categoryId).toBe('category-1')
    expect(productData.supplierId).toBe('supplier-1')
    const itemProductId = tx.invoice.create.mock.calls[0][0].data.items.create[0].productId
    expect(itemProductId).toBe('product-1')
  })

  it('skips existing records with skip strategy', async () => {
    mockEmptyDb()
    vi.mocked(prisma.category.findMany).mockResolvedValue([
      { id: 'c1', name: 'Bebidas' }
    ] as any)
    const tx = makeTx()
    mockTransaction(tx)

    const result = await applyImport(VALID_BACKUP, 'skip', 'u1')

    expect(tx.category.create).not.toHaveBeenCalled()
    const cat = result.summary.find((s) => s.entity === 'categories')
    expect(cat?.skipped).toBe(1)
  })

  it('overwrites existing records with overwrite strategy', async () => {
    mockEmptyDb()
    vi.mocked(prisma.category.findMany).mockResolvedValue([
      { id: 'c1', name: 'Bebidas' }
    ] as any)
    const tx = makeTx()
    mockTransaction(tx)

    const result = await applyImport(VALID_BACKUP, 'overwrite', 'u1')

    expect(tx.category.create).not.toHaveBeenCalled()
    expect(tx.category.update).toHaveBeenCalledTimes(1)
    const cat = result.summary.find((s) => s.entity === 'categories')
    expect(cat?.overwritten).toBe(1)
  })

  it('never overwrites fiscal controls', async () => {
    mockEmptyDb()
    const controls = [
      { id: 'fc-1', documentType: 'FACT', prefix: '0F', resolution: 'R-1', startNumber: 1, endNumber: 100, currentNumber: 5, issuedAt: '2026-01-01' }
    ]
    const backup = {
      format: 'silverknight-backup',
      version: 1,
      data: { fiscalControls: controls }
    }
    vi.mocked(prisma.fiscalControl.findMany).mockResolvedValue(controls as any)
    const tx = makeTx()
    mockTransaction(tx)

    const result = await applyImport(backup, 'overwrite', 'u1')

    const fc = result.summary.find((s) => s.entity === 'fiscalControls')
    expect(fc?.overwritten).toBe(0)
    expect(fc?.skipped).toBe(1)
    expect(tx.fiscalControl.update).not.toHaveBeenCalled()
  })

  it('never replaces the existing root user', async () => {
    mockEmptyDb()
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'root-1' } as any)
    const backup = {
      format: 'silverknight-backup',
      version: 1,
      data: {
        users: [
          { id: 'root-old', username: 'root', role: 'root', permissions: null },
          { id: 'op-old', username: 'operador1', role: 'operador', permissions: null }
        ]
      }
    }
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'root-1', username: 'root' },
      { id: 'op-1', username: 'operador1' }
    ] as any)
    const tx = makeTx()
    mockTransaction(tx)

    const result = await applyImport(backup, 'overwrite', 'u1')

    expect(tx.user.update).toHaveBeenCalledTimes(1)
    expect(tx.user.update.mock.calls[0][0].where.id).toBe('op-1')
    const users = result.summary.find((s) => s.entity === 'users')
    expect(users?.skipped).toBe(1)
    expect(users?.overwritten).toBe(1)
  })

  it('applies csv imports', async () => {
    mockEmptyDb()
    const tx = makeTx()
    mockTransaction(tx)

    const result = await applyImport(
      { format: 'csv', entity: 'categories', csvText: 'name,description\r\nCafé,Arábica\r\n' },
      'skip',
      'u1'
    )

    expect(tx.category.create).toHaveBeenCalledTimes(1)
    expect(result.format).toBe('csv')
    expect(result.summary[0].imported).toBe(1)
    expect(prisma.migrationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'csv', entity: 'categories' })
      })
    )
  })

  it('rolls back when the transaction throws', async () => {
    mockEmptyDb()
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error('db down'))

    await expect(applyImport(VALID_BACKUP, 'skip', 'u1')).rejects.toThrow(AppError)
    expect(prisma.migrationLog.create).not.toHaveBeenCalled()
  })

  it('rejects create-new strategy', async () => {
    await expect(
      applyImport(VALID_BACKUP, 'create-new' as any, 'u1')
    ).rejects.toThrow(AppError)
  })

  it('assigns default hashed PIN to imported users', async () => {
    mockEmptyDb()
    const tx = makeTx()
    mockTransaction(tx)

    await applyImport(
      {
        format: 'silverknight-backup',
        version: 1,
        data: { users: [{ id: 'u1', username: 'operador1', role: 'operador', permissions: null }] }
      },
      'skip',
      'u1'
    )

    const userData = tx.user.create.mock.calls[0][0].data
    expect(userData.pin).toBeDefined()
    expect(userData.pin).not.toBe('1234')
    expect(userData.pin.length).toBeGreaterThan(10)
  })

  it('logs fileName when provided', async () => {
    mockEmptyDb()
    const tx = makeTx()
    mockTransaction(tx)

    await applyImport(VALID_BACKUP, 'skip', 'u1', 'backup-2026.json')

    expect(prisma.migrationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fileName: 'backup-2026.json' })
      })
    )
  })

  it('logs null fileName when not provided', async () => {
    mockEmptyDb()
    const tx = makeTx()
    mockTransaction(tx)

    await applyImport(VALID_BACKUP, 'skip', 'u1')

    expect(prisma.migrationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fileName: null })
      })
    )
  })
})
