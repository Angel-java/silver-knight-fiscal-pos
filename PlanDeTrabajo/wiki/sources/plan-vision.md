---
type: source
tags: [plan, vision, architecture]
created: 2026-06-30
updated: 2026-06-30
source: PLAN.md
---

# Plan — Visión del Proyecto

Fuente original: `PLAN.md`

Define la visión general de Silver Knight: sistema POS con facturación fiscal venezolana, tres perfiles de distribución (Small/Medium/Big) y principios arquitectónicos como [[offline-first]], [[dual-currency]] y [[fiscal-compliance]].

## Entidades y conceptos que documenta

- [[overview]] — la visión general del proyecto se basa directamente en esta fuente
- [[company]] — la empresa como entidad central del sistema
- [[offline-first]] — principio arquitectónico definido aquí
- [[dual-currency]] — principio de doble moneda
- [[fiscal-compliance]] — facturación fiscal desde el día 1

## Perfiles de distribución

| Perfil | Base de datos | Alcance |
|--------|--------------|---------|
| Small | SQLite local | Single desktop |
| Medium | SQLite + sync | Red local |
| Big | PostgreSQL | Multi-sucursal cloud |
