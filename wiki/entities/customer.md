---
type: entity
tags: [customer, client, fiscal]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# Customer

Cliente o receptor de factura.

## Atributos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| RIF | string | Registro de Información Fiscal (Venezuela) |
| name | string | Razón social o nombre |
| address | string | Dirección fiscal |
| phone | string | Teléfono |
| email | string | Correo electrónico |
| creditLimitUsd/CreditLimitVes | decimal | Límite de crédito en ambas monedas |

## Relaciones

- [[customer]] -> [[invoice]]: 1:N (historial de compras)
- [[customer]] <-> [[fiscal-compliance]]: datos fiscales obligatorios para facturación
