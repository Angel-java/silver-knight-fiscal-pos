---
type: concept
tags: [apartado, layaway, reservation, payment, pos, fiscal]
created: 2026-08-28
updated: 2026-08-28
sources: [db-schema]
---

# Apartado de Productos (Layaway)

Sistema que permite apartar mercancía pagando un abono inicial y abonos parciales, reservando el stock hasta que el cliente liquida el total.

## Frontera fiscal (crítico)

En [[fiscal-compliance|facturación SENIAT]] **solo se factura al cobrar el total**. Por tanto:

- El **apartado** es un documento **NO fiscal**: no genera número CF, no afecta Libros IVA Venta, no es comprobante.
- Los **abonos parciales** son solo registros de pago ([[reservation-payment]]); no emiten factura ni se imprimen.
- **Al liquidar** el saldo se emite la **factura fiscal FACT** (número CF) y se imprime el ticket de la factura ([[printer]]). Solo entonces el movimiento de inventario pasa a `sale`.

## Manejo de stock

- **Al apartar**: se **reserva** stock (decremento + movimiento `reserved`) — el artículo queda fuera de venta a otros.
- **Al liquidar**: se emite la factura **sin** volver a decrementar stock (ya estaba reservado); el movimiento pasa a `sale`.
- **Al cancelar / vencer**: se **devuelve** el stock (incremento + movimiento `unreserved`).

## Cobro y moneda

- Abonos aceptados en **USD y VES**. Los VES se convierten usando la **tasa congelada de la cabecera** del apartado (ver [[dual-currency]]).
- El saldo se calcula contra el total comprometido en USD.

## Ciclo de vida

`active → finalized` (se liquidó y facturó) · `active → cancelled` (cancel manual, devuelve stock) · `active → expired` (venció por `dueDate`, scheduler diario, devuelve stock)

## Entidades

- [[reservation|Reservation]] — cabecera del apartado
- [[reservation-item|ReservationItem]] — líneas con precio congelado
- [[reservation-payment|ReservationPayment]] — abonos parciales

## Implementación

Módulo de permiso `apartados`; ruta `/api/reservations`; UI: página **Apartados** (Dashboard) + sección "Apartados" en la ficha del cliente ([[customer]]). Vencimiento automático en `src/server/scheduler.ts`.
