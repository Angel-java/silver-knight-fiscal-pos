---
type: overview
tags: [log, chronology]
created: 2026-06-30
updated: 2026-07-31
---

# Log de operaciones — Silver Knight

## [2026-06-30] init | Inicialización de la wiki
- **Descripción**: Creación inicial de la estructura LLM Wiki siguiendo el patrón de Karpathy
- **Páginas creadas**: [[index]], [[log]], [[overview]], [[company]], [[user]], [[dual-currency]], [[fiscal-compliance]], [[offline-first]]
- **Herramientas**: `tools/lint.sh`, `tools/search.sh`, `tools/stats.sh`
- **Notas**: Proyecto en fase de planificación pre-desarrollo. 60 tareas definidas en Phase 1 (Small). PlanDeTrabajo/ copiado a raw/planning-snapshots/ como fuentes inmutables.

## [2026-06-30] fix | Tejer relaciones entre páginas
- **Descripción**: Creación de páginas faltantes y wikilinks entre todas las páginas
- **Páginas creadas**: [[category]], [[customer]], [[exchange-rate]], [[invoice]], [[invoice-item]], [[cash-register]], [[product]], [[setting]], [[architectural-decision-003]]
- **Páginas actualizadas**: [[overview]], [[dual-currency]], [[fiscal-compliance]], [[offline-first]], [[company]], [[user]], [[index]]
- **Resultado lint**: 0 huérfanos, 0 enlaces rotos

## [2026-06-30] ingest | Ingesta de 6 planning snapshots como fuentes wiki
- **Fuentes**: `raw/planning-snapshots/plan-vision.md`, `roadmap.md`, `tasks.md`, `architectural-decisions.md`, `db-schema.md`, `small-profile-phase.md`
- **Páginas creadas**: [[plan-vision]], [[roadmap]], [[tasks]], [[architectural-decisions]], [[db-schema]], [[small-profile-phase]]
- **Páginas actualizadas**: [[index]]
- **Notas**: Ahora cada fuente tiene su propia página en wiki/sources/ con enlaces a las entidades y conceptos que documenta

## [2026-06-30] fix | Eliminar nodos duplicados en la wiki
- **Descripción**: Se corrigieron 4 casos de duplicación — (1) architectural-decision-003.md simplificado a stub que delega en dual-currency.md, (2) referencia circular eliminada en dual-currency.md, (3) wikilink ADR-005 corregido en fiscal-compliance.md, (4) overview.md reducido eliminando tablas duplicadas de PLAN.md
- **Páginas actualizadas**: [[architectural-decision-003]], [[dual-currency]], [[fiscal-compliance]], [[overview]], [[index]]
- **Resultado lint**: 0 huérfanos, 0 enlaces rotos

## [2026-07-01] build | Etapa 1.1 y 1.2 completadas
- **Descripción**: Scaffolding del proyecto completado — Electron + Vite + React + TypeScript + TailwindCSS + Express embebido + Prisma SQLite
- **Páginas actualizadas**: [[tasks]], [[roadmap]], [[index]], [[log]]
- **Archivos creados**:
  - `silver-knight/src/main/server/index.ts` — Servidor Express embebido
  - `silver-knight/src/main/database/prisma.ts` — Cliente Prisma singleton
  - `silver-knight/prisma/schema.prisma` — Schema con 10 modelos (Company, User, ExchangeRate, Category, Product, Customer, Invoice, InvoiceItem, CashRegister, Setting)
- **Detalle**: Proyecto inicializado con `npm create @quick-start/electron` (template react-ts). Express en puerto 3001 dentro del proceso main. Migración Prisma ejecutada (`prisma/migrations/`). Tailwind v3 con PostCSS. Build y typecheck pasan limpios.
- **Tareas completadas**: 17 de 60 (Etapa 1.1 y 1.2)

