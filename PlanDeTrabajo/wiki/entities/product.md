---
type: entity
tags: [product, inventory, stock, iva]
created: 2026-06-30
updated: 2026-08-04
sources: [db-schema]
---

# Product

Producto o servicio del inventario. Fuente: [[db-schema]].

Un **[[product|Product]]** es la unidad básica del inventario. Guarda precios y costos **solo en USD**; el equivalente en VES se calcula en vivo con la tasa vigente ([[dual-currency]]). Tiene un porcentaje de IVA configurable ([[fiscal-compliance]]) y control de stock mínimo.

## Atributos clave

| Campo | Tipo | Descripción |
|-------|------|-------------|
| code | string | Código interno del producto |
| barcode | string | Código de barras |
| name | string | Nombre del producto |
| priceUsd | decimal | Precio de venta en USD (única moneda persistida) |
| costUsd | decimal? | Costo en USD |
| stock | decimal | Cantidad en inventario |
| minStock | decimal | Stock mínimo |
| ivaPercent | decimal | Porcentaje de IVA |

> **Histórico**: `priceVes`/`costVes` (2026-08-04) fueron eliminados del modelo. El equivalente VES se muestra como referencia en vivo (`precio USD × tasa vigente`) en ProductFormPage y ProductsPage, y el servidor lo congela en la factura al facturar.

## Relaciones con otras entidades

- Un **Product** pertenece a una **[[category|Category]]**
- Un **Product** aparece en múltiples **[[invoice-item|InvoiceItems]]** (líneas de factura)
- Un **Product** tiene un historial de **[[inventory-movement|InventoryMovements]]** (audit trail de stock)
- Un **Product** es **[[dual-currency|dolarizado]]**: solo USD en catálogo, VES derivado de la tasa al facturar
- Un **Product** tiene IVA configurable para **[[fiscal-compliance|cumplimiento fiscal]]**
