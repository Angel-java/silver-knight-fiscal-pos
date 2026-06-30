---
type: entity
tags: [exchange-rate, currency, bcv]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# Exchange Rate

Registro histórico de tasas de cambio USD/VES. Fuentes: [[db-schema]], [[small-profile-phase]].

Un **[[exchange-rate|ExchangeRate]]** captura la tasa de cambio en un momento dado. Es fundamental para el sistema de [[dual-currency|doble moneda]]: cada [[invoice|factura]] congela la tasa al momento de la transacción en lugar de referenciarla dinámicamente.

## Atributos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| rate | decimal | Tasa de cambio |
| source | enum | manual / bcv |
| date | datetime | Fecha de la tasa |

## Relaciones con otras entidades

- Un **ExchangeRate** pertenece al historial de una **[[company|Company]]**
- Las **[[invoice|facturas]]** congelan la tasa al momento de emitirse ([[dual-currency]])
- Puede obtenerse automáticamente del BCV (source: bcv) o ingresarse manualmente
