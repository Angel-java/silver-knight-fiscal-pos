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

- **Fase**: Planificación pre-desarrollo
- **Documentos**: Plan de trabajo completo (PlanDeTrabajo/)
- **Tareas**: 60 tareas definidas para Phase 1 (Small), todas pendientes
- **Próximo paso**: [[company|Configuración de empresa]], [[user|usuarios]], y scaffolding del proyecto (Electron + Vite + React + Express + Prisma)
