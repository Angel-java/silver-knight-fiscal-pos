---
type: concept
tags: [currency, usd, ves, exchange-rate, architecture]
created: 2026-06-30
updated: 2026-06-30
sources: [adr-003, db-schema]
---

# Dual Currency

Mecanismo nativo de doble moneda (USD/VES) en Silver Knight.

## Principio

Toda transacción financiera guarda **ambas monedas** con la tasa de cambio congelada al momento de la transacción. No se usan tasas en tiempo real.

## Implementación

- Cada tabla financiera tiene columnas tanto en USD como en VES
- La [[exchange-rate]] se captura por transacción (no se referencia dinámicamente)
- El campo `currency` en [[invoice]] indica la moneda primaria usada en el cobro
- Los totales, subtotales e IVA se almacenan en ambas monedas

## ADR-003

Decisión arquitectónica formal: [[architectural-decision-003]]
