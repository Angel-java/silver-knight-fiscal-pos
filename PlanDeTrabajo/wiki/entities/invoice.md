---
type: entity
tags: [invoice, fiscal, pos, transaction]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema, fiscal-compliance]
---

# Invoice

Factura emitida por el sistema. Toda factura es fiscalmente válida ([[fiscal-compliance|ADR-005]]). Fuentes: [[db-schema]], [[tasks]], [[small-profile-phase]].

Una **[[invoice|Invoice]]** es el documento central del sistema. Registra una venta con todos los datos fiscales requeridos por el SENIAT, en la moneda que el cliente elija ([[dual-currency]]), y queda asociada al [[user|operador]] que la creó y al [[customer|cliente]] que la recibe.

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

## Relaciones con otras entidades

- Una **Invoice** es creada por un **[[user|User]]** (operador)
- Una **Invoice** pertenece a un **[[customer|Customer]]** (receptor fiscal)
- Una **Invoice** contiene líneas (**[[invoice-item|InvoiceItems]]**) con productos, cantidades y montos
- Una **Invoice** aplica **[[dual-currency|doble moneda]]**: guarda todo en USD y VES
- Una **Invoice** cumple **[[fiscal-compliance|requisitos SENIAT]]**: NCF, IVA, RIF, etc.
