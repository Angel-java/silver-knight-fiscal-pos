import bcrypt from 'bcryptjs'
import { prisma } from '../database/prisma'
import { logger } from '../utils/logger'
import { csvParse } from './csv'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  CSV_ENTITIES,
  type CsvEntity,
  type ImportStrategy
} from './formats'
import { AppError } from '../middleware/errorHandler'
import {
  createCategorySchema,
  createCustomerSchema,
  createExchangeRateSchema,
  createFiscalControlSchema,
  createProductSchema,
  createSupplierSchema
} from '../validation/schemas'
import { DEFAULT_IVA_RATE } from '../config'
import { randomBytes } from 'crypto'

type EntityName =
  | 'company'
  | 'users'
  | 'categories'
  | 'suppliers'
  | 'products'
  | 'customers'
  | 'fiscalControls'
  | 'invoices'
  | 'inventoryMovements'
  | 'exchangeRates'
  | 'settings'

const BACKUP_ORDER: EntityName[] = [
  'company',
  'users',
  'categories',
  'suppliers',
  'products',
  'customers',
  'fiscalControls',
  'exchangeRates',
  'invoices',
  'inventoryMovements',
  'settings'
]

const NULL_REF = ''

export interface MigrationError {
  row: number
  message: string
}

export interface MigrationEntityErrors {
  entity: string
  errors: MigrationError[]
}

export interface PreviewEntitySummary {
  entity: string
  total: number
  toCreate: number
  toSkip: number
  toOverwrite: number
  errors: MigrationError[]
}

export interface MigrationPreview {
  format: 'backup' | 'csv'
  entity?: string
  summary: PreviewEntitySummary[]
  totalRecords: number
}

export interface ImportEntityResult {
  entity: string
  imported: number
  skipped: number
  overwritten: number
  errors: MigrationError[]
}

export interface MigrationImportResult {
  format: 'backup' | 'csv'
  entity?: string
  strategy: ImportStrategy
  summary: ImportEntityResult[]
  durationMs: number
}

interface ExistingKeys {
  categoryByName: Map<string, string>
  supplierByName: Map<string, string>
  productByCode: Map<string, string>
  productByBarcode: Map<string, string>
  customerByRif: Map<string, string>
  fiscalByKey: Map<string, string>
  userByUsername: Map<string, string>
  userRoleById: Map<string, string>
  companyByRif: Map<string, string>
  invoiceByNumber: Map<string, string>
  settingByKey: Map<string, string>
  hasRoot: boolean
  hasCompany: boolean
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

function lower(s: string | null | undefined): string {
  return (s ?? '').toLowerCase()
}

function toDate(v: unknown): Date | null {
  if (v == null || v === '') return null
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? null : d
}

function toNum(v: string | undefined): number {
  const n = Number((v ?? '').trim().replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function toNullable(v: string | undefined): string | null {
  const s = (v ?? '').trim()
  return s === '' ? null : s
}

function toNullableNum(v: string | undefined): number | null {
  if ((v ?? '').trim() === '') return null
  const n = toNum(v)
  return Number.isFinite(n) ? n : null
}

function toBool(v: string | undefined, dflt = true): boolean {
  const s = (v ?? '').trim().toLowerCase()
  if (s === '') return dflt
  return ['true', '1', 'yes', 'si', 'sí', 'y'].includes(s)
}

function paymentsToDb(v: unknown): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return null
  }
}

function normalizePermissions(v: unknown): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return JSON.stringify(v)
  return JSON.stringify(v)
}

function msg(e: unknown): string {
  if (e instanceof Error) {
    const prismaErr = e as { code?: string }
    if (prismaErr.code === 'P2002') return 'Ya existe un registro con la misma clave única'
    return e.message
  }
  return String(e)
}

async function loadExistingKeys(): Promise<ExistingKeys> {
  const [
    categories,
    suppliers,
    products,
    customers,
    fiscalControls,
    users,
    companies,
    invoices,
    settings,
    rootUser,
    companyAny
  ] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true } }),
    prisma.supplier.findMany({ select: { id: true, name: true } }),
    prisma.product.findMany({ select: { id: true, code: true, barcode: true } }),
    prisma.customer.findMany({ select: { id: true, rif: true } }),
    prisma.fiscalControl.findMany({ select: { id: true, documentType: true, prefix: true } }),
    prisma.user.findMany({ select: { id: true, username: true, role: true } }),
    prisma.company.findMany({ select: { id: true, rif: true } }),
    prisma.invoice.findMany({ select: { id: true, number: true } }),
    prisma.setting.findMany({ select: { id: true, key: true } }),
    prisma.user.findFirst({ where: { role: 'root' }, select: { id: true } }),
    prisma.company.findFirst({ select: { id: true } })
  ])

  return {
    categoryByName: new Map(categories.map((c) => [lower(c.name), c.id])),
    supplierByName: new Map(suppliers.map((s) => [lower(s.name), s.id])),
    productByCode: new Map(products.filter((p) => p.code).map((p) => [p.code as string, p.id])),
    productByBarcode: new Map(
      products.filter((p) => p.barcode).map((p) => [p.barcode as string, p.id])
    ),
    customerByRif: new Map(customers.filter((c) => c.rif).map((c) => [c.rif as string, c.id])),
    fiscalByKey: new Map(fiscalControls.map((f) => [`${f.documentType}:${f.prefix}`, f.id])),
    userByUsername: new Map(users.map((u) => [lower(u.username), u.id])),
    userRoleById: new Map(users.map((u) => [u.id, u.role])),
    companyByRif: new Map(companies.map((c) => [c.rif, c.id])),
    invoiceByNumber: new Map(invoices.map((i) => [i.number, i.id])),
    settingByKey: new Map(settings.map((s) => [s.key, s.id])),
    hasRoot: !!rootUser,
    hasCompany: !!companyAny
  }
}

