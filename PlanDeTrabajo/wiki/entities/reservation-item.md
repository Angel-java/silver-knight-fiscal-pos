---
type: entity
tags: [apartado, reservation, item, line]
created: 2026-08-28
updated: 2026-08-28
sources: [db-schema]
---

# ReservationItem

Línea de un **[[reservation|Reservation]]** (apartado). Guarda el producto y el precio USD congelado al momento de apartar.

## Atributos clave

| Campo | Tipo | Descripción |
|-------|------|-------------|
| productId | string? | [[product\|Product]] opcional (admite ítems libres) |
| productName | string | Nombre desnormalizado |
| quantity | decimal | Cantidad apartada |
| unitPriceUsd / unitPriceVes | decimal | Precio congelado (dual) |
| ivaRate | decimal | Tasa IVA (se usa al facturar) |
| totalUsd / totalVes | decimal | Totales de línea |

## Relaciones

- Pertenece a un **[[reservation|Reservation]]** (onDelete: Cascade)
- Referencia opcional a un **[[product|Product]]**