## [2026-07-01] build | Etapa 1.3 completada — Auth + Setup
- **Descripción**: Sistema de autenticación local con JWT + login con PIN, wizard de primer uso (empresa + admin), dashboard placeholder con navegación
- **Archivos creados**:
  - `src/main/server/routes/auth.ts` — Endpoints POST /login, POST /setup, GET /me, GET /company
  - `src/main/server/middleware/auth.ts` — JWT middleware + generación de tokens
  - `src/renderer/src/contexts/AuthContext.tsx` — Contexto de sesión global
  - `src/renderer/src/lib/api.ts` — Cliente API con fetch
  - `src/renderer/src/pages/LoginPage.tsx` — Pantalla de login con username + PIN
  - `src/renderer/src/pages/SetupWizardPage.tsx` — Wizard de 2 pasos (empresa → admin)
  - `src/renderer/src/pages/DashboardPage.tsx` — Dashboard con menú y resumen
- **Dependencias**: react-router-dom, @tanstack/react-query, bcryptjs, jsonwebtoken
- **Tareas completadas**: 23 de 60 (Etapas 1.1, 1.2, 1.3)

## [2026-07-01] build | Etapa 1.4 completada — Productos e Inventario
- **Descripción**: CRUD completo de categorías y productos con búsqueda, stock con alerta de mínimo, ajustes de inventario
- **Archivos creados**:
  - `src/main/server/routes/categories.ts` — API CRUD de categorías
  - `src/main/server/routes/products.ts` — API CRUD de productos + ajuste de stock
  - `src/renderer/src/pages/CategoriesPage.tsx` — Gestión de categorías con modal
  - `src/renderer/src/pages/ProductsPage.tsx` — Lista con búsqueda, paginación, stock, ajuste
  - `src/renderer/src/pages/ProductFormPage.tsx` — Formulario con precio dual, costo, IVA, categoría
- **Tareas completadas**: 30 de 60 (Etapas 1.1 a 1.4)

## [2026-07-01] build | Mejoras en Settings, costos y UI
- **Descripción**: API de settings (GET/PUT /api/settings), margen de ganancia configurable en SettingsPage, auto-cálculo de precio desde costo + margen en ProductFormPage, reorden de campos (costo antes que precio), reemplazo de emojis rotos por SVGs en Dashboard y ProductsPage, fix de teclado numérico (type="number" → text+inputMode)
- **Archivos creados**: `src/main/server/routes/settings.ts`
- **Archivos modificados**: `App.tsx`, `DashboardPage.tsx`, `ProductFormPage.tsx`, `ProductsPage.tsx`, `SettingsPage.tsx`, `api.ts`, `server/index.ts`
- **Tareas completadas**: 31 de 60 (Etapas 1.1 a 1.4 + 1.9.1)

## [2026-07-01] build | Etapa 1.5 — POS (Punto de Venta)
- **Descripción**: Interfaz POS completa con buscador de productos, carrito, selector de moneda USD/VES, cálculo de IVA, métodos de pago (efectivo/transferencia/punto/mixto), cálculo de vuelto, finalización de factura con descuento de stock y generación de número secuencial
- **Archivos creados**: `src/main/server/routes/invoices.ts`, `src/renderer/src/pages/POSPage.tsx`
- **Archivos modificados**: `server/index.ts`, `App.tsx`, `api.ts`
- **Tareas completadas**: 38 de 60 (Etapas 1.1 a 1.5 parcial + 1.9.1)

## [2026-07-02] build | Etapa 1.7 completada — Facturación Fiscal SENIAT
- **Descripción**: Implementación completa de requisitos fiscales venezolanos. Migración de DB con modelo FiscalControl + campos fiscales en Invoice. Numeración por talonario con control SECUENCIAL. Generación de número CF (Comprobante Fiscal) con formato SENIAT. Soporte para Factura, Nota de Crédito y Nota de Débito. Anulación de facturas con restitución de stock y registro de motivo. Libros IVA de Ventas y Compras con filtro por período. Vista de factura con todos los datos fiscales (número CF, resolución, RIFs). Página de gestión de talonarios en Ajustes.
- **Archivos creados**:
  - `prisma/migrations/20260702232936_add_fiscal_control/` — Migración: modelo FiscalControl + campos documentType, cancelReason, cancelledAt, fiscalControlId en Invoice
  - `src/main/server/routes/fiscalControl.ts` — API CRUD de talonarios + auto-creación de default
  - `src/main/server/routes/ivaBooks.ts` — API libros IVA de Ventas y Compras
  - `src/renderer/src/pages/FiscalControlPage.tsx` — Gestión de talonarios
  - `src/renderer/src/pages/IvaBooksPage.tsx` — Consulta de libros IVA