function classifyBackupRecord(
  entity: EntityName,
  rec: Record<string, unknown>,
  keys: ExistingKeys
): 'conflict' | 'new' {
  switch (entity) {
    case 'company':
      return keys.hasCompany ? 'conflict' : 'new'
    case 'users':
      return keys.userByUsername.has(lower(String(rec.username ?? ''))) ? 'conflict' : 'new'
    case 'categories':
      return keys.categoryByName.has(lower(String(rec.name ?? ''))) ? 'conflict' : 'new'
    case 'suppliers':
      return keys.supplierByName.has(lower(String(rec.name ?? ''))) ? 'conflict' : 'new'
    case 'products': {
      const code = rec.code ? String(rec.code) : null
      const barcode = rec.barcode ? String(rec.barcode) : null
      if (
        (code && keys.productByCode.has(code)) ||
        (barcode && keys.productByBarcode.has(barcode))
      ) {
        return 'conflict'
      }
      return 'new'
    }
    case 'customers':
      return rec.rif && keys.customerByRif.has(String(rec.rif)) ? 'conflict' : 'new'
    case 'fiscalControls':
      return keys.fiscalByKey.has(`${rec.documentType}:${rec.prefix}`) ? 'conflict' : 'new'
    case 'invoices':
      return keys.invoiceByNumber.has(String(rec.number)) ? 'conflict' : 'new'
    case 'settings':
      return rec.key && keys.settingByKey.has(String(rec.key)) ? 'conflict' : 'new'
    case 'exchangeRates':
      return 'new'
    default:
      return 'new'
  }
}

function validateBackupRecord(entity: EntityName, rec: Record<string, unknown>): string | null {
  switch (entity) {
    case 'company':
      if (!rec.name || !rec.rif) return 'Empresa requiere nombre y RIF'
      return null
    case 'users': {
      if (!rec.username) return 'Usuario requiere username'
      const validRoles = ['root', 'admin', 'gerente', 'operador']
      if (rec.role && !validRoles.includes(String(rec.role))) {
        return 'Rol inválido. Solo se permiten: root, admin, gerente, operador'
      }
      return null
    }
    case 'categories': {
      const r = createCategorySchema.safeParse(rec)
      return r.success ? null : r.error.issues[0].message
    }
    case 'suppliers': {
      const r = createSupplierSchema.safeParse(rec)
      return r.success ? null : r.error.issues[0].message
    }
    case 'products': {
      const r = createProductSchema.safeParse(rec)
      return r.success ? null : r.error.issues[0].message
    }
    case 'customers': {
      const r = createCustomerSchema.safeParse(rec)
      return r.success ? null : r.error.issues[0].message
    }
    case 'fiscalControls': {
      const r = createFiscalControlSchema.safeParse(rec)
      return r.success ? null : r.error.issues[0].message
    }
    case 'invoices': {
      if (!rec.number) return 'Factura requiere número'
      if (!Array.isArray(rec.items) || rec.items.length === 0) {
        return 'Factura requiere al menos un item'
      }
      if (rec.totalUsd == null || rec.totalVes == null) return 'Factura requiere totales'
      if (!Number.isFinite(Number(rec.totalUsd))) return 'Factura tiene un totalUsd inválido'
      if (!Number.isFinite(Number(rec.totalVes))) return 'Factura tiene un totalVes inválido'
      if (rec.documentType && !['FACT', 'NCR', 'NDB'].includes(String(rec.documentType))) {
        return 'Tipo de documento inválido'
      }
      for (const it of rec.items) {
        const item = it as Record<string, unknown>
        if (!item.productName) return 'Item requiere nombre de producto'
        if (!(Number(item.quantity) > 0)) return 'Cantidad de item debe ser positiva'
        if (!(Number(item.unitPriceUsd) > 0)) return 'Item requiere precio unitario válido'
      }
      return null
    }
    case 'inventoryMovements':
      if (!rec.productId) return 'Movimiento requiere productId'
      if (!['entry', 'exit', 'sale', 'cancellation'].includes(String(rec.type))) {
        return 'Tipo de movimiento inválido'
      }
      if (!(Number(rec.quantity) > 0)) return 'Cantidad debe ser positiva'
      return null
    case 'exchangeRates':
      if (!(Number(rec.rate) > 0)) return 'Tasa debe ser positiva'
      return null
    case 'settings':
      if (!rec.key || rec.value == null) return 'Setting requiere key y value'
      return null
  }
}

function existingId(
  entity: EntityName,
  rec: Record<string, unknown>,
  keys: ExistingKeys
): string | undefined {
  switch (entity) {
    case 'categories':
      return rec.name ? keys.categoryByName.get(lower(String(rec.name))) : undefined
    case 'suppliers':
      return rec.name ? keys.supplierByName.get(lower(String(rec.name))) : undefined
    case 'products': {
      if (rec.code && keys.productByCode.has(String(rec.code))) {
        return keys.productByCode.get(String(rec.code))
      }
      if (rec.barcode && keys.productByBarcode.has(String(rec.barcode))) {
        return keys.productByBarcode.get(String(rec.barcode))
      }
      return undefined
    }
    case 'customers':
      return rec.rif ? keys.customerByRif.get(String(rec.rif)) : undefined
    case 'fiscalControls':
      return keys.fiscalByKey.get(`${rec.documentType}:${rec.prefix}`)
    case 'users':
      return rec.username ? keys.userByUsername.get(lower(String(rec.username))) : undefined
    case 'invoices':
      return rec.number ? keys.invoiceByNumber.get(String(rec.number)) : undefined
    case 'settings':
      return rec.key ? keys.settingByKey.get(String(rec.key)) : undefined
    default:
      return undefined
  }
}

function initMaps(): Record<string, Map<string, string>> {
  const maps: Record<string, Map<string, string>> = {}
  for (const e of [
    'categories',
    'suppliers',
    'products',
    'customers',
    'users',
    'fiscalControls',
    'invoices'
  ]) {
    maps[e] = new Map()
  }
  return maps
}

function registerSkipMapping(
  entity: EntityName,
  rec: Record<string, unknown>,
  maps: Record<string, Map<string, string>>,
  keys: ExistingKeys
): void {
  const dest = existingId(entity, rec, keys)
  if (dest && rec.id != null && maps[entity]) {
    maps[entity].set(String(rec.id), dest)
    return
  }
  if (entity === 'users' && String(rec.role ?? '') === 'root' && rec.id != null && maps['users']) {
    maps['users'].set(String(rec.id), NULL_REF)
  }
}

function registerConflictMapping(
  entity: EntityName,
  rec: Record<string, unknown>,
  maps: Record<string, Map<string, string>>,
  keys: ExistingKeys
): void {
  const dest = existingId(entity, rec, keys)
  if (dest && rec.id != null && maps[entity]) {
    maps[entity].set(String(rec.id), dest)
  }
}

function resolveRef(
  maps: Record<string, Map<string, string>>,
  entity: string,
  value: unknown
): { ok: boolean; id: string | null } {
  if (value == null || value === '') return { ok: true, id: null }
  const mapped = maps[entity]?.get(String(value))
  if (mapped === undefined) return { ok: false, id: null }
  return { ok: true, id: mapped === NULL_REF ? null : mapped }
}

