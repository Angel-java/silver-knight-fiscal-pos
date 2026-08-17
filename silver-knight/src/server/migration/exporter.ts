import { prisma } from '../database/prisma'
import { csvSerialize } from './csv'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type CsvEntity,
  type ExportScope
} from './formats'

export interface ExportResult {
  filename: string
  content: string
  contentType: string
}

const CSV_COLUMNS: Record<
  CsvEntity,
  { headers: string[]; row: (r: Record<string, unknown>) => Record<string, unknown> }
> = {
  categories: {
    headers: ['name', 'description'],
    row: (r) => ({ name: r.name, description: r.description ?? '' })
  },
  suppliers: {
    headers: ['name', 'rif', 'phone', 'email', 'address'],
    row: (r) => ({
      name: r.name,
      rif: r.rif ?? '',
      phone: r.phone ?? '',
      email: r.email ?? '',
      address: r.address ?? ''
    })
  },
  products: {
    headers: [
      'name',
      'code',
      'barcode',
      'description',
      'priceUsd',
      'costUsd',
      'ivaRate',
      'stock',
      'minStock',
      'category',
      'supplier',
      'isActive'
    ],
    row: (r) => ({
      name: r.name,
      code: r.code ?? '',
      barcode: r.barcode ?? '',
      description: r.description ?? '',
      priceUsd: r.priceUsd,
      costUsd: r.costUsd ?? '',
      ivaRate: r.ivaRate,
      stock: r.stock,
      minStock: r.minStock,
      category: (r.category as { name?: string } | null)?.name ?? '',
      supplier: (r.supplier as { name?: string } | null)?.name ?? '',
      isActive: r.isActive ? 'true' : 'false'
    })
  },
  customers: {
    headers: ['name', 'rif', 'address', 'phone', 'email', 'creditLimitUsd'],
    row: (r) => ({
      name: r.name,
      rif: r.rif ?? '',
      address: r.address ?? '',
      phone: r.phone ?? '',
      email: r.email ?? '',
      creditLimitUsd: r.creditLimitUsd ?? ''
    })
  },
  'exchange-rates': {
    headers: ['date', 'rate', 'source'],
    row: (r) => ({
      date: (r.date instanceof Date ? r.date : new Date(r.date as string)).toISOString().slice(0, 10),
      rate: r.rate,
      source: r.source ?? 'manual'
    })
  }
}

const CSV_FILE_NAMES: Record<CsvEntity, string> = {
  categories: 'categories.csv',
  suppliers: 'suppliers.csv',
  products: 'products.csv',
  customers: 'customers.csv',
  'exchange-rates': 'exchange-rates.csv'
}

export const CSV_HEADERS: Record<CsvEntity, string[]> = Object.fromEntries(
  Object.entries(CSV_COLUMNS).map(([key, cfg]) => [key, cfg.headers])
) as Record<CsvEntity, string[]>

export async function exportCsv(entity: CsvEntity): Promise<ExportResult> {
  const cfg = CSV_COLUMNS[entity]
  let rows: Array<Record<string, unknown>>

  switch (entity) {
    case 'categories':
      rows = await prisma.category.findMany()
      break
    case 'suppliers':
      rows = await prisma.supplier.findMany()
      break
    case 'products':
      rows = await prisma.product.findMany({ include: { category: true, supplier: true } })
      break
    case 'customers':
      rows = await prisma.customer.findMany()
      break
    case 'exchange-rates':
      rows = await prisma.exchangeRate.findMany()
      break
  }

  const content = csvSerialize(cfg.headers, rows.map((r) => cfg.row(r)))
  return { filename: CSV_FILE_NAMES[entity], content, contentType: 'text/csv' }
}

export function getTemplateCsv(entity: CsvEntity): ExportResult {
  const headers = CSV_COLUMNS[entity].headers
  const content = csvSerialize(headers, [])
  return {
    filename: `template-${CSV_FILE_NAMES[entity]}`,
    content,
    contentType: 'text/csv'
  }
}

const SCOPE_GROUPS: Record<ExportScope, string[]> = {
  all: [
    'company',
    'users',
    'categories',
    'suppliers',
    'products',
    'customers',
    'fiscalControls',
    'invoices',
    'inventoryMovements',
    'exchangeRates',
    'settings'
  ],
  catalog: ['categories', 'suppliers', 'products'],
  customers: ['customers'],
  invoices: ['fiscalControls', 'invoices'],
  inventory: ['inventoryMovements'],
  'exchange-rates': ['exchangeRates'],
  config: ['company', 'users', 'settings']
}

function include(scope: ExportScope, group: string): boolean {
  return SCOPE_GROUPS[scope].includes(group)
}

async function fetchEntity(name: string): Promise<unknown[]> {
  switch (name) {
    case 'company':
      return prisma.company.findMany()
    case 'users':
      return prisma.user.findMany({
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          permissions: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      })
    case 'categories':
      return prisma.category.findMany()
    case 'suppliers':
      return prisma.supplier.findMany()
    case 'products':
      return prisma.product.findMany()
    case 'customers':
      return prisma.customer.findMany()
    case 'fiscalControls':
      return prisma.fiscalControl.findMany()
    case 'invoices':
      return prisma.invoice.findMany({ include: { items: true } })
    case 'inventoryMovements':
      return prisma.inventoryMovement.findMany()
    case 'exchangeRates':
      return prisma.exchangeRate.findMany()
    case 'settings':
      return prisma.setting.findMany()
    default:
      return []
  }
}

export async function exportBackup(scope: ExportScope): Promise<ExportResult> {
  const groups: Array<{ name: string; fetch: () => Promise<unknown[]> }> = [
    { name: 'company', fetch: () => fetchEntity('company') },
    { name: 'users', fetch: () => fetchEntity('users') },
    { name: 'categories', fetch: () => fetchEntity('categories') },
    { name: 'suppliers', fetch: () => fetchEntity('suppliers') },
    { name: 'products', fetch: () => fetchEntity('products') },
    { name: 'customers', fetch: () => fetchEntity('customers') },
    { name: 'fiscalControls', fetch: () => fetchEntity('fiscalControls') },
    { name: 'invoices', fetch: () => fetchEntity('invoices') },
    { name: 'inventoryMovements', fetch: () => fetchEntity('inventoryMovements') },
    { name: 'exchangeRates', fetch: () => fetchEntity('exchangeRates') },
    { name: 'settings', fetch: () => fetchEntity('settings') }
  ]

  const data: Record<string, unknown[]> = {}
  for (const g of groups) {
    if (include(scope, g.name)) {
      const records = await g.fetch()
      if (records.length) data[g.name] = records
    }
  }

  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: process.env['npm_package_version'] || 'unknown',
    data
  }

  const dateTag = new Date().toISOString().slice(0, 10)
  return {
    filename: `silver-knight-backup-${dateTag}.json`,
    content: JSON.stringify(backup, null, 2),
    contentType: 'application/json'
  }
}
