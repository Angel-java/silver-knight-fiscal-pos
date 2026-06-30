---
type: entity
tags: [invoice, item, line, product]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# InvoiceItem

Línea individual de una factura.

## Atributos clave

| Campo | Tipo | Descripción |
|-------|------|-------------|
| quantity | decimal | Cantidad |
| priceUsd/PriceVes | decimal | Precio unitario en ambas monedas |
| subtotalUsd/SubtotalVes | decimal | Subtotal del renglón |
| ivaUsd/IvaVes | decimal | IVA del renglón |

## Relaciones

- [[invoice-item]] -> [[invoice]]: N:1 (pertenece a una factura)
- [[invoice-item]] -> [[product]]: N:1 (producto facturado, con datos denormalizados)