function validateBackupRefs(
  entity: EntityName,
  rec: Record<string, unknown>,
  maps: Record<string, Map<string, string>>
): string | null {
  const missing = (value: unknown, label: string, target: string): string | null => {
    const r = resolveRef(maps, target, value)
    return r.ok
      ? null
      : `Referencia no encontrada (${label}): "${String(value)}" no existe en la base de datos ni en el archivo`
  }
  switch (entity) {
    case 'products': {
      const cat = missing(rec.categoryId, 'categoría', 'categories')
      if (cat) return cat
      return missing(rec.supplierId, 'proveedor', 'suppliers')
    }
    case 'invoices': {
      const cust = missing(rec.customerId, 'cliente', 'customers')
      if (cust) return cust
      const usr = missing(rec.userId, 'usuario', 'users')
      if (usr) return usr
      const fc = missing(rec.fiscalControlId, 'talonario fiscal', 'fiscalControls')
      if (fc) return fc
      if (Array.isArray(rec.items)) {
        for (const it of rec.items) {
          const item = it as Record<string, unknown>
          const prod = missing(item.productId, 'producto', 'products')
          if (prod) return prod
        }
      }
      return null
    }
    case 'inventoryMovements': {
      const prod = missing(rec.productId, 'producto', 'products')
      if (prod) return prod
      return missing(rec.userId, 'usuario', 'users')
    }
    default:
      return null
  }
}

function backupUniqueKeys(entity: EntityName, rec: Record<string, unknown>): string[] {
  switch (entity) {
    case 'company':
      return rec.rif != null && rec.rif !== '' ? [`rif:${String(rec.rif)}`] : []
    case 'users':
      return rec.username ? [`u:${lower(String(rec.username))}`] : []
    case 'categories':
      return rec.name ? [`n:${lower(String(rec.name))}`] : []
    case 'suppliers':
      return rec.name ? [`n:${lower(String(rec.name))}`] : []
    case 'products': {
      const ks: string[] = []
      if (rec.code) ks.push(`c:${String(rec.code)}`)
      if (rec.barcode) ks.push(`b:${String(rec.barcode)}`)
      return ks
    }
    case 'customers':
      return rec.rif ? [`rif:${String(rec.rif)}`] : []
    case 'fiscalControls': {
      const docType = String(rec.documentType ?? '')
      if (!docType) return []
      const prefix =
        rec.prefix != null && String(rec.prefix) !== ''
          ? String(rec.prefix)
          : `0${docType.charAt(0)}`
      return [`f:${docType}:${prefix}`]
    }
    case 'invoices':
      return rec.number ? [`num:${String(rec.number)}`] : []
    case 'settings':
      return rec.key ? [`k:${String(rec.key)}`] : []
    default:
      return []
  }
}

function csvUniqueKeys(entity: CsvEntity, built: BuiltCsvRecord): string[] {
  const data = built.data
  switch (entity) {
    case 'categories':
      return data.name ? [`n:${lower(String(data.name))}`] : []
    case 'suppliers':
      return data.name ? [`n:${lower(String(data.name))}`] : []
    case 'products': {
      const ks: string[] = []
      if (data.code) ks.push(`c:${String(data.code)}`)
      if (data.barcode) ks.push(`b:${String(data.barcode)}`)
      return ks
    }
    case 'customers':
      return data.rif ? [`rif:${String(data.rif)}`] : []
    default:
      return []
  }
}

function wouldOverwriteBackup(
  entity: EntityName,
  rec: Record<string, unknown>,
  keys: ExistingKeys
): boolean {
  switch (entity) {
    case 'company':
      return keys.companyByRif.has(String(rec.rif))
    case 'users': {
      const dest = keys.userByUsername.get(lower(String(rec.username)))
      if (!dest) return false
      if (keys.userRoleById.get(dest) === 'root') return false
      const newRole = rec.role ? String(rec.role) : 'operador'
      return newRole !== 'root'
    }
    case 'fiscalControls':
      return false
    case 'exchangeRates':
    case 'inventoryMovements':
      return false
    default:
      return !!existingId(entity, rec, keys)
  }
}

function remap(
  id: unknown,
  entity: string,
  maps: Record<string, Map<string, string>>
): string | null {
  if (id == null || id === '') return null
  const mapped = maps[entity]?.get(String(id))
  return mapped ? mapped : null
}

function remapOrRequired(
  id: unknown,
  entity: string,
  maps: Record<string, Map<string, string>>
): string {
  const mapped = remap(id, entity, maps)
  if (!mapped) throw new Error(`Referencia no encontrada para ${entity}`)
  return mapped
}

