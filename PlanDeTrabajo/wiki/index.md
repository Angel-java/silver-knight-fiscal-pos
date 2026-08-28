---
type: overview
tags: [index, catalog]
created: 2026-06-30
updated: 2026-08-27
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
- [[data-migration|Data Migration]] — Export/import CSV + JSON (backup v1), todo-o-nada con pre-vuelo, estrategias, import root-only
- [[dual-currency|Dual Currency]] — Manejo de USD/VES: catálogo solo USD, factura dual con tasa congelada
- [[fiscal-compliance|Fiscal Compliance (SENIAT)]] — Cumplimiento fiscal venezolano
- [[offline-first|Offline-first]] — Arquitectura sin dependencia de internet
- [[docker-deployment|Docker Deployment]] — Modelo de deployment offline-capable (v1.1.13, arranque sin internet)

## Hitos recientes
- [[log#2026-08-27-build--reporte-de-fallas-por-problemas-de-conexión-en-funciones-de-red|2026-08-27 — Build: Reporte de fallas por conexión]] — Las funciones de red (BCV, sync, auto-update) informan "No hay conexión a internet" con causa técnica cuando fallan por conectividad
- [[log#2026-08-27-build--endurecimiento-offline-first-netprobe--vigencia-de-tasa--sync-resiliente|2026-08-27 — Build: Endurecimiento offline-first]] — Probe de conectividad real (netProbe), vigencia de tasa configurable + inserción manual en POS, sync resiliente con backoff (Fases A/B/C)
- [[diagnostico-docker-not-installed-timeout|2026-08-23 — Fix falso "Docker no instalado" (v1.1.24)]] — Timeout de 5s mataba `docker --version` en máquinas lentas/AV; fix con resolución de exe cacheada + rutas absolutas + reintentos + timeouts 20s
- [[log#2026-08-21-fix--importación-todo-o-nada--diagnóstico-de-import-fantasma-v1123|2026-08-21 — Fix importación todo-o-nada (v1.1.23)]] — Pre-vuelo con duplicados/referencias, sin éxito falso; causa raíz del "no importó nada" (imagen stale + cascada 25P02 + log falso)
- [[log#2026-08-20-release--v1122-publicada--selector-de-directorio-de-exportación|2026-08-20 — Release v1.1.22]] — Selector de directorio de exportación (feature 100% cliente, sin cambios de schema); auditoría pre-release sin riesgo para máquinas productivas
- [[log#2026-08-16-build--módulo-de-migración-de-datos--exportimport|2026-08-16 — Módulo de Migración de Datos]] — Export/import CSV+JSON, dry-run con estrategias, import root-only, facturas históricas, MigrationLog
- [[log#2026-08-04-release--v1114-offline-first--catálogo-dolarizado|2026-08-04 — Release v1.1.14]] — Primera release desde v1.1.12; incluye offline-first y catálogo dolarizado (no hubo tag v1.1.13)
- [[log#2026-08-04-usd-only-catálogo-dolarizado-v1114|2026-08-04 — Catálogo dolarizado (solo precios USD)]] — Eliminados campos VES de Producto/Cliente/Movimiento; VES en vivo y congelado en facturas

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
- [[auditoria-optimizacion-cuelgues|Auditoría de Optimización — Cuelgues aleatorios]] — Causas de cuelgues al azar durante el uso + fixes anti-hang aplicados (timeouts, logger async, sendSync, ReportsPage)
- [[diagnostico-server-exit-255-crlf|Diagn�stico - Server exit 255 por CRLF (v1.1.11)]] - El instalador v1.1.11 empaqueta docker-entrypoint.sh con CRLF (checkout CI en Windows sin .gitattributes); el shebang #!/bin/sh\r no existe y el contenedor muere con exit 255 sin logs; fix en v1.1.12 (.gitattributes + sed en Dockerfile)
- [[diagnostico-offline-startup|Diagnóstico - Arranque offline-first (v1.1.13)]] — La app inicia y es usable sin internet usando la imagen Docker cacheada; solo fallan las funciones de red (auto-update, BCV, sync). Cambios en docker.ts/server-image.ts/index.ts/updater.ts + pull_policy: missing
- [[diagnostico-docker-not-installed-timeout|Diagnóstico — "Docker no está instalado" con Docker instalado (v1.1.24)]] — Falso negativo por timeout de 5s en `docker --version` (AV/lentitud); firma ≥5.4s = timeout; fix con resolución de exe cacheada + rutas absolutas + reintentos + timeouts 20s
