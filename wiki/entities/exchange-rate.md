---
type: entity
tags: [exchange-rate, currency, bcv]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# Exchange Rate

Registro histórico de tasas de cambio USD/VES.

## Atributos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| rate | decimal | Tasa de cambio |
| source | enum | manual / bcv |
| date | datetime | Fecha de la tasa |

## Relaciones

- [[exchange-rate]] <-> [[company]]: N:1 (una empresa tiene muchas tasas históricas)
- [[exchange-rate]] <-> [[dual-currency]]: cada transacción congela la tasa al momento de facturar
