---
type: entity
tags: [inventory, movement, entry, exit, stock, audit]
created: 2026-07-07
updated: 2026-07-07
sources: [db-schema]
---

# InventoryMovement

Registro de movimiento de inventario. Fuente: [[db-schema]].

Un **InventoryMovement** representa cualquier cambio en el stock de un [[product|Product]]: entradas manuales, salidas por ajuste, ventas desde el POS, o anulaciones de factura. Provee un audit trail completo del inventario.

## Atributos clave

| Campo | Tipo | Descripción |
|-------|------|-------------|
| type | string | `entry` \| `exit` \| `sale` \| `cancellation` |
| quantity | decimal | Cantidad movida (positiva) |
| unitCostUsd | decimal? | Costo unitario en USD al momento de la entrada |
| unitCostVes | decimal? | Costo unitario en VES al momento de la entrada |
| reference | string? | Documento de referencia (factura #, orden, etc.) |
| notes | string? | Notas opcionales |
| userId | string? | Usuario que realizó el movimiento |

## Relaciones

- Un **InventoryMovement** pertenece a un **[[product|Product]]**

## Origen de los movimientos

| Tipo | Origen | Descripción |
|------|--------|-------------|
| `entry` | Manual ([[product\|Productos]]) o API | Entrada de stock por compra/ajuste |
| `exit` | Manual ([[product\|Productos]]) o API | Salida de stock por ajuste |
| `sale` | [[invoice\|Invoice]] | Descuento automático al crear factura |
| `cancellation` | [[invoice\|Invoice]] | Restitución automática al anular factura |