async function createBackupRecord(
  tx: Tx,
  entity: EntityName,
  rec: Record<string, unknown>,
  maps: Record<string, Map<string, string>>
): Promise<string | null> {
  switch (entity) {
    case 'company': {
      const created = await tx.company.create({
        data: {
          name: String(rec.name),
          rif: String(rec.rif),
          address: rec.address != null ? String(rec.address) : null,
          phone: rec.phone != null ? String(rec.phone) : null,
          email: rec.email != null ? String(rec.email) : null
        }
      })
      return created.id
    }
    case 'users': {
      const importPin = randomBytes(3).readUIntBE(0, 3).toString().slice(0, 6)
      const hashedPin = await bcrypt.hash(importPin, 10)
      const role = rec.role ? String(rec.role) : 'operador'
      const created = await tx.user.create({
        data: {
          username: String(rec.username),
          fullName: rec.fullName != null ? String(rec.fullName) : null,
          pin: hashedPin,
          role,
          permissions: rec.permissions != null ? normalizePermissions(rec.permissions) : null,
          isActive: rec.isActive !== false
        }
      })
      return created.id
    }
    case 'categories': {
      const created = await tx.category.create({
        data: {
          name: String(rec.name),
          description: rec.description != null ? String(rec.description) : null
        }
      })
      return created.id
    }
    case 'suppliers': {
      const created = await tx.supplier.create({
        data: {
          name: String(rec.name),
          rif: rec.rif != null ? String(rec.rif) : null,
          phone: rec.phone != null ? String(rec.phone) : null,
          email: rec.email != null ? String(rec.email) : null,
          address: rec.address != null ? String(rec.address) : null
        }
      })
      return created.id
    }
    case 'products': {
      const created = await tx.product.create({
        data: {
          name: String(rec.name),
          code: rec.code != null ? String(rec.code) : null,
          barcode: rec.barcode != null ? String(rec.barcode) : null,
          description: rec.description != null ? String(rec.description) : null,
          priceUsd: Number(rec.priceUsd),
          costUsd: rec.costUsd != null ? Number(rec.costUsd) : null,
          ivaRate: rec.ivaRate != null ? Number(rec.ivaRate) : DEFAULT_IVA_RATE,
          stock: rec.stock != null ? Number(rec.stock) : 0,
          minStock: rec.minStock != null ? Number(rec.minStock) : 0,
          categoryId: remap(rec.categoryId, 'categories', maps),
          supplierId: remap(rec.supplierId, 'suppliers', maps),
          isActive: rec.isActive !== false
        }
      })
      return created.id
    }
    case 'customers': {
      const created = await tx.customer.create({
        data: {
          name: String(rec.name),
          rif: rec.rif != null ? String(rec.rif) : null,
          address: rec.address != null ? String(rec.address) : null,
          phone: rec.phone != null ? String(rec.phone) : null,
          email: rec.email != null ? String(rec.email) : null,
          creditLimitUsd: rec.creditLimitUsd != null ? Number(rec.creditLimitUsd) : null
        }
      })
      return created.id
    }
    case 'fiscalControls': {
      const created = await tx.fiscalControl.create({
        data: {
          documentType: String(rec.documentType),
          resolution: String(rec.resolution),
          prefix: rec.prefix ? String(rec.prefix) : `0${String(rec.documentType)[0]}`,
          startNumber: rec.startNumber != null ? Number(rec.startNumber) : 1,
          endNumber: rec.endNumber != null ? Number(rec.endNumber) : 999999,
          currentNumber: rec.currentNumber != null ? Number(rec.currentNumber) : 0,
          isActive: rec.isActive !== false,
          issuedAt: toDate(rec.issuedAt) ?? new Date()
        }
      })
      return created.id
    }
    case 'invoices': {
      const created = await tx.invoice.create({
        data: {
          number: String(rec.number),
          documentType: rec.documentType ? String(rec.documentType) : 'FACT',
          controlNumber: rec.controlNumber != null ? String(rec.controlNumber) : null,
          fiscalControlId: remap(rec.fiscalControlId, 'fiscalControls', maps),
          customerId: remap(rec.customerId, 'customers', maps),
          userId: remap(rec.userId, 'users', maps),
          cancelReason: rec.cancelReason != null ? String(rec.cancelReason) : null,
          cancelledAt: toDate(rec.cancelledAt),
          totalUsd: Number(rec.totalUsd),
          totalVes: rec.totalVes != null ? Number(rec.totalVes) : 0,
          ivaUsd: rec.ivaUsd != null ? Number(rec.ivaUsd) : 0,
          ivaVes: rec.ivaVes != null ? Number(rec.ivaVes) : 0,
          currency: rec.currency ? String(rec.currency) : 'USD',
          exchangeRate: rec.exchangeRate != null ? Number(rec.exchangeRate) : 0,
          status: rec.status ? String(rec.status) : 'active',
          payments: paymentsToDb(rec.payments),
          importedFrom: 'backup',
          createdAt: toDate(rec.createdAt) ?? new Date(),
          items: Array.isArray(rec.items)
            ? {
                create: (rec.items as Array<Record<string, unknown>>).map((it) => ({
                  productId: remap(it.productId, 'products', maps),
                  productName: String(it.productName),
                  quantity: Number(it.quantity),
                  unitPriceUsd: Number(it.unitPriceUsd),
                  unitPriceVes: it.unitPriceVes != null ? Number(it.unitPriceVes) : 0,
                  ivaRate: it.ivaRate != null ? Number(it.ivaRate) : DEFAULT_IVA_RATE,
                  totalUsd: Number(it.totalUsd),
                  totalVes: it.totalVes != null ? Number(it.totalVes) : 0
                }))
              }
            : undefined
        }
      })
      return created.id
    }
    case 'inventoryMovements': {
      const created = await tx.inventoryMovement.create({
        data: {
          productId: remapOrRequired(rec.productId, 'products', maps),
          type: String(rec.type),
          quantity: Number(rec.quantity),
          unitCostUsd: rec.unitCostUsd != null ? Number(rec.unitCostUsd) : null,
          reference: rec.reference != null ? String(rec.reference) : null,
          notes: rec.notes != null ? String(rec.notes) : null,
          userId: remap(rec.userId, 'users', maps)
        }
      })
      return created.id
    }
    case 'exchangeRates': {
      const created = await tx.exchangeRate.create({
        data: {
          date: toDate(rec.date) ?? new Date(),
          rate: Number(rec.rate),
          source: rec.source ? String(rec.source) : 'manual'
        }
      })
      return created.id
    }
    case 'settings': {
      const created = await tx.setting.create({
        data: { key: String(rec.key), value: String(rec.value) }
      })
      return created.id
    }
  }
  return null
}

