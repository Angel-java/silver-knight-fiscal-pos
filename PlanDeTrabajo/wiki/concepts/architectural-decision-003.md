---
type: concept
tags: [adr, architecture, dual-currency, decision, stub]
created: 2026-06-30
updated: 2026-06-30
sources: [architectural-decisions]
---

# ADR-003: Native Dual Currency

**Decisión**: Toda transacción financiera guarda montos tanto en USD como en VES, con la tasa de cambio congelada al momento de la transacción. Fuente: [[architectural-decisions]].

→ Ver implementación detallada en [[dual-currency]].

## Contexto

Venezuela opera con dos monedas (USD y VES) de facto. El sistema debe soportar ambas sin depender de tasas en tiempo real.

## Relación con otros conceptos

- [[fiscal-compliance]] se apoya en esta decisión para emitir facturas en ambas monedas
