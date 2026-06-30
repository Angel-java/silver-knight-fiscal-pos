---
type: concept
tags: [adr, architecture, dual-currency, decision]
created: 2026-06-30
updated: 2026-06-30
sources: [architectural-decisions]
---

# ADR-003: Native Dual Currency

**Decisión**: Toda transacción financiera guarda montos tanto en USD como en VES, con la tasa de cambio congelada al momento de la transacción. Fuente: [[architectural-decisions]].

## Contexto

Venezuela opera con dos monedas (USD y VES) de facto. El sistema debe soportar ambas sin depender de tasas en tiempo real.

## Consecuencias en entidades y conceptos

- La [[company|Company]] define la moneda por defecto
- La [[invoice|Invoice]] guarda subtotales, IVA y totales en USD y VES
- El [[product|Product]] tiene precios y costos en ambas monedas
- El [[customer|Customer]] tiene límites de crédito en ambas monedas
- El [[exchange-rate|ExchangeRate]] registra la tasa al momento de cada transacción
- Todo esto implementa el concepto de [[dual-currency]]

## Relación con otros conceptos

- [[architectural-decision-003|ADR-003]] formaliza [[dual-currency]]
- [[fiscal-compliance]] se apoya en esta decisión para emitir facturas en ambas monedas