- **Archivos modificados**: `schema.prisma`, `invoices.ts`, `server/index.ts`, `api.ts`, `InvoiceViewPage.tsx`, `App.tsx`, `SettingsPage.tsx`, `TASKS.md`, `overview.md`, `index.md`
- **Tareas completadas**: 51 de 60 (Etapas 1.1 a 1.7 + 1.9.1)

## [2026-07-02] build | Etapa 1.6 completada — Módulo de Clientes
- **Descripción**: CRUD completo de clientes con datos fiscales (RIF), historial de compras por cliente, límites de crédito USD/VES. Integración con POS para seleccionar cliente en tiempo real. Menú Clientes restaurado en el Dashboard.
- **Archivos creados**:
  - `src/main/server/routes/customers.ts` — API CRUD con búsqueda, paginación, validación de duplicados
  - `src/renderer/src/pages/CustomersPage.tsx` — Lista con búsqueda, modal de crear/editar, detalle con historial de facturas
- **Archivos modificados**: `server/index.ts`, `api.ts`, `App.tsx`, `DashboardPage.tsx`, `POSPage.tsx`, `TASKS.md`, `overview.md`, `index.md`
- **Tareas completadas**: 42 de 60 (Etapas 1.1 a 1.6 + 1.9.1)

## [2026-07-02] fix | Mantenimiento — menús rotos y wiki desactualizada
- **Descripción**: Se removieron los enlaces del Dashboard a "Clientes" y "Reportes" que navegaban a rutas inexistentes (caían en redirect al inicio). Se actualizó overview.md (31→38 tareas) e index.md.
- **Archivos modificados**: `DashboardPage.tsx`, `overview.md`, `index.md`
- **Notas**: Clientes (etapa 1.6) y Reportes (etapa 1.8) se agregarán de vuelta al menú cuando se implementen sus respectivos módulos.

## [2026-07-02] build | Etapa 1.8 completada — Reportes y Dashboard
- **Descripción**: Implementación completa de reportes con 5 tabs (Ventas Diarias, Ventas por Período, Inventario, Top Productos, Cierre de Caja) con datos en tiempo real desde la API. ReportsPage con tabla de facturas navegable, desglose por método de pago, filtros de fecha, y botón Imprimir/PDF. Reportes API endpoints creados en ruta `/reports`. Menú Reportes restaurado en DashboardPage.
- **Archivos creados**:
  - `src/main/server/routes/reports.ts` — 5 endpoints: sales-daily, sales-range, inventory, top-products, cash-close
  - `src/renderer/src/pages/ReportsPage.tsx` — UI completa con 5 tabs, summaries, tablas de datos
- **Archivos modificados**: `server/index.ts`, `api.ts`, `App.tsx`, `DashboardPage.tsx`, `TASKS.md`, `overview.md`, `index.md`
- **Tareas completadas**: 58 de 60 (Etapas 1.1 a 1.8 + 1.9.1)

## [2026-07-02] build | Etapa 1.9 completada — Configuración del Sistema
- **Descripción**: Implementación completa de la configuración del sistema. BCV auto-fetch (POST /api/exchange-rates/bcv con parser HTML). Configuración de impresión (ancho de papel, encabezado/pie). Selector de perfil Small/Medium/Big. Edición de datos de empresa (PUT /api/auth/company). Gestión de usuarios (CRUD completo con ruta /api/users y página UsersPage con tabla, crear/editar modal, activar/desactivar).
- **Archivos creados**:
  - `src/main/server/routes/users.ts` — API CRUD de usuarios (list, create, update con cambio de PIN/rol/estado)
  - `src/renderer/src/pages/UsersPage.tsx` — UI completa con tabla, modal de crear/editar, toggle activo/inactivo
- **Archivos modificados**: `exchangeRates.ts` (BCV fetch + parser), `auth.ts` (PUT /company), `server/index.ts`, `api.ts`, `SettingsPage.tsx`, `App.tsx`, `DashboardPage.tsx`, `TASKS.md`, `overview.md`, `index.md`
- **Tareas completadas**: 64 de 70 (Etapas 1.1 a 1.9)