async function overwriteBackupRecord(
  tx: Tx,
  entity: EntityName,
  rec: Record<string, unknown>,
  maps: Record<string, Map<string, string>>,
  keys: ExistingKeys
): Promise<boolean> {
  switch (entity) {
    case 'company': {
      const dest = keys.companyByRif.get(String(rec.rif))
      if (dest) {
        await tx.company.update({
          where: { id: dest },
          data: {
            name: String(rec.name),
            address: rec.address != null ? String(rec.address) : null,
            phone: rec.phone != null ? String(rec.phone) : null,
            email: rec.email != null ? String(rec.email) : null
          }
        })
        return true
      }
      return false
    }
    case 'users': {
      const dest = keys.userByUsername.get(lower(String(rec.username)))
      if (dest) {
        const existing = await tx.user.findUnique({ where: { id: dest }, select: { role: true } })
        if (existing?.role === 'root') return false
        const newRole = rec.role ? String(rec.role) : 'operador'
        if (newRole === 'root') return false
        await tx.user.update({
          where: { id: dest },
          data: {
            username: String(rec.username),
            fullName: rec.fullName != null ? String(rec.fullName) : null,
            role: newRole,
            permissions: rec.permissions != null ? normalizePermissions(rec.permissions) : null,
            isActive: rec.isActive !== false
          }
        })
        return true
      }
      return false
    }
    case 'categories': {
      const dest = keys.categoryByName.get(lower(String(rec.name)))
      if (dest) {
        await tx.category.update({
          where: { id: dest },
          data: {
            name: String(rec.name),
            description: rec.description != null ? String(rec.description) : null
          }
        })
        return true
      }
      return false
    }
    case 'suppliers': {
      const dest = keys.supplierByName.get(lower(String(rec.name)))
      if (dest) {
        await tx.supplier.update({
          where: { id: dest },
          data: {
            name: String(rec.name),
            rif: rec.rif != null ? String(rec.rif) : null,
            phone: rec.phone != null ? String(rec.phone) : null,
            email: rec.email != null ? String(rec.email) : null,
            address: rec.address != null ? String(rec.address) : null
          }
        })
        return true
      }
      return false
    }
    case 'products': {
      const dest = existingId('products', rec, keys)
      if (dest) {
        await tx.product.update({
          where: { id: dest },
          data: {
            name: String(rec.name),
            code: rec.code != null ? String(rec.code) : null,
            barcode: rec.barcode != null ? String(rec.barcode) : null,
            description: rec.description != null ? String(rec.description) : null,
            priceUsd: Number(rec.priceUsd),
            costUsd: rec.costUsd != null ? Number(rec.costUsd) : null,
            ivaRate: rec.ivaRate != null ? Number(rec.ivaRate) : DEFAULT_IVA_RATE,
            stock: rec.stock != null ? Number(rec.stock) : 0,
            minStock: rec.minStock != null ? Number(rec.minStock) : 0,
            categoryId: remap(rec.categoryId, 'categories', maps),
            supplierId: remap(rec.supplierId, 'suppliers', maps),
            isActive: rec.isActive !== false
          }
        })
        return true
      }
      return false
    }
    case 'customers': {
      const dest = rec.rif ? keys.customerByRif.get(String(rec.rif)) : undefined
      if (dest) {
        await tx.customer.update({
          where: { id: dest },
          data: {
            name: String(rec.name),
            rif: rec.rif != null ? String(rec.rif) : null,
            address: rec.address != null ? String(rec.address) : null,
            phone: rec.phone != null ? String(rec.phone) : null,
            email: rec.email != null ? String(rec.email) : null,
            creditLimitUsd: rec.creditLimitUsd != null ? Number(rec.creditLimitUsd) : null
          }
        })
        return true
      }
      return false
    }
    case 'fiscalControls':
      // Nunca se sobrescriben: el currentNumber refleja uso real. Solo skip o create.
      return false
    case 'invoices': {
      const dest = keys.invoiceByNumber.get(String(rec.number))
      if (dest) {
        await tx.invoice.update({
          where: { id: dest },
          data: {
            documentType: rec.documentType ? String(rec.documentType) : 'FACT',
            controlNumber: rec.controlNumber != null ? String(rec.controlNumber) : null,
            fiscalControlId: remap(rec.fiscalControlId, 'fiscalControls', maps),
            customerId: remap(rec.customerId, 'customers', maps),
            userId: remap(rec.userId, 'users', maps),
            cancelReason: rec.cancelReason != null ? String(rec.cancelReason) : null,
            cancelledAt: toDate(rec.cancelledAt),
            totalUsd: Number(rec.totalUsd),
            totalVes: rec.totalVes != null ? Number(rec.totalVes) : 0,
            ivaUsd: rec.ivaUsd != null ? Number(rec.ivaUsd) : 0,
            ivaVes: rec.ivaVes != null ? Number(rec.ivaVes) : 0,
            currency: rec.currency ? String(rec.currency) : 'USD',
            exchangeRate: rec.exchangeRate != null ? Number(rec.exchangeRate) : 0,
            status: rec.status ? String(rec.status) : 'active',
            payments: paymentsToDb(rec.payments),
            importedFrom: 'backup',
            items: Array.isArray(rec.items)
              ? {
                  deleteMany: {},
                  create: (rec.items as Array<Record<string, unknown>>).map((it) => ({
                    productId: remap(it.productId, 'products', maps),
                    productName: String(it.productName),
                    quantity: Number(it.quantity),
                    unitPriceUsd: Number(it.unitPriceUsd),
                    unitPriceVes: it.unitPriceVes != null ? Number(it.unitPriceVes) : 0,
                    ivaRate: it.ivaRate != null ? Number(it.ivaRate) : DEFAULT_IVA_RATE,
                    totalUsd: Number(it.totalUsd),
                    totalVes: it.totalVes != null ? Number(it.totalVes) : 0
                  }))
                }
              : undefined
          }
        })
        return true
      }
      return false
    }
    case 'settings': {
      const dest = keys.settingByKey.get(String(rec.key))
      if (dest) {
        await tx.setting.update({
          where: { id: dest },
          data: { value: String(rec.value) }
        })
        return true
      }
      return false
    }
    default:
      return false
  }
}

interface BuiltCsvRecord {
  data: Record<string, unknown>
  categoryName?: string | null
  supplierName?: string | null
  isActive?: boolean
}

interface PlannedBackupOp {
  op: 'create' | 'overwrite' | 'skip'
  entity: EntityName
  rec: Record<string, unknown>
  row: number
}

interface PlannedCsvOp {
  op: 'create' | 'overwrite' | 'skip'
  built: BuiltCsvRecord
  row: number
}

interface PlanContext {
  maps: Record<string, Map<string, string>>
  seen: Map<string, number>
  seq: number
}

function findDup(
  scope: string,
  uks: string[],
  ctx: PlanContext,
  row: number,
  s: PreviewEntitySummary
): boolean {
  for (const k of uks) {
    const seenKey = `${scope}:${k}`
    const firstRow = ctx.seen.get(seenKey)
    if (firstRow !== undefined) {
      s.errors.push({
        row,
        message: `"${k.slice(k.indexOf(':') + 1)}" está duplicado en el archivo (fila ${firstRow})`
      })
      return true
    }
  }
  for (const k of uks) ctx.seen.set(`${scope}:${k}`, row)
  return false
}

