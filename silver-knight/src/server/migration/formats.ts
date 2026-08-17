export const BACKUP_FORMAT = 'silverknight-backup'
export const BACKUP_VERSION = 1

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024

export type ImportStrategy = 'skip' | 'overwrite'

export const CSV_ENTITIES = [
  'categories',
  'suppliers',
  'products',
  'customers',
  'exchange-rates'
] as const

export type CsvEntity = (typeof CSV_ENTITIES)[number]

export const EXPORT_SCOPES = [
  'all',
  'catalog',
  'customers',
  'invoices',
  'inventory',
  'exchange-rates',
  'config'
] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

export const SCOPE_LABELS: Record<ExportScope, string> = {
  all: 'Todo el sistema',
  catalog: 'Catálogo (categorías, proveedores, productos)',
  customers: 'Clientes',
  invoices: 'Facturación (talonarios y facturas)',
  inventory: 'Movimientos de inventario',
  'exchange-rates': 'Tasas de cambio',
  config: 'Configuración (empresa, usuarios, ajustes)'
}

export const STRATEGY_LABELS: Record<ImportStrategy, string> = {
  skip: 'Omitir duplicados',
  overwrite: 'Sobrescribir existentes'
}
