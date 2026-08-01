---
type: overview
tags: [index, catalog]
created: 2026-06-30
updated: 2026-07-31
---

# Índice de la Wiki — Silver Knight

## Visión general
- [[overview|Visión General del Proyecto]]
- [[log|Log de operaciones]]

## Entidades
- [[category|Category]] — Categoría de productos
- [[company|Company]] — Empresa propietaria del sistema
- [[customer|Customer]] — Cliente / receptor de factura
- [[exchange-rate|Exchange Rate]] — Tasas de cambio USD/VES
- [[inventory-movement|Inventory Movement]] — Movimiento de inventario (audit trail)
- [[invoice|Invoice]] — Factura fiscal
- [[invoice-item|Invoice Item]] — Línea de factura
- [[cash-register|Cash Register]] — Apertura/cierre de caja
- [[product|Product]] — Producto del inventario
- [[setting|Setting]] — Configuración clave-valor
- [[user|User]] — Operador del sistema

## Conceptos
- [[architectural-decision-003|ADR-003: Native Dual Currency]] — Decisión formal (stub, ver [[dual-currency]])
- [[dual-currency|Dual Currency]] — Manejo nativo de USD/VES
- [[fiscal-compliance|Fiscal Compliance (SENIAT)]] — Cumplimiento fiscal venezolano
- [[offline-first|Offline-first]] — Arquitectura sin dependencia de internet
- [[docker-deployment|Docker Deployment]] — Modelo de deployment offline-capable (v1.1.5)

## Fuentes ingeridas
- [[plan-vision|Plan — Visión del Proyecto]]
- [[roadmap|Plan — Roadmap de 4 Fases]]
- [[tasks|Plan — 60 Tareas Phase 1]]
- [[architectural-decisions|Plan — ADRs]]
- [[db-schema|Plan — Database Schema]]
- [[small-profile-phase|Plan — Small Profile Phase + API]]

## Páginas del sistema
- [[log#2026-07-02-build--etapa-19-completada--configuración-del-sistema|Stage 1.9 — Configuración del Sistema]]

## Queries y análisis
- [[auditoria-arquitectura|Auditoría de Arquitectura — Julio 2026]] — Revisión completa del código base, 17 dimensiones evaluadas
- [[diagnostico-error-3001-post-update|Diagnóstico — Error 3001 post-update]] — Causas raíz del backend que no responde tras actualizar; OOM en `prisma db push` confirmado como causa más probable + self-heal (v1.1.6 → v1.1.7)