function planBackupRecords(
  data: Record<string, unknown[]>,
  strategy: ImportStrategy,
  keys: ExistingKeys,
  ctx: PlanContext,
  summary: PreviewEntitySummary[],
  ops: PlannedBackupOp[]
): void {
  for (const name of BACKUP_ORDER) {
    const records = data[name]
    if (!Array.isArray(records) || records.length === 0) continue
    const s: PreviewEntitySummary = {
      entity: name,
      total: records.length,
      toCreate: 0,
      toSkip: 0,
      toOverwrite: 0,
      errors: []
    }
    for (let i = 0; i < records.length; i++) {
      const row = i + 1
      const raw = records[i]
      if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
        s.errors.push({ row, message: 'Registro inválido' })
        continue
      }
      const rec = raw as Record<string, unknown>
      const err = validateBackupRecord(name, rec)
      if (err) {
        s.errors.push({ row, message: err })
        continue
      }

      let op: 'create' | 'overwrite' | 'skip'
      if (name === 'users' && String(rec.role ?? '') === 'root') {
        op = 'skip'
        registerSkipMapping(name, rec, ctx.maps, keys)
      } else {
        const conflict = classifyBackupRecord(name, rec, keys)
        if (conflict === 'conflict') {
          if (strategy === 'overwrite' && wouldOverwriteBackup(name, rec, keys)) {
            op = 'overwrite'
          } else {
            op = 'skip'
          }
          registerConflictMapping(name, rec, ctx.maps, keys)
        } else {
          if (findDup(name, backupUniqueKeys(name, rec), ctx, row, s)) continue
          op = 'create'
          if (rec.id != null && ctx.maps[name]) {
            ctx.maps[name].set(String(rec.id), `__new_${ctx.seq++}__`)
          }
        }
      }

      if (op !== 'skip') {
        const refErr = validateBackupRefs(name, rec, ctx.maps)
        if (refErr) {
          if (op === 'create' && rec.id != null) ctx.maps[name]?.delete(String(rec.id))
          s.errors.push({ row, message: refErr })
          continue
        }
      }

      if (op === 'create') s.toCreate++
      else if (op === 'overwrite') s.toOverwrite++
      else s.toSkip++
      ops.push({ op, entity: name, rec, row })
    }
    summary.push(s)
  }
}

function buildCsvRecord(entity: CsvEntity, row: Record<string, string>): BuiltCsvRecord {
  switch (entity) {
    case 'categories':
      return { data: { name: row.name, description: toNullable(row.description) } }
    case 'suppliers':
      return {
        data: {
          name: row.name,
          rif: toNullable(row.rif),
          phone: toNullable(row.phone),
          email: toNullable(row.email),
          address: toNullable(row.address)
        }
      }
    case 'products':
      return {
        data: {
          name: row.name,
          code: toNullable(row.code),
          barcode: toNullable(row.barcode),
          description: toNullable(row.description),
          priceUsd: toNum(row.priceUsd),
          costUsd: toNullableNum(row.costUsd),
          ivaRate: (row.ivaRate ?? '').trim() ? toNum(row.ivaRate) : DEFAULT_IVA_RATE,
          stock: (row.stock ?? '').trim() ? toNum(row.stock) : 0,
          minStock: (row.minStock ?? '').trim() ? toNum(row.minStock) : 0
        },
        categoryName: (row.category ?? '').trim() || null,
        supplierName: (row.supplier ?? '').trim() || null,
        isActive: toBool(row.isActive, true)
      }
    case 'customers':
      return {
        data: {
          name: row.name,
          rif: toNullable(row.rif),
          address: toNullable(row.address),
          phone: toNullable(row.phone),
          email: toNullable(row.email),
          creditLimitUsd: toNullableNum(row.creditLimitUsd)
        }
      }
    case 'exchange-rates':
      return {
        data: {
          date: (row.date ?? '').trim() || undefined,
          rate: toNum(row.rate),
          source: (row.source ?? '').trim() || 'manual'
        }
      }
  }
}

function validateCsv(entity: CsvEntity, built: BuiltCsvRecord): string | null {
  const data = built.data
  switch (entity) {
    case 'categories': {
      const r = createCategorySchema.safeParse(data)
      return r.success ? null : r.error.issues[0].message
    }
    case 'suppliers': {
      const r = createSupplierSchema.safeParse(data)
      return r.success ? null : r.error.issues[0].message
    }
    case 'products': {
      const r = createProductSchema.safeParse(data)
      return r.success ? null : r.error.issues[0].message
    }
    case 'customers': {
      const r = createCustomerSchema.safeParse(data)
      return r.success ? null : r.error.issues[0].message
    }
    case 'exchange-rates': {
      const r = createExchangeRateSchema.safeParse(data)
      return r.success ? null : r.error.issues[0].message
    }
  }
}

function classifyCsvRecord(entity: CsvEntity, built: BuiltCsvRecord, keys: ExistingKeys): boolean {
  const data = built.data
  switch (entity) {
    case 'categories':
      return keys.categoryByName.has(lower(String(data.name ?? '')))
    case 'suppliers':
      return keys.supplierByName.has(lower(String(data.name ?? '')))
    case 'products': {
      const code = data.code ? String(data.code) : null
      const barcode = data.barcode ? String(data.barcode) : null
      return !!(
        (code && keys.productByCode.has(code)) ||
        (barcode && keys.productByBarcode.has(barcode))
      )
    }
    case 'customers':
      return !!data.rif && keys.customerByRif.has(String(data.rif))
    case 'exchange-rates':
      return false
  }
}

function planCsvRecords(
  rows: Array<Record<string, string>>,
  entity: CsvEntity,
  strategy: ImportStrategy,
  keys: ExistingKeys,
  ctx: PlanContext,
  summary: PreviewEntitySummary[]
): PlannedCsvOp[] {
  const ops: PlannedCsvOp[] = []
  const s: PreviewEntitySummary = {
    entity,
    total: rows.length,
    toCreate: 0,
    toSkip: 0,
    toOverwrite: 0,
    errors: []
  }
  for (let i = 0; i < rows.length; i++) {
    const row = i + 2
    const built = buildCsvRecord(entity, rows[i])
    const err = validateCsv(entity, built)
    if (err) {
      s.errors.push({ row, message: err })
      continue
    }
    if (classifyCsvRecord(entity, built, keys)) {
      if (strategy === 'overwrite') {
        s.toOverwrite++
        ops.push({ op: 'overwrite', built, row })
      } else {
        s.toSkip++
        ops.push({ op: 'skip', built, row })
      }
      continue
    }
    if (findDup(`csv:${entity}`, csvUniqueKeys(entity, built), ctx, row, s)) continue
    if (entity === 'products') {
      if (built.categoryName && !keys.categoryByName.has(lower(built.categoryName))) {
        s.errors.push({
          row,
          message: `La categoría "${built.categoryName}" no existe en el sistema`
        })
        continue
      }
      if (built.supplierName && !keys.supplierByName.has(lower(built.supplierName))) {
        s.errors.push({
          row,
          message: `El proveedor "${built.supplierName}" no existe en el sistema`
        })
        continue
      }
    }
    s.toCreate++
    ops.push({ op: 'create', built, row })
  }
  summary.push(s)
  return ops
}

