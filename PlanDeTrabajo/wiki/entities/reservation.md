---
type: entity
tags: [apartado, reservation, layaway, pos, payment]
created: 2026-08-28
updated: 2026-08-28
sources: [db-schema]
---

# Reservation (Apartado de Producto)

Compromiso de venta: el cliente paga un apartado (abono) y reserva mercancía, pagando abonos parciales hasta liquidar el saldo. Documentado en [[layaway]].

Un **Reservation** (apartado) es un documento **NO fiscal** (no genera NCF, no afecta Libros IVA) que acumula abonos. Solo al liquidar el total se emite la factura fiscal final ([[invoice|FACT]]).

## Atributos clave

| Campo | Tipo | Descripción |
|-------|------|-------------|
| number | string (único) | `AP-YYYYMMDD-XXXX` |
| status | string | `active` \| `finalized` \| `cancelled` \| `expired` |
| totalUsd / totalVes | decimal | Total comprometido (doble moneda, tasa congelada) |
| exchangeRate | decimal | Tasa BCV congelada al crear |
| currency | string | `USD` \| `VES` |
| amountPaidUsd | decimal | Suma de abonos |
| depositUsd | decimal | Abono inicial |
| dueDate | datetime? | Fecha límite para liquidar |
| invoiceId | string? | Factura fiscal final generada al liquidar |
| finalizedAt / cancelledAt | datetime? | Marcas de estado |

## Reglas de negocio

- Al crear: se **decrementa stock** y se crea un movimiento `reserved` ([[inventory-movement]]).
- El apartado inicial **debe ser menor que el total** (no se puede liquidar al momento).
- Abonos parciales (USD o VES) **no emiten factura** ni se registran en Libros IVA.
- Al liquidar: se emite factura fiscal FACT (número CF vía [[fiscal-compliance]]) **sin** volver a decrementar stock, y se imprime el ticket ([[printer]]).
- Al cancelar o vencer: se **devuelve stock** con movimiento `unreserved`.

## Relaciones

- Pertenece a un **[[customer|Customer]]** (opcional) y a un **[[user|User]]**
- Contiene **[[reservation-item|ReservationItem]]** (líneas) y **[[reservation-payment|ReservationPayment]]** (abonos)
- Se vincula a la **[[invoice|Invoice]]** final generada vía `invoiceId`

## Origen

- Se crea manualmente en el módulo **Apartados** (módulo de permiso `apartados`).
- Se vence automáticamente por el scheduler diario ([`src/server/scheduler.ts`](silver-knight/src/server/scheduler.ts)) si `dueDate` pasó y sigue `active`.

## API

Ruta `/api/reservations` (auth + permiso `apartados`): `POST /`, `GET /`, `GET /:id`, `POST /:id/payments`, `POST /:id/finalize`, `POST /:id/cancel`.
El detalle de cliente (`GET /api/customers/:id`) incluye `reservations` (últimas 20 con items) para mostrarlas en la ficha del cliente ([[customer|CustomersPage]]).