## [2026-07-02] build | Etapa 1.10 completada — Impresión Térmica + Fase 1 terminada
- **Descripción**: Implementación completa de impresión térmica ESC/POS. Generación de comandos ESC/POS raw con formato de ticket fiscal (encabezado, items, totales, IVA, desglose por moneda, métodos de pago, corte de papel). Comunicación con impresora vía `lp` (Linux/macOS). API de listado de impresoras (`lpstat`). Vista previa del ticket en modal con tipografía mono. Reimpresión desde InvoiceViewPage. Prueba de impresión en SettingsPage con selección de impresora.
- **Archivos creados**:
  - `src/main/server/printer.ts` — Generador ESC/POS (`buildThermalTicket`) + comunicación (`printRaw`, `printInvoice`, `getAvailablePrinters`)
  - `src/main/server/routes/print.ts` — API endpoints: GET /printers, POST /invoice/:id
- **Archivos modificados**: `server/index.ts`, `api.ts`, `InvoiceViewPage.tsx`, `SettingsPage.tsx`, `TASKS.md`, `overview.md`, `index.md`
- **Tareas completadas**: 70 de 70 — **Fase 1 Small Profile terminada** 🎉

## [2026-07-03] fix | Lint masivo + bugs responsive + auto-cálculo VES
- **Descripción**: Corrección de 100 errores de lint + 2 bugs funcionales + mejora responsive del POS y Dashboard.
- **Lint corregido**:
  - 8x `set-state-in-effect` — migración a async IIFE inline en POSPage, ProductsPage, ReportsPage, SettingsPage, UsersPage, FiscalControlPage, IvaBooksPage
  - 4x `exhaustive-deps` — inlining de efectos en POSPage, ReportsPage, CategoriesPage, CustomersPage
  - 1x `only-export-components` — AuthContext.tsx dividido en [[AuthContext]], [[AuthProvider]], [[useAuth]]
  - 87x `explicit-function-return-type` — `: void`, `: Promise<void>`, `: boolean`, `: string`, `: JSX.Element` agregados en 18 archivos
- **Bug fix**: `ProductFormPage.tsx` — costVes no se calculaba cuando `profitMargin = 0`; ahora se calcula siempre que haya `exchangeRate > 0`, independiente del margen
- **Responsive**:
  - `POSPage.tsx`: layout `flex-col lg:flex-row` — mobile apilado (carrito abajo con `max-h-[45vh]`), desktop side-by-side. Grid de productos: `grid-cols-2 sm:3 lg:3 xl:4`
  - `DashboardPage.tsx`: `grid-cols-5` → `grid-cols-6` — los 6 botones del menú caben en una fila en pantalla completa
- **Resultado lint**: 0 errores, 0 warnings
- **Resultado typecheck**: 0 errores

## [2026-07-04] audit | Auditoría de arquitectura
- **Descripción**: Revisión completa del código fuente backend, frontend, base de datos, seguridad, y documentación
- **Páginas creadas**: [[auditoria-arquitectura]]
- **Páginas actualizadas**: [[index]]
- **Score global**: 6.5/10
- **Hallazgos críticos**: 0 tests (0/10), API_BASE hardcodeada (viola ADR-004), error handling repetitivo en 45+ lugares, POSPage monolítico (647 líneas)
- **Fortalezas**: separación de capas sólida, dual currency nativo, fiscal compliance desde día 1, Prisma migrations
- **Recomendaciones**: agregar tests primero, centralizar errores, hacer API_BASE configurable, rate limiting en login

## [2026-07-04] plan | Plan de Cliente Web + Cloud Server
- **Descripción**: Creación del plan técnico para extender Silver Knight con cloud sync (Fase 3.1) y web client SPA (Fase 3.3). Arquitectura Cloud → Web Client con PostgreSQL, sync receiver, y React SPA independiente.
- **Páginas creadas**: [[web-client-cloud-plan|Plan — Cliente Web + Cloud Server]]
- **Páginas actualizadas**: [[index]]
- **Notas**: Archivo guardado en `PlanDeTrabajo/planning/web-client-cloud-plan.md`. 2 fases: Cloud Server (A.1-A.6) y Web Client (B.1-B.10). Pendiente de iniciar implementación.