async function createCsvRecord(
  tx: Tx,
  entity: CsvEntity,
  built: BuiltCsvRecord,
  keys: ExistingKeys
): Promise<void> {
  const data = built.data
  switch (entity) {
    case 'categories':
      await tx.category.create({
        data: { name: String(data.name), description: (data.description as string | null) ?? null }
      })
      break
    case 'suppliers':
      await tx.supplier.create({
        data: {
          name: String(data.name),
          rif: (data.rif as string | null) ?? null,
          phone: (data.phone as string | null) ?? null,
          email: (data.email as string | null) ?? null,
          address: (data.address as string | null) ?? null
        }
      })
      break
    case 'products': {
      const categoryId = built.categoryName
        ? (keys.categoryByName.get(lower(built.categoryName)) ?? null)
        : null
      const supplierId = built.supplierName
        ? (keys.supplierByName.get(lower(built.supplierName)) ?? null)
        : null
      await tx.product.create({
        data: {
          name: String(data.name),
          code: (data.code as string | null) ?? null,
          barcode: (data.barcode as string | null) ?? null,
          description: (data.description as string | null) ?? null,
          priceUsd: Number(data.priceUsd),
          costUsd: data.costUsd != null ? Number(data.costUsd) : null,
          ivaRate: Number(data.ivaRate ?? DEFAULT_IVA_RATE),
          stock: Number(data.stock ?? 0),
          minStock: Number(data.minStock ?? 0),
          categoryId,
          supplierId,
          isActive: built.isActive !== false
        }
      })
      break
    }
    case 'customers':
      await tx.customer.create({
        data: {
          name: String(data.name),
          rif: (data.rif as string | null) ?? null,
          address: (data.address as string | null) ?? null,
          phone: (data.phone as string | null) ?? null,
          email: (data.email as string | null) ?? null,
          creditLimitUsd: data.creditLimitUsd != null ? Number(data.creditLimitUsd) : null
        }
      })
      break
    case 'exchange-rates':
      await tx.exchangeRate.create({
        data: {
          date: toDate(data.date) ?? new Date(),
          rate: Number(data.rate),
          source: String(data.source ?? 'manual')
        }
      })
      break
  }
}

async function overwriteCsvRecord(
  tx: Tx,
  entity: CsvEntity,
  built: BuiltCsvRecord,
  keys: ExistingKeys
): Promise<boolean> {
  const data = built.data
  switch (entity) {
    case 'categories': {
      const dest = keys.categoryByName.get(lower(String(data.name)))
      if (dest) {
        await tx.category.update({
          where: { id: dest },
          data: {
            name: String(data.name),
            description: (data.description as string | null) ?? null
          }
        })
        return true
      }
      return false
    }
    case 'suppliers': {
      const dest = keys.supplierByName.get(lower(String(data.name)))
      if (dest) {
        await tx.supplier.update({
          where: { id: dest },
          data: {
            name: String(data.name),
            rif: (data.rif as string | null) ?? null,
            phone: (data.phone as string | null) ?? null,
            email: (data.email as string | null) ?? null,
            address: (data.address as string | null) ?? null
          }
        })
        return true
      }
      return false
    }
    case 'products': {
      let dest: string | undefined
      if (data.code && keys.productByCode.has(String(data.code))) {
        dest = keys.productByCode.get(String(data.code))
      } else if (data.barcode && keys.productByBarcode.has(String(data.barcode))) {
        dest = keys.productByBarcode.get(String(data.barcode))
      }
      if (dest) {
        const categoryId = built.categoryName
          ? (keys.categoryByName.get(lower(built.categoryName)) ?? null)
          : null
        const supplierId = built.supplierName
          ? (keys.supplierByName.get(lower(built.supplierName)) ?? null)
          : null
        await tx.product.update({
          where: { id: dest },
          data: {
            name: String(data.name),
            code: (data.code as string | null) ?? null,
            barcode: (data.barcode as string | null) ?? null,
            description: (data.description as string | null) ?? null,
            priceUsd: Number(data.priceUsd),
            costUsd: data.costUsd != null ? Number(data.costUsd) : null,
            ivaRate: Number(data.ivaRate ?? DEFAULT_IVA_RATE),
            stock: Number(data.stock ?? 0),
            minStock: Number(data.minStock ?? 0),
            categoryId,
            supplierId,
            isActive: built.isActive !== false
          }
        })
        return true
      }
      return false
    }
    case 'customers': {
      const dest = data.rif ? keys.customerByRif.get(String(data.rif)) : undefined
      if (dest) {
        await tx.customer.update({
          where: { id: dest },
          data: {
            name: String(data.name),
            rif: (data.rif as string | null) ?? null,
            address: (data.address as string | null) ?? null,
            phone: (data.phone as string | null) ?? null,
            email: (data.email as string | null) ?? null,
            creditLimitUsd: data.creditLimitUsd != null ? Number(data.creditLimitUsd) : null
          }
        })
        return true
      }
      return false
    }
    case 'exchange-rates':
      return false
  }
}

async function executeBackupOps(
  tx: Tx,
  ops: PlannedBackupOp[],
  keys: ExistingKeys,
  maps: Record<string, Map<string, string>>,
  results: ImportEntityResult[]
): Promise<void> {
  const byEntity = new Map(results.map((r) => [r.entity, r]))
  for (const planned of ops) {
    const r = byEntity.get(planned.entity)
    if (!r) continue
    if (planned.op === 'create') {
      const newId = await createBackupRecord(tx, planned.entity, planned.rec, maps)
      if (newId && planned.rec.id != null && maps[planned.entity]) {
        maps[planned.entity].set(String(planned.rec.id), newId)
      }
      r.imported++
    } else if (planned.op === 'overwrite') {
      const ok = await overwriteBackupRecord(tx, planned.entity, planned.rec, maps, keys)
      if (ok) r.overwritten++
      else r.skipped++
    } else {
      r.skipped++
    }
  }
}

