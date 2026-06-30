---
type: overview
tags: [project, vision, architecture]
created: 2026-06-30
updated: 2026-06-30
sources: [plan-vision]
---

# Silver Knight — Visión General

**Silver Knight** es un sistema POS (Point of Sale) y facturación fiscal electrónica diseñado para el mercado venezolano. Documentado en [[plan-vision]].

## Perfiles de distribución ([[roadmap]])

| Perfil | Alcance | Base de datos |
|--------|---------|---------------|
| **Small** | Single desktop (Electron) | SQLite local |
| **Medium** | Red local (servidor + clientes) | SQLite + sync |
| **Big** | Multi-sucursal en la nube | PostgreSQL |

## Principios arquitectónicos

1. [[offline-first|Offline-first]] — el core funciona 100% sin internet
2. **Misma lógica de negocio** — Small/Medium/Big comparten el mismo core
3. [[dual-currency|Dual currency nativo]] — USD/VES en cada transacción
4. [[fiscal-compliance|Facturación fiscal]] — cumplimiento SENIAT desde el día 1
5. **Escalabilidad horizontal** — crece sin reescribir

## Tech stack

| Capa | Tecnología |
|------|-----------|
| Shell | Electron + Vite |
| Frontend | React 18 + TypeScript + TailwindCSS + Radix UI |
| Backend | Express (Node.js, embebido en Electron) |
| DB local | SQLite via better-sqlite3 + Prisma ORM |
| DB cloud | PostgreSQL (fase 2) |
| Data fetching | TanStack React Query |
| Mobile | React Native (post-Big) |
| Sync | WebSockets + queues (post-Small) |

## Estado actual

- **Fase**: Planificación pre-desarrollo
- **Documentos**: Plan de trabajo completo (PlanDeTrabajo/)
- **Tareas**: 60 tareas definidas para Phase 1 (Small), todas pendientes
- **Próximo paso**: [[company|Configuración de empresa]], [[user|usuarios]], y scaffolding del proyecto (Electron + Vite + React + Express + Prisma)
