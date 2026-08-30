---
type: overview
tags: [index, catalog]
created: 2026-06-30
updated: 2026-08-30
---

# Ãndice de la Wiki â€” Silver Knight

## VisiÃ³n general
- [[overview|VisiÃ³n General del Proyecto]]
- [[log|Log de operaciones]]

## Entidades
- [[category|Category]] â€” CategorÃ­a de productos
- [[company|Company]] â€” Empresa propietaria del sistema
- [[customer|Customer]] â€” Cliente / receptor de factura
- [[exchange-rate|Exchange Rate]] â€” Tasas de cambio USD/VES
- [[inventory-movement|Inventory Movement]] â€” Movimiento de inventario (audit trail)
- [[invoice|Invoice]] â€” Factura fiscal
- [[invoice-item|Invoice Item]] â€” LÃ­nea de factura
- [[cash-register|Cash Register]] â€” Apertura/cierre de caja
- [[product|Product]] â€” Producto del inventario
- [[reservation|Reservation (Apartado)]] â€” Compromiso de venta con abonos
- [[reservation-item|Reservation Item]] â€” LÃ­nea de apartado
- [[reservation-payment|Reservation Payment]] â€” Abono parcial de apartado
- [[setting|Setting]] â€” ConfiguraciÃ³n clave-valor
- [[user|User]] â€” Operador del sistema

## Conceptos
- [[architectural-decision-003|ADR-003: Native Dual Currency]] â€” DecisiÃ³n formal (stub, ver [[dual-currency]])
- [[data-migration|Data Migration]] â€” Export/import CSV + JSON (backup v1), todo-o-nada con pre-vuelo, estrategias, import root-only
- [[dual-currency|Dual Currency]] â€” Manejo de USD/VES: catÃ¡logo solo USD, factura dual con tasa congelada
- [[fiscal-compliance|Fiscal Compliance (SENIAT)]] â€” Cumplimiento fiscal venezolano
- [[layaway|Apartado de Productos (Layaway)]] â€” Reserva de stock con abonos; factura fiscal solo al liquidar
- [[offline-first|Offline-first]] â€” Arquitectura sin dependencia de internet
- [[docker-deployment|Docker Deployment]] â€” Modelo de deployment offline-capable (v1.1.13, arranque sin internet)
- [[reset-root-user|Reset / cambio de credenciales del root]] â€” OperaciÃ³n de mantenimiento para cambiar username/PIN del root vÃ­a psql (inmutable por API)

