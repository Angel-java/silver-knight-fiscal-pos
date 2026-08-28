---
type: entity
tags: [apartado, reservation, payment, abono, layaway]
created: 2026-08-28
updated: 2026-08-28
sources: [db-schema]
---

# ReservationPayment

Abono (pago parcial) registrado contra un **[[reservation|Reservation]]** (apartado). No es una factura: no emite NCF ni afecta Libros IVA.

## Atributos clave

| Campo | Tipo | Descripción |
|-------|------|-------------|
| amountUsd / amountVes | decimal | Monto del abono (se aceptan USD o VES) |
| method | string | `cash` \| `transfer` \| `pos` \| `cash_usd` \| `cash_ves` \| `mixed` |
| detail | string? | JSON adicional |
| userId | string? | Usuario que registró el abono |

## Relaciones

- Pertenece a un **[[reservation|Reservation]]** (onDelete: Cascade)
- Referencia a un **[[user|User]]** (opcional)
