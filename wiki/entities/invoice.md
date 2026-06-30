---
type: entity
tags: [invoice, fiscal, pos, transaction]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema, fiscal-compliance]
---

# Invoice

Factura emitida por el sistema. Toda factura es fiscalmente válida ([[fiscal-compliance|ADR-005]]).

## Atributos clave

| Campo | Tipo | Descripción |
|-------|------|-------------|
| invoiceNumber | string | Número de factura |
| controlNumber | string | NCF (Número de Comprobante Fiscal) |
| documentType | enum | Factura, Nota de Débito, Nota de Crédito |
| currency | enum | USD / VES |
| exchangeRate | decimal | Tasa congelada al momento de facturar |
| subtotalUsd/SubtotalVes | decimal | Subtotal en ambas monedas |
| ivaUsd/IvaVes | decimal | IVA en ambas monedas |
| totalUsd/TotalVes | decimal | Total en ambas monedas |
| status | enum | active / cancelled |

## Relaciones

- [[invoice]] -> [[user]]: N:1 (creada por un operador)
- [[invoice]] -> [[customer]]: N:1 (cliente asociado)
- [[invoice]] -> [[invoice-item]]: 1:N (líneas de la factura)
- [[invoice]] <-> [[dual-currency]]: aplica doble moneda
- [[invoice]] <-> [[fiscal-compliance]]: cumple requisitos SENIAT
