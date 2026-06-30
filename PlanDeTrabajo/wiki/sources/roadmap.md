---
type: source
tags: [plan, roadmap, phases]
created: 2026-06-30
updated: 2026-06-30
source: ROADMAP.md
---

# Plan — Roadmap de 4 Fases

Fuente original: [[ROADMAP|ROADMAP.md]]

Roadmap de desarrollo con 4 fases progresivas que corresponden a los perfiles de distribución.

## Fases

| Fase | Perfil | Etapas |
|------|--------|--------|
| Phase 1 | Small | 10 stages (scaffolding, DB, auth, products, POS, customers, fiscal, reports, config, thermal) |
| Phase 2 | Medium | Servidor local, cliente POS remoto, sesiones multi-POS, cierres de caja |
| Phase 3 | Big | Servidor cloud, sync engine, web client, multi-sucursal, transfers |
| Phase 4 | Mobile | React Native, barcode, dashboard, purchases |

## Entidades y conceptos que documenta

- [[user]] — gestión de usuarios por fase
- [[company]] — crecimiento de empresa por perfil
- [[offline-first]] — fase Small es 100% offline
- [[fiscal-compliance]] — requerido desde Phase 1
