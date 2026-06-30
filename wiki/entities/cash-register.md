---
type: entity
tags: [cash-register, pos, session, closure]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# Cash Register

Apertura y cierre de caja del sistema POS.

## Atributos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| openingAmount | decimal | Monto de apertura (dual currency) |
| closingAmount | decimal | Monto de cierre (dual currency) |
| openedAt | datetime | Fecha/hora de apertura |
| closedAt | datetime | Fecha/hora de cierre |
| status | enum | open / closed |

## Relaciones

- [[cash-register]] -> [[user]]: N:1 (operador que abrió/cerró la caja)
