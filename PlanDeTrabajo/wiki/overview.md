---
type: overview
tags: [project, vision, architecture]
created: 2026-06-30
updated: 2026-06-30
sources: [plan-vision]
---

# Silver Knight — Visión General

**Silver Knight** es un sistema POS (Point of Sale) y facturación fiscal electrónica diseñado para el mercado venezolano. Documentado en [[plan-vision]].

Tres perfiles de distribución: [[roadmap|Small (single machine) → Medium (LAN) → Big (multi-sucursal)]].

## Principios arquitectónicos

- [[offline-first]] — el core funciona 100% sin internet
- [[dual-currency]] — USD/VES nativo en cada transacción
- [[fiscal-compliance]] — cumplimiento SENIAT desde el día 1
- Misma lógica de negocio en todos los perfiles
- Escalabilidad horizontal sin reescribir

## Tech stack

Ver detalle completo en [[plan-vision]]. Resumen: Electron + Vite + React 18 + TypeScript + TailwindCSS + Radix UI + Express embebido + SQLite (Prisma ORM) → PostgreSQL en fase 2.

## Estado actual

- **Fase**: Desarrollo activo — Etapas 1.1 a 1.4 + 1.9.1 completadas
- **Tareas**: 31/60 completadas
- **Próximo paso**: [[pos|Etapa 1.5 — POS (Punto de Venta)]]
