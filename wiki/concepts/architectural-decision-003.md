---
type: concept
tags: [adr, architecture, dual-currency, decision]
created: 2026-06-30
updated: 2026-06-30
sources: [architectural-decisions]
---

# ADR-003: Native Dual Currency

**Decisión**: Toda transacción financiera guarda montos tanto en USD como en VES, con la tasa de cambio congelada al momento de la transacción.

## Contexto

Venezuela opera con dos monedas (USD y VES) de facto. El sistema debe soportar ambas sin depender de tasas en tiempo real.

## Consecuencias

- Cada tabla financiera tiene columnas en ambas monedas
- [[exchange-rate]] se captura por transacción (no se referencia dinámicamente)
- [[invoice]] guarda subtotales, IVA y totales en USD y VES
- [[product]] tiene precios y costos en ambas monedas
- [[customer]] tiene límites de crédito en ambas monedas

## Relaciones

- [[architectural-decision-003]] <-> [[dual-currency]]: esta ADR formaliza el concepto
- [[architectural-decision-003]] <-> [[fiscal-compliance]]: complementa la facturación fiscal
