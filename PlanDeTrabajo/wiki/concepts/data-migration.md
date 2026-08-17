---
type: concept
tags: [migration, backup, export, import, admin, root]
created: 2026-08-16
updated: 2026-08-16
sources: [plan-vision]
---

# Data Migration

Módulo de migración de datos (export/import) para trasladar datos dentro del mismo sistema y hacia sistemas diferentes. Rutas bajo `/api/migration`.

## Formatos

- **CSV** (`entity`): catálogo y maestros — `categories`, `customers`, `products`, `suppliers`, `inventory-movements`, `exchange-rates`. Con BOM UTF-8 y CRLF (compatible con Excel/hojas de cálculo). Cada entidad tiene su plantilla `GET /templates?entity=...` (solo headers).
- **JSON** (`scope`): respaldo completo/facturas — formato `silverknight-backup` v1 con envelope `{ app: 'silverknight-backup', formatVersion: 1, appVersion, exportedAt, scopes: { ... } }`. Scopes: `all`, `catalog`, `customers`, `invoices`, `inventory`, `exchange-rates`, `config`.

## Permisos

- **Export**: root + admin (`rootOrAdminMiddleware`)
- **Import / preview**: **solo root** (`rootMiddleware`) — operación destructiva
- Rate limit en import: `windowMs 1h, max 10` (express-rate-limit); body limit `MAX_IMPORT_BYTES = 25 MB`

## Flujo de importación

1. `POST /preview` (dry-run): clasifica cada registro como `new` | `conflict` | `skip` y reporta errores de validación por fila, **sin escribir nada**.
2. El usuario elige estrategia para los conflictos: `skip` (omitir), `overwrite` (sobrescribir solo si es seguro) o `create-new` (crear como registro nuevo).
3. `POST /import`: transacción con rollback total si algo falla; solo se confirma si todo pasa. Al final registra un `MigrationLog`.

## Reglas de importación

- Las FKs se remapean por prefijo numérico: `categoryId → category-N`, `supplierId → supplier-N`, `productId → product-N`, etc.
- **FiscalControls nunca se sobrescriben** (integridad fiscal/contable).
- El **user root nunca se pisa**.
- `overwrite` devuelve `boolean`: si la regla impide sobrescribir, el registro se cuenta como `skip`.
- Las **facturas importadas son históricas**: `importedFrom = 'backup'` y **no avanzan** `FiscalControl.currentNumber` del destino.

## Exportación

- `GET /export?format=json&scope=...` → descarga JSON (`silverknight-backup` v1)
- `GET /export?format=csv&entity=...` → descarga CSV de la entidad
- `sendFile` con `Content-Disposition` (attachment + filename)
- `appVersion` usa `process.env.npm_package_version` (undefined en tests → no afectan)

## Registro

Modelo Prisma `MigrationLog`: `kind`, `entity?`, `strategy`, `imported`, `skipped`, `errors`, `errorDetail?`, `fileName?`, `createdBy?`, `createdAt` (index). Consultable vía `GET /logs` (root+admin, 100 más recientes por `createdAt desc`).

## Archivos clave

- `src/server/migration/csv.ts` — parser/serializer CSV (escaping, BOM, CRLF, quoted fields)
- `src/server/migration/formats.ts` — constantes (`CSV_ENTITIES`, `EXPORT_SCOPES`, `SCOPE_LABELS`, `STRATEGY_LABELS`, `MAX_IMPORT_BYTES`)
- `src/server/migration/exporter.ts` — `exportCsv`, `exportBackup`, `getTemplateCsv`; `SCOPE_GROUPS: Record<ExportScope, string[]>`
- `src/server/migration/importer.ts` — `previewImport`, `applyImport`, `loadExistingKeys`, `BACKUP_ORDER`, transacción + rollback, `MigrationLog`
- `src/server/routes/migration.ts` — router (`/scopes`, `/export`, `/templates`, `/preview`, `/import`, `/logs`)
- `src/renderer/src/pages/DataMigrationPage.tsx` — UI (Exportar / Importar / Historial)
- `prisma/schema.prisma` — `Invoice.importedFrom` + modelo `MigrationLog`

## Relación con otros conceptos

- Se apoya en [[fiscal-compliance]]: las facturas históricas y los `FiscalControl` tienen reglas especiales de integridad fiscal.
- Interactúa con [[dual-currency]]: las facturas importadas conservan `exchangeRate` congelado; el catálogo importado es solo USD.
