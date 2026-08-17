import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../database/prisma', () => ({
  prisma: {
    category: { findMany: vi.fn() },
    supplier: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    customer: { findMany: vi.fn() },
    exchangeRate: { findMany: vi.fn() },
    company: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    fiscalControl: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
    inventoryMovement: { findMany: vi.fn() },
    setting: { findMany: vi.fn() }
  }
}))

import { prisma } from '../database/prisma'
import { exportCsv, exportBackup, getTemplateCsv, CSV_HEADERS } from './exporter'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CSV_HEADERS', () => {
  it('exposes headers for every csv entity', () => {
    expect(CSV_HEADERS.categories).toEqual(['name', 'description'])
    expect(CSV_HEADERS.products).toContain('priceUsd')
    expect(CSV_HEADERS['exchange-rates']).toEqual(['date', 'rate', 'source'])
  })
})

describe('exportCsv', () => {
  it('exports categories as csv with BOM and header row', async () => {
    vi.mocked(prisma.category.findMany).mockResolvedValue([
      { name: 'Bebidas', description: 'Gaseosas' }
    ] as any)

    const res = await exportCsv('categories')

    expect(res.contentType).toBe('text/csv')
    expect(res.filename).toBe('categories.csv')
    expect(res.content.startsWith('\uFEFFname,description\r\n')).toBe(true)
    expect(res.content).toContain('Bebidas,Gaseosas')
  })

  it('exports products with category name column', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        name: 'Café',
        code: 'CAF-1',
        priceUsd: 5,
        ivaRate: 16,
        stock: 10,
        minStock: 2,
        isActive: true,
        category: { name: 'Alimentos' },
        supplier: null
      }
    ] as any)

    const res = await exportCsv('products')

    expect(res.filename).toBe('products.csv')
    expect(res.content).toContain('Café,CAF-1,,,5,,16,10,2,Alimentos,,true')
  })

  it('exports exchange-rates with date-only format', async () => {
    vi.mocked(prisma.exchangeRate.findMany).mockResolvedValue([
      { date: new Date('2026-07-04T12:00:00Z'), rate: 92.5, source: 'bcv' }
    ] as any)

    const res = await exportCsv('exchange-rates')

    expect(res.content).toContain('2026-07-04,92.5,bcv')
  })
})

describe('getTemplateCsv', () => {
  it('returns headers-only csv', () => {
    const res = getTemplateCsv('suppliers')
    expect(res.filename).toBe('template-suppliers.csv')
    expect(res.content).toBe('\uFEFFname,rif,phone,email,address\r\n')
  })
})

describe('exportBackup', () => {
  it('builds a backup envelope with format and version', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([{ name: 'ACME', rif: 'J-1' }] as any)
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.setting.findMany).mockResolvedValue([{ key: 'ivaRate', value: '16' }] as any)

    const res = await exportBackup('config')

    expect(res.contentType).toBe('application/json')
    const parsed = JSON.parse(res.content)
    expect(parsed.format).toBe('silverknight-backup')
    expect(parsed.version).toBe(1)
    expect(parsed.exportedAt).toBeTruthy()
    expect(parsed.data.company).toHaveLength(1)
    expect(parsed.data.settings).toHaveLength(1)
    expect(parsed.data.products).toBeUndefined()
  })

  it('scope all includes every non-empty entity', async () => {
    vi.mocked(prisma.category.findMany).mockResolvedValue([{ name: 'Bebidas' }] as any)
    vi.mocked(prisma.supplier.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.customer.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.exchangeRate.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.company.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.fiscalControl.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.inventoryMovement.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.setting.findMany).mockResolvedValue([] as any)

    const res = await exportBackup('all')

    const parsed = JSON.parse(res.content)
    expect(parsed.data.categories).toHaveLength(1)
  })
})
