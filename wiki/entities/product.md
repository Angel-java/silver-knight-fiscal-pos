---
type: entity
tags: [product, inventory, stock, iva]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# Product

Producto o servicio del inventario.

## Atributos clave

| Campo | Tipo | Descripción |
|-------|------|-------------|
| code | string | Código interno del producto |
| barcode | string | Código de barras |
| name | string | Nombre del producto |
| priceUsd/PriceVes | decimal | Precio de venta en ambas monedas |
| costUsd/CostVes | decimal | Costo en ambas monedas |
| stock | decimal | Cantidad en inventario |
| minStock | decimal | Stock mínimo |
| ivaPercent | decimal | Porcentaje de IVA |

## Relaciones

- [[product]] -> [[category]]: N:1 (pertenece a una categoría)
- [[product]] -> [[invoice-item]]: 1:N (aparece en múltiples facturas)
- [[product]] <-> [[dual-currency]]: precios y costos en USD/VES
- [[product]] <-> [[fiscal-compliance]]: IVA configurable por producto