## [2026-07-06] delete | Eliminación del plan Cliente Web + Cloud Server
- **Descripción**: Eliminado el plan de Cliente Web + Cloud Server por replanteamiento de la dirección del proyecto. Se removió el archivo `web-client-cloud-plan.md`, la referencia en `PLAN.md` ("Web client para gestión centralizada") y la etapa 3.3 de `ROADMAP.md`.
- **Archivos eliminados**: `PlanDeTrabajo/planning/web-client-cloud-plan.md`
- **Páginas actualizadas**: [[index]]
- **Notas**: El usuario va a replantear desde cero cómo debe funcionar el cliente web.

## [2026-07-07] build | Sistema de Control de Entradas de Inventario
- **Descripción**: Implementación del módulo de movimientos de inventario con audit trail completo. Nuevo modelo `InventoryMovement` con tipos `entry`, `exit`, `sale`, `cancellation`. El stock adjustment manual ahora crea movimientos, las facturas registran `sale`, y las anulaciones registran `cancellation`.
- **Páginas creadas**: [[inventory-movement]]
- **Páginas actualizadas**: [[product]], [[index]]
- **Archivos creados**:
  - `src/main/server/routes/inventoryEntries.ts` — API CRUD de movimientos
  - `src/renderer/src/pages/InventoryEntriesPage.tsx` — UI con tabla, filtros por tipo, modal de creación
- **Archivos modificados**: `schema.prisma`, `products.ts`, `invoices.ts`, `server/index.ts`, `api.ts`, `ProductsPage.tsx`, `App.tsx`, `DashboardPage.tsx`, `schemas.ts`
- **Migración**: `20260708022835_add_inventory_movement`
- **Tests**: 82/82 pasan

## [2026-07-11] docs | .env.example + README de replicación
- **Descripción**: Creado `.env.example` con todas las variables de entorno documentadas y reescrito `README.md` con guía completa de replicación del entorno de desarrollo en otra terminal.
- **Archivos creados**: `silver-knight/.env.example`
- **Archivos modificados**: `silver-knight/README.md`
- **Contenido README**: stack tecnológico, prerequisitos (Node 20+, build tools), pasos de replicación (clone → env → install → prisma → dev), tabla de variables de entorno, scripts npm, modo Docker, estructura del proyecto, endpoints API, CI/CD pipeline, requisitos de hardware
- **Commit**: `e09cf3c`

## [2026-07-27] fix | Auto-updates, seguridad y repo público
- **Descripción**: Revisión completa del sistema de auto-updates, corrección de bugs, integración de docker-updater, eliminación de secretos del código y historial de git, y migración a repo público.
- **Archivos modificados**: `updater.ts`, `docker-updater.ts`, `index.ts`, `preload/index.ts`, `preload/index.d.ts`, `UpdateNotification.tsx`, `SettingsPage.tsx`, `autoAdmin.ts`, `Dockerfile`, `docker-compose.yml`, `start-dev.ts`, `.env.example`, `.env.docker.example`, `package.json`, `.gitignore`
- **Archivos creados**: `scripts/setup.ts`, `updater.spec.ts`, `docker-updater.spec.ts`
- **Cambios clave**:
  - Progress bar real en UpdateNotification (antes hardcodeado a 60%)
  - Cleanup de listeners IPC en preload y componentes React
  - `getVersionAsync` para eliminar `sendSync` del renderer
  - `docker-updater.ts` integrado al startup con feedback al splash
  - 29 tests nuevos (110 total)
  - Script `npm run setup` genera `.env` con credenciales seguras
  - Secretos eliminados de código: PIN root, DB password, Dockerfile DATABASE_URL
  - Historial de git reescrito con `git-filter-repo` (sin secretos)
  - Repo migrado a público en GitHub
- **Pendiente**: Revisar script de configuración para instalación en producción
- **Commits**: `de363b2` (post reescritura)

