---
type: entity
tags: [product, inventory, stock, iva]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# Product

Producto o servicio del inventario. Fuente: [[db-schema]].

Un **[[product|Product]]** es la unidad básica del inventario. Tiene precios en ambas monedas ([[dual-currency]]), un porcentaje de IVA configurable ([[fiscal-compliance]]), y control de stock mínimo.

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

## Relaciones con otras entidades

- Un **Product** pertenece a una **[[category|Category]]**
- Un **Product** aparece en múltiples **[[invoice-item|InvoiceItems]]** (líneas de factura)
- Un **Product** tiene un historial de **[[inventory-movement|InventoryMovements]]** (audit trail de stock)
- Un **Product** tiene precios en **[[dual-currency|ambas monedas]]**
- Un **Product** tiene IVA configurable para **[[fiscal-compliance|cumplimiento fiscal]]**
