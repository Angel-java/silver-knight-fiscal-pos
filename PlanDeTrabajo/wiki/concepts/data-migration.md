---
type: concept
tags: [migration, backup, export, import, admin, root]
created: 2026-08-16
updated: 2026-08-21
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

## Flujo de importación (todo-o-nada, desde v1.1.23)

1. `POST /preview` (dry-run): ejecuta el **mismo planificador** que el import (`buildImportPlan`) contra la BD real y reporta, por entidad/fila: validación de schema, **duplicados intra-archivo** y **referencias rotas**, sin escribir nada.
2. El usuario elige estrategia para los conflictos: `skip` (omitir) u `overwrite` (sobrescribir solo si es seguro).
3. `POST /import`: re-planifica contra estado fresco de la BD. Si hay **cualquier error → rechazo total** (`400` con `details: [{ entity, errors: [{ row, message }] }]`), no se ejecuta la transacción y se registra el intento fallido en `MigrationLog`. Si el pre-vuelo pasa, se ejecutan las operaciones planeadas dentro de una transacción **sin tragar errores**: cualquier fallo de BD revierte todo (`500 "La importación falló y fue revertida"`) y también queda registrado en el log.

> **Histórico (pre-v1.1.23)**: el importador viejo validaba/escribía registro por registro dentro de una sola transacción gigante, tragando errores por fila. Un primer statement fallido abortaba la tx en Postgres (cascada `25P02`), el rollback al commit era silencioso (Prisma no lanza al commitear tx abortada) y el código continuaba escribiendo un `MigrationLog` con conteos falsos (ej. `imported=379` con 0 filas persistidas). Además la imagen Docker desplegada era anterior a `bb4749d`: exigía `pin` en usuarios (que el exportador omite) y no detectaba conflictos de `settings`. Ver [[log#2026-08-21]].

## Reglas de importación

- Las FKs se remapean por prefijo numérico: `categoryId → category-N`, `supplierId → supplier-N`, `productId → product-N`, etc.
- **FiscalControls nunca se sobrescriben** (integridad fiscal/contable).
- El **user root nunca se pisa**: los usuarios `role=root` del archivo se omiten; si otro registro los referenciaba (`userId`), la referencia se mapea a `null` (no es error).
- `overwrite` devuelve `boolean`: si la regla impide sobrescribir, el registro se cuenta como `skip`.
- Las **facturas importadas son históricas**: `importedFrom = 'backup'` y **no avanzan** `FiscalControl.currentNumber` del destino.
- **Duplicados intra-archivo = error** (rechazo total): claves naturales repetidas dentro del mismo archivo (username, nombre de categoría/proveedor, code/barcode de producto, RIF de cliente, número de factura, key de setting, tipo+prefijo fiscal).
- **Referencias rotas = error** (rechazo total): toda FK no nula debe resolverse contra la BD destino o contra un registro incluido en el propio archivo (validado en orden `BACKUP_ORDER`).
- CSV de productos: la columna `category`/`supplier` debe existir en la BD destino (un CSV de una sola entidad no crea categorías/proveedores).

## Exportación

- `GET /export?format=json&scope=...` → descarga JSON (`silverknight-backup` v1)
- `GET /export?format=csv&entity=...` → descarga CSV de la entidad
- `sendFile` con `Content-Disposition` (attachment + filename)
- `appVersion` usa `process.env.npm_package_version` (undefined en tests → no afectan)

## Registro

Modelo Prisma `MigrationLog`: `kind`, `entity?`, `strategy`, `imported`, `skipped`, `errors`, `errorDetail?`, `fileName?`, `createdBy?`, `createdAt` (index). Consultable vía `GET /logs` (root+admin, 100 más recientes por `createdAt desc`). Desde v1.1.23 los **intentos fallidos también se registran** (`imported=0`, `errors=N`, `errorDetail` JSON con el detalle por entidad/fila; fallos de transacción usan entidad `_transaction`).

## UI (DataMigrationPage)

- Si el preview tiene errores, el botón **Confirmar importación se bloquea** con aviso.
- Si el import es rechazado (400), se muestra la lista completa de errores por entidad/fila.
- El Historial permite expandir cada fila para ver `errorDetail` parseado.

## Archivos clave

- `src/server/migration/csv.ts` — parser/serializer CSV (escaping, BOM, CRLF, quoted fields)
- `src/server/migration/formats.ts` — constantes (`CSV_ENTITIES`, `EXPORT_SCOPES`, `SCOPE_LABELS`, `STRATEGY_LABELS`, `MAX_IMPORT_BYTES`)
- `src/server/migration/exporter.ts` — `exportCsv`, `exportBackup`, `getTemplateCsv`; `SCOPE_GROUPS: Record<ExportScope, string[]>`
- `src/server/migration/importer.ts` — `previewImport`, `applyImport`, `buildImportPlan` (planificador compartido), `loadExistingKeys`, `BACKUP_ORDER`, ejecución transaccional sin swallow, `MigrationLog` de éxitos y fallos
- `src/server/routes/migration.ts` — router (`/scopes`, `/export`, `/templates`, `/preview`, `/import`, `/logs`)
- `src/renderer/src/lib/api.ts` — `ApiError.details`, `migrationErrorDetails()`, tipos `MigrationEntityErrors`
- `src/renderer/src/pages/DataMigrationPage.tsx` — UI (Exportar / Importar / Historial con detalle expandible)
- `prisma/schema.prisma` — `Invoice.importedFrom` + modelo `MigrationLog`

## Operación

- La imagen Docker del server corre código embebido: tras cambiar código server hay que `docker compose build server && docker compose up -d` (en máquinas desplegadas lo hace `ensureServerImage` vía sentinel `.server-version`).
- Healthcheck del contenedor usa `127.0.0.1` (no `localhost`, que resuelve a `::1` IPv6 donde Node no escucha → contenedor `unhealthy` pese a servir bien).

## Relación con otros conceptos

- Se apoya en [[fiscal-compliance]]: las facturas históricas y los `FiscalControl` tienen reglas especiales de integridad fiscal.
- Interactúa con [[dual-currency]]: las facturas importadas conservan `exchangeRate` congelado; el catálogo importado es solo USD.