## [2026-07-31] build | v1.1.5 publicada — Docker offline + imagen de servidor cacheable
- **Descripción**: Eliminación de la causa raíz del error de puerto 3001 en la máquina desplegada. Cada arranque corría `docker compose up -d --build`, y la capa de deps del Dockerfile (`COPY package.json → npm ci`) se invalidaba en cada bump de versión de la app (el `package.json` de `resources/` contiene la versión). En la máquina desplegada (acceso lento a registry) el build fallaba → backend nunca arrancaba.
- **Cambios clave**:
  - `startCompose` ahora corre `docker compose up -d` **sin `--build`** — arranques normales offline e instantáneos con la imagen cacheada
  - Nuevo `server/package.json` + `server/package-lock.json` (solo deps del servidor, versión fija `1.0.0`): la capa `npm ci` ya no se invalida con releases de la app; rebuilds post-update son capas locales rápidas
  - `Dockerfile`: stage `deps` usa `server/package.json`/`lock`; schema copiado después del `npm ci`
  - `ensureServerImage` (`server-image.ts`): rebuild solo cuando cambia la versión de la app; sentinel `.server-version` movido a `userData` (`%APPDATA%`, escribible incluso bajo `Program Files`); fallo de rebuild NO fatal → la app cae a la imagen existente en vez de errorear
  - Diálogos de fallo con botón **"Copiar diagnóstico"** (docker ps + logs del contenedor + tail de `main.log` → portapapeles) para que el operador de la máquina desplegada pueda enviar la causa real
- **Verificación local E2E**: sentinel vacío → rebuild cacheado (4s) → `up -d` offline → backend listo en ~22s → app estable. `npx vitest run` 110/110, typecheck limpio, `docker compose build` segunda vez 100% CACHED en 0.2s
- **Release**: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.5
- **Commit**: `54d3626`
- **Pendiente**: confirmar en la máquina desplegada; si falla, que el operador envíe el diagnóstico copiado o `%APPDATA%\silver-knight\logs\main.log`

## [2026-07-31] fix | v1.1.6 — causas raíz del error 3001 post-update (confirmado en máquina desplegada)
- **Fuente**: operador de máquina desplegada — splash pegado en "Esperando al servidor" → timeout → diálogo puerto 3001
- **Páginas tocadas**: [[docker-deployment]], [[diagnostico-error-3001-post-update]], [[index]]
- **Resumen**: el `up -d` ya devolvía OK pero el backend no respondía en 120s. Causas: (1) `before-quit` corría `docker compose down` sin `COMPOSE_PROJECT_NAME` → no-op → Postgres nunca se apagaba limpio; (2) `cleanupStaleContainers` hacía `rm -f` de la DB en cada arranque → crash recovery lento sobre volumen de producción; (3) `/api/health` dependía de la DB → health checks fallaban durante recuperación; (4) `up -d` no reportaba crash-loops del contenedor server; (5) `prisma db push` corría en cada arranque
- **Cambios clave**:
  - `index.ts`: `before-quit` con `COMPOSE_PROJECT_NAME=silverknight` (shutdown graceful real); arranque usa `waitForBackendWithContainerCheck` (180s) que detecta contenedor `exited/restarting` y muestra sus logs de inmediato; `gatherDiagnostics` con `docker compose ps` + estado del contenedor server
  - `docker.ts`: `cleanupStaleContainers` excluye `silverknight-db`; `startCompose` limpia solo en conflicto; helpers `getServerContainerState`/`getComposePsText`; `waitForBackend` default 180s + log
  - `server/index.ts`: `/api/health` liveness inmediato sin DB; `/api/health/db` nuevo (503 si DB caída)
  - `updater.ts`: pre-warm del cache Docker (pull + build) antes de `quitAndInstall`
  - `docker-entrypoint.sh` + `docker-compose.yml`: `prisma db push` solo cuando cambia el hash de `schema.prisma` (volumen `silverknight-schema-state`)
- **Verificación**: `npx vitest run` 113/113 (3 tests nuevos de pre-warm), typecheck limpio, lint sin errores nuevos
- **Release**: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.6
- **Commit**: `f8883c5`
- **Pendiente**: confirmar en la máquina desplegada; si vuelve a fallar, capturar "Copiar diagnóstico" (ahora incluye compose ps + estado del contenedor)