## Hitos recientes
- [[diagnostico-login-root-drift|2026-08-30 — v1.1.25: E2E máquina desplegada + empaquetado reset-root]] — Validado end-to-end el flujo de máquina desplegada (editar `.env` + reiniciar → self-heal del root). `reset-root.js` empaquetado como `extraResource`; guard `ROOT_PIN` vacío (no-op); bump a 1.1.25 (sin publicar).
- [[log#2026-08-30-fix--login-root--auto-reconciliaci-c2-b3n-de-credenciales--rotaci-c3-b3n-de-pin|2026-08-30 — Fix: Login root + rotación de PIN]] — `autoCreateRoot()` ahora reconcilia las credenciales del root desde el `.env` en cada arranque (elimina el drift). PIN root rotado a uno seguro. Ver [reset-root-user]
- [[log#2026-08-28-tool--script-independiente-de-reset-de-credenciales-del-root|2026-08-28 â€” Tool: Script de cambio de credenciales del root]] â€” Script independiente (`opencode-tools/reset-root`) que cambia username/PIN del root editando Postgres vÃ­a `docker exec psql` (root es inmutable por API)
- [[log#2026-08-27-build--reporte-de-fallas-por-problemas-de-conexiÃ³n-en-funciones-de-red|2026-08-27 â€” Build: Reporte de fallas por conexiÃ³n]] â€” Las funciones de red (BCV, sync, auto-update) informan "No hay conexiÃ³n a internet" con causa tÃ©cnica cuando fallan por conectividad
- [[log#2026-08-27-build--endurecimiento-offline-first-netprobe--vigencia-de-tasa--sync-resiliente|2026-08-27 â€” Build: Endurecimiento offline-first]] â€” Probe de conectividad real (netProbe), vigencia de tasa configurable + inserciÃ³n manual en POS, sync resiliente con backoff (Fases A/B/C)
- [[diagnostico-docker-not-installed-timeout|2026-08-23 â€” Fix falso "Docker no instalado" (v1.1.24)]] â€” Timeout de 5s mataba `docker --version` en mÃ¡quinas lentas/AV; fix con resoluciÃ³n de exe cacheada + rutas absolutas + reintentos + timeouts 20s
- [[diagnostico-login-root-drift|Diagnóstico — Login root "Credenciales inválidas" (drift de credenciales)]] — Causa raíz del 401 de root por drift entre `.env` y BD; 2 vías de resolución (self-heal al arrancar / reset-root.js); auto-reconcilia desde v1.1.25
- [[log#2026-08-21-fix--importaciÃ³n-todo-o-nada--diagnÃ³stico-de-import-fantasma-v1123|2026-08-21 â€” Fix importaciÃ³n todo-o-nada (v1.1.23)]] â€” Pre-vuelo con duplicados/referencias, sin Ã©xito falso; causa raÃ­z del "no importÃ³ nada" (imagen stale + cascada 25P02 + log falso)
- [[log#2026-08-20-release--v1122-publicada--selector-de-directorio-de-exportaciÃ³n|2026-08-20 â€” Release v1.1.22]] â€” Selector de directorio de exportaciÃ³n (feature 100% cliente, sin cambios de schema); auditorÃ­a pre-release sin riesgo para mÃ¡quinas productivas
- [[log#2026-08-16-build--mÃ³dulo-de-migraciÃ³n-de-datos--exportimport|2026-08-16 â€” MÃ³dulo de MigraciÃ³n de Datos]] â€” Export/import CSV+JSON, dry-run con estrategias, import root-only, facturas histÃ³ricas, MigrationLog
- [[log#2026-08-04-release--v1114-offline-first--catÃ¡logo-dolarizado|2026-08-04 â€” Release v1.1.14]] â€” Primera release desde v1.1.12; incluye offline-first y catÃ¡logo dolarizado (no hubo tag v1.1.13)
- [[log#2026-08-04-usd-only-catÃ¡logo-dolarizado-v1114|2026-08-04 â€” CatÃ¡logo dolarizado (solo precios USD)]] â€” Eliminados campos VES de Producto/Cliente/Movimiento; VES en vivo y congelado en facturas

## Fuentes ingeridas
- [[plan-vision|Plan â€” VisiÃ³n del Proyecto]]
- [[roadmap|Plan â€” Roadmap de 4 Fases]]
- [[tasks|Plan â€” 60 Tareas Phase 1]]
- [[architectural-decisions|Plan â€” ADRs]]
- [[db-schema|Plan â€” Database Schema]]
- [[small-profile-phase|Plan â€” Small Profile Phase + API]]

## PÃ¡ginas del sistema
- [[log#2026-07-02-build--etapa-19-completada--configuraciÃ³n-del-sistema|Stage 1.9 â€” ConfiguraciÃ³n del Sistema]]

## Queries y anÃ¡lisis
- [[auditoria-arquitectura|AuditorÃ­a de Arquitectura â€” Julio 2026]] â€” RevisiÃ³n completa del cÃ³digo base, 17 dimensiones evaluadas
- [[diagnostico-error-3001-post-update|DiagnÃ³stico â€” Error 3001 post-update]] â€” Causas raÃ­z del backend que no responde tras actualizar; OOM en `prisma db push` confirmado como causa mÃ¡s probable + self-heal (v1.1.6 â†’ v1.1.7)
- [[auditoria-optimizacion-cuelgues|AuditorÃ­a de OptimizaciÃ³n â€” Cuelgues aleatorios]] â€” Causas de cuelgues al azar durante el uso + fixes anti-hang aplicados (timeouts, logger async, sendSync, ReportsPage)
- [[diagnostico-server-exit-255-crlf|Diagnï¿½stico - Server exit 255 por CRLF (v1.1.11)]] - El instalador v1.1.11 empaqueta docker-entrypoint.sh con CRLF (checkout CI en Windows sin .gitattributes); el shebang #!/bin/sh\r no existe y el contenedor muere con exit 255 sin logs; fix en v1.1.12 (.gitattributes + sed en Dockerfile)
- [[diagnostico-offline-startup|DiagnÃ³stico - Arranque offline-first (v1.1.13)]] â€” La app inicia y es usable sin internet usando la imagen Docker cacheada; solo fallan las funciones de red (auto-update, BCV, sync). Cambios en docker.ts/server-image.ts/index.ts/updater.ts + pull_policy: missing
- [[diagnostico-docker-not-installed-timeout|DiagnÃ³stico â€” "Docker no estÃ¡ instalado" con Docker instalado (v1.1.24)]] â€” Falso negativo por timeout de 5s en `docker --version` (AV/lentitud); firma â‰¥5.4s = timeout; fix con resoluciÃ³n de exe cacheada + rutas absolutas + reintentos + timeouts 20s