async function executeCsvOps(
  tx: Tx,
  ops: PlannedCsvOp[],
  entity: CsvEntity,
  keys: ExistingKeys,
  results: ImportEntityResult[]
): Promise<void> {
  const r = results[0]
  if (!r) return
  for (const planned of ops) {
    if (planned.op === 'create') {
      await createCsvRecord(tx, entity, planned.built, keys)
      r.imported++
    } else if (planned.op === 'overwrite') {
      const ok = await overwriteCsvRecord(tx, entity, planned.built, keys)
      if (ok) r.overwritten++
      else r.skipped++
    } else {
      r.skipped++
    }
  }
}

interface NormalizedPayload {
  kind: 'backup' | 'csv'
  entity?: string
  data?: Record<string, unknown[]>
  csvText?: string
}

function normalizePayload(payload: unknown): NormalizedPayload {
  const p = payload as Record<string, unknown>
  if (!p || typeof p !== 'object' || !p.format) {
    throw new AppError(400, 'Formato de archivo no reconocido')
  }
  if (p.format === BACKUP_FORMAT) {
    const version = Number(p.version ?? 1)
    if (version > BACKUP_VERSION) {
      throw new AppError(400, `Versión de respaldo no soportada: ${version}`)
    }
    const data = p.data
    if (!data || typeof data !== 'object') {
      throw new AppError(400, 'Respaldo inválido: falta data')
    }
    return { kind: 'backup', data: data as Record<string, unknown[]> }
  }
  if (p.format === 'csv') {
    const entity = String(p.entity || '')
    if (!(CSV_ENTITIES as readonly string[]).includes(entity)) {
      throw new AppError(400, 'Entidad CSV inválida')
    }
    const csvText = String(p.csvText ?? '')
    if (!csvText.trim()) throw new AppError(400, 'CSV vacío')
    return { kind: 'csv', entity, csvText }
  }
  throw new AppError(400, 'Formato de archivo no reconocido')
}

interface ImportPlan {
  kind: 'backup' | 'csv'
  entity?: string
  backupOps: PlannedBackupOp[]
  csvOps: PlannedCsvOp[]
  summary: PreviewEntitySummary[]
  totalErrors: number
}

async function buildImportPlan(
  parsed: NormalizedPayload,
  strategy: ImportStrategy
): Promise<ImportPlan> {
  const keys = await loadExistingKeys()
  const ctx: PlanContext = { maps: initMaps(), seen: new Map(), seq: 0 }
  const summary: PreviewEntitySummary[] = []
  const backupOps: PlannedBackupOp[] = []
  let csvOps: PlannedCsvOp[] = []
  if (parsed.kind === 'backup') {
    planBackupRecords(parsed.data ?? {}, strategy, keys, ctx, summary, backupOps)
  } else {
    csvOps = planCsvRecords(
      csvParse(parsed.csvText ?? ''),
      parsed.entity as CsvEntity,
      strategy,
      keys,
      ctx,
      summary
    )
  }
  const totalErrors = summary.reduce((acc, s) => acc + s.errors.length, 0)
  return {
    kind: parsed.kind,
    entity: parsed.kind === 'csv' ? parsed.entity : undefined,
    backupOps,
    csvOps,
    summary,
    totalErrors
  }
}

export async function previewImport(
  payload: unknown,
  strategy?: ImportStrategy
): Promise<MigrationPreview> {
  const parsed = normalizePayload(payload)
  const plan = await buildImportPlan(parsed, strategy ?? 'skip')
  return {
    format: plan.kind,
    entity: plan.entity,
    summary: plan.summary,
    totalRecords: plan.summary.reduce((acc, s) => acc + s.total, 0)
  }
}

async function logFailure(
  parsed: NormalizedPayload,
  strategy: ImportStrategy,
  userId: string | null,
  fileName: string | undefined,
  errorCount: number,
  details: MigrationEntityErrors[]
): Promise<void> {
  try {
    await prisma.migrationLog.create({
      data: {
        kind: parsed.kind,
        entity: parsed.kind === 'csv' ? (parsed.entity as string) : null,
        strategy,
        imported: 0,
        skipped: 0,
        errors: errorCount,
        errorDetail: JSON.stringify(details),
        fileName: fileName ?? null,
        createdBy: userId
      }
    })
  } catch (logErr) {
    logger.error('migration', 'Failed to persist migration failure log', logErr)
  }
}

export async function applyImport(
  payload: unknown,
  strategy: ImportStrategy,
  userId: string | null,
  fileName?: string
): Promise<MigrationImportResult> {
  if (!['skip', 'overwrite'].includes(strategy)) {
    throw new AppError(400, 'Estrategia inválida')
  }
  const parsed = normalizePayload(payload)
  const started = Date.now()
  const plan = await buildImportPlan(parsed, strategy)

  if (plan.totalErrors > 0) {
    const details: MigrationEntityErrors[] = plan.summary
      .filter((s) => s.errors.length > 0)
      .map((s) => ({ entity: s.entity, errors: s.errors }))
    await logFailure(parsed, strategy, userId, fileName, plan.totalErrors, details)
    throw new AppError(
      400,
      `Importación rechazada: ${plan.totalErrors} registro(s) con errores. No se importó nada.`,
      details
    )
  }

  const keys = await loadExistingKeys()
  const maps = initMaps()
  const results: ImportEntityResult[] = plan.summary.map((s) => ({
    entity: s.entity,
    imported: 0,
    skipped: 0,
    overwritten: 0,
    errors: []
  }))

  try {
    await prisma.$transaction(
      async (tx) => {
        if (plan.kind === 'backup') {
          await executeBackupOps(tx, plan.backupOps, keys, maps, results)
        } else {
          await executeCsvOps(tx, plan.csvOps, parsed.entity as CsvEntity, keys, results)
        }
      },
      { timeout: 120000 }
    )
  } catch (e) {
    logger.error('migration', 'Import transaction failed', e)
    await logFailure(parsed, strategy, userId, fileName, 1, [
      { entity: '_transaction', errors: [{ row: 0, message: msg(e) }] }
    ])
    throw new AppError(500, `La importación falló y fue revertida: ${msg(e)}`)
  }

  await prisma.migrationLog.create({
    data: {
      kind: plan.kind,
      entity: plan.kind === 'csv' ? (parsed.entity as string) : null,
      strategy,
      imported: results.reduce((acc, r) => acc + r.imported, 0),
      skipped: results.reduce((acc, r) => acc + r.skipped, 0),
      errors: 0,
      errorDetail: null,
      fileName: fileName ?? null,
      createdBy: userId
    }
  })

  return {
    format: plan.kind,
    entity: plan.entity,
    strategy,
    summary: results,
    durationMs: Date.now() - started
  }
}
