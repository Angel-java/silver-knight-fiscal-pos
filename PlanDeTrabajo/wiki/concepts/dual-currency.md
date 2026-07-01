---
type: concept
tags: [currency, usd, ves, exchange-rate, architecture]
created: 2026-06-30
updated: 2026-06-30
sources: [adr-003, db-schema]
---

# Dual Currency

Mecanismo nativo de doble moneda (USD/VES) en Silver Knight. Fuentes: [[architectural-decisions]], [[db-schema]].

## Principio

Toda transacción financiera guarda **ambas monedas** con la tasa de cambio congelada al momento de la transacción (ver [[exchange-rate]] y [[architectural-decision-003|ADR-003]]). No se usan tasas en tiempo real.

## ¿Qué entidades implementan esto?

- La **[[company|Company]]** define la moneda por defecto
- El **[[product|Product]]** tiene precios y costos en USD y VES
- La **[[invoice|Invoice]]** guarda subtotales, IVA y totales en ambas monedas
- El **[[customer|Customer]]** tiene límites de crédito en USD y VES
- El **[[exchange-rate|ExchangeRate]]** registra la tasa histórica congelada en cada factura

## Relación con otros conceptos

- [[dual-currency]] es requisito para [[fiscal-compliance]] (SENIAT requiere facturación en ambas monedas)
- [[architectural-decision-003|ADR-003]] formaliza la decisión arquitectónica que implementa dual-currency
- [[offline-first]] no interfiere: las tasas se capturan localmente sin necesidad de API externa
