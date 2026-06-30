---
type: entity
tags: [invoice, item, line, product]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# InvoiceItem

Línea individual de una factura. Fuente: [[db-schema]].

Un **[[invoice-item|InvoiceItem]]** representa un renglón dentro de una [[invoice|factura]]. Contiene el [[product|producto]] vendido (con datos denormalizados), la cantidad, los precios en [[dual-currency|ambas monedas]] y el IVA aplicado.

## Atributos clave

| Campo | Tipo | Descripción |
|-------|------|-------------|
| quantity | decimal | Cantidad |
| priceUsd/PriceVes | decimal | Precio unitario en ambas monedas |
| subtotalUsd/SubtotalVes | decimal | Subtotal del renglón |
| ivaUsd/IvaVes | decimal | IVA del renglón |

## Relaciones con otras entidades

- Un **InvoiceItem** pertenece a una **[[invoice|Invoice]]**
- Un **InvoiceItem** referencia un **[[product|Product]]** (con datos denormalizados)
- Un **InvoiceItem** maneja montos en **[[dual-currency|ambas monedas]]**
