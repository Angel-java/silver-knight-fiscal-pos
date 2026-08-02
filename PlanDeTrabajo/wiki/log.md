---
type: overview
tags: [log, chronology]
created: 2026-06-30
updated: 2026-08-01
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

## [2026-07-31] diagnose | Crash-loop confirmado en `prisma db push` + diagnóstico ampliado
- **Fuente**: operador de máquina desplegada — diálogo v1.1.6 reporta "El contenedor del servidor no está corriendo (estado: restarting, reinicios: 6)"
- **Páginas tocadas**: [[diagnostico-error-3001-post-update]]
- **Resumen**: los logs del contenedor muestran un loop en `prisma db push` dentro del entrypoint (sale "Prisma schema loaded... at db:5432" y se corta antes de mostrar el error real). Reproducción local con DB limpia Postgres 16: `db push` OK en 508ms → el schema no es el problema. Hipótesis: (1) fallo de autenticación (volumen `pgdata` inicializado con contraseña pre-secretos, no coincide con `.env`), (2) OOM kill (la salida se corta sin mensaje de error), (3) volumen corrupto.
- **Cambios (en curso, v1.1.7)**:
  - `getServerContainerState` expone `oomKilled` (`docker inspect ... {{.State.OOMKilled}}`)
  - Diálogo de fallo: mensajes específicos si `oomKilled` (RAM/WSL2) o si los logs matchean patrones de auth (`password authentication failed`, `Authentication failed against database server`, `role "silverknight" does not exist`, `SCRAM authentication`)
  - Logs del diálogo 800 → 2000 chars; `getServerContainerLogs(50)` → 100 líneas
- **Próximo paso**: operador debe enviar el "Copiar diagnóstico" (v1.1.6 ya lo incluye completo, ~50 líneas de logs del contenedor) para confirmar la causa antes de emitir v1.1.7

## [2026-08-01] diagnose | Diagnóstico completo recibido → OOM como causa más probable → self-heal v1.1.7
- **Fuente**: operador pegó el "Copiar diagnóstico" completo de v1.1.6
- **Páginas tocadas**: [[diagnostico-error-3001-post-update]]
- **Hallazgos**: (1) imagen construida bien y rápido (registry OK, v1.1.5 resuelto); (2) DB `Up (healthy)`; (3) server `Restarting`, restarts=15; (4) logs del contenedor muestran loop en `prisma db push`: `Datasource "db"...` y se corta **sin error**; (5) **no hay P1000** → descartado fallo de auth; (6) hash de schema nunca se escribe → re-push infinito; (7) warning `pgdata` creado por project "resources" (inofensivo, datos preservados). **Causa más probable: OOM kill** — build terminó a las 02:22:58 (export/unpack pesados en RAM) y el contenedor arrancó 2s después → pico de memoria WSL2 → kill silencioso.
- **Cambios v1.1.7 implementados**:
  - `getServerContainerState`: +`oomKilled` +`exitCode` (137 = OOM)
  - Diálogo: exit/oomKilled en el mensaje; logs hasta 2000 chars
  - **Botón "Reparar"** (`runSelfHeal`): one-shot `prisma db push` con salida+exit capturados directo → clasifica (137→RAM, P1000→contraseña) → en éxito escribe hash de schema + `compose restart server` + re-wait → arranque sin terminal
  - Helpers nuevos en docker.ts: `runPrismaPushOnce`, `computeSchemaHash` (sha256 exacto de bytes, compatible con `sha256sum` del entrypoint), `writeSchemaStateHash`, `restartServerContainer`
- **Verificación**: typecheck limpio, 113/113 tests, eslint 0 errores en archivos tocados
- **Pendiente**: emitir release v1.1.7 (o, alternativa sin release, operador sube RAM de Docker Desktop por GUI ≥4096 MB)

## [2026-08-01] release | v1.1.7 publicada — self-heal para crash-loop de `prisma db push`
- **Descripción**: release con el botón "Reparar" y diagnóstico OOM/exitus. El operador instala; si el push one-shot reporta exit 137 → subir RAM de Docker Desktop por GUI (Settings → Resources → Memory ≥ 4096 MB → Apply & Restart); si reporta P1000 → reintroducir contraseña en Configuración. En éxito, la app escribe el hash de schema y arranca sin terminal.
- **Cambios clave**: botón "Reparar" (`runSelfHeal`) en el diálogo de fallo; `getServerContainerState` con `oomKilled` + `exitCode`; helpers `runPrismaPushOnce` (compose run one-shot con salida/exit capturados), `computeSchemaHash` (sha256 de bytes exacto, compatible con `sha256sum` del entrypoint), `writeSchemaStateHash` (docker run al volumen schema-state), `restartServerContainer`; logs 100 líneas / 2000 chars
- **Verificación**: typecheck limpio, 113/113 tests, eslint 0 errores en archivos tocados
- **Release**: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.7 (assets: `silver-knight-1.1.7-setup.exe` sha512 `70CD23919827C49CCD08E139432D537CD2DC94890CE60E875E09A95D9B7E5FDA6B6EFE7D6784B77D8D96F0EDDE1B5A3AF66D85AF4D9B627353F18EF7D3CAB73F`, `.blockmap`, `latest.yml`)
- **Commit**: `cd561a4` (fix) + `9e80402` (docs wiki)
- **Nota**: electron-builder publicó 2 drafts con assets partidos (bug conocido) — se limpiaron y la release se creó manualmente con `gh release create`; el draft residual de v1.1.6 también se eliminó
- **Pendiente**: confirmar en la máquina desplegada; pedir al operador el resultado del botón "Reparar" (exit code) o "Copiar diagnóstico" si falla

## [2026-08-01] diagnose | Diagnóstico v1.1.7 desplegado — build cacheado también crashea → OOM crónico; binario desplegado ≠ release
- **Fuente**: operador — diagnóstico post-instalación v1.1.7 (header `app v1.1.7`, sentinel `Saved server image version: 1.1.7`)
- **Páginas tocadas**: [[diagnostico-error-3001-post-update]]
- **Hallazgos**: (1) la línea `Server container: ...restarts=7` **NO incluye `oomKilled`**, aunque el tag v1.1.7 (`git show v1.1.7:src/main/index.ts`) sí lo imprime → el binario desplegado no es el release publicado (probable instalación obsoleta; se resuelve con reinstall limpio); (2) el build v1.1.7 fue casi todo CACHED (export 1.1s vs 16.5s) y el contenedor **igual crasheó en `prisma db push`** → **descarta el pico de RAM por build**; (3) la salida vuelve a cortar en `Datasource "db": ... at db:5432` sin error → **OOM crónico por RAM insuficiente de WSL2** (máquina siempre al límite, no solo durante el build).
- **Implicación**: la causa es memoria insuficiente de Docker Desktop (no la app). Fix dual: (a) subir RAM de Docker Desktop ≥4096 MB (GUI), (b) auto-reparación en la app para que el push one-shot tenga máxima probabilidad de éxito (detener el contenedor en crash antes del push libera memoria).

## [2026-08-01] release | v1.1.8 publicada — auto-reparación sin botón + entrypoint endurecido
- **Descripción**: el operador ya no debe pulsar "Reparar": ante `container-crashed` la app ejecuta `runSelfHeal()` automáticamente y solo si falla muestra el diálogo con la causa clasificada. Se detiene el contenedor en crash-loop antes del push one-shot (libera node+prisma en colisión). Entrypoint endurecido: si `prisma db push` falla imprime el exit code y sale con ese código (fin del crash silencioso); el hash de schema solo se escribe si el push tuvo éxito.
- **Cambios clave**:
  - `index.ts`: `selfHealAttempted` (1 intento automático por sesión); auto-heal en `backendResult.status === 'container-crashed'`; diálogo final sin botón "Reparar" (`['Reintentar', 'Copiar diagnóstico', 'Salir']`); `gatherDiagnostics` +`exitCode` + `docker system df`
  - `docker.ts`: `stopServerContainer()` (`compose stop server`), `getDockerSystemDf()`
  - `docker-entrypoint.sh`: `! npx prisma db push 2>&1; rc=$?` → echo exit + `exit $rc`; hash solo si push OK
- **Verificación**: typecheck limpio, 113/113 tests, eslint 0 errores en archivos tocados
- **Release**: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.8 (assets: `silver-knight-1.1.8-setup.exe` sha512 `8F5D6335C6DB9ED12538F24F60E0EFE892919400489C04B76BAB1D69C9049F33895D823A0D7F5784FD391DC102955659FC638F60E6F32A1D1DB9FA8E441B5372`, `.blockmap`, `latest.yml`)
- **Pendiente**: operador desinstala Silver Knight (Settings → Apps → Silver Knight → Uninstall) e instala v1.1.8 limpio; si el diálogo clasifica exit 137 → subir RAM de Docker Desktop ≥4096 MB; si el push one-shot tiene éxito → hash escrito → servidor arranca sin terminal

## [2026-08-01] diagnose | CAUSA CONFIRMADA: P1000 (autenticación), NO OOM — el error siempre estuvo en stderr
- **Fuente**: operador — diagnóstico v1.1.8 completo (logs del contenedor ahora con `2>&1`)
- **Páginas tocadas**: [[diagnostico-error-3001-post-update]]
- **Hallazgos**: (1) los logs del contenedor muestran por fin el error real: `Error: P1000: Authentication failed against database server, the provided database credentials for silverknight are not valid`; (2) la contraseña del `.env` (`%APPDATA%\silver-knight\config\.env`) NO coincide con la que usó el volumen `silverknight-pgdata` al inicializarse; (3) la contraseña original fue **generada aleatoriamente** en la instalación inicial y nunca se mostró → el operador no la sabe; (4) la contraseña original quedó "quemada" en el volumen cuando el wizard no detectó el volumen existente (`detectExistingDockerVolume` requiere Docker corriendo) y generó una nueva.
- **Bug propio descubierto (v1.1.8)**: el entrypoint imprimía `exit code 0` en fallos — `if ! npx prisma db push ...; then rc=$?` captura el `$?` de la negación (0), no del comando. Se corrige en v1.1.9 (`npx ... 2>&1; rc=$?; if [ $rc -ne 0 ]`).
- **Bloqueo de UX**: el wizard `EnvSetupPage` solo aparece si `config.exists()` es falso; como la config existe (con contraseña mala), el operador no tenía ningún botón para corregir la contraseña.
- **Descartado definitivamente**: OOM / subir RAM de Docker Desktop (la salida cortada era solo stderr no capturado).

## [2026-08-01] release | v1.1.9 publicada — restablecer contraseña de Postgres conservando datos
- **Descripción**: ante P1000 el diálogo ofrece **"Restablecer contraseña"**: la app genera una contraseña nueva, la aplica al volumen existente vía `docker compose exec -T db psql -U postgres -c "ALTER USER ..."` (la imagen postgres permite conexión local por unix socket con `trust`, sin tocar `pg_hba.conf` → NO se pierde ningún dato), guarda la nueva contraseña en `.env` preservando el resto (`savePostgresPassword`), y relanza `startBackend()` (compose `up -d` recrea el contenedor server con la nueva DATABASE_URL).
- **Cambios clave**:
  - `docker.ts`: `resetPostgresPassword(newPassword)` (exec spawn con shell:true y SQL entrecomillada para el shell)
  - `config.ts`: `generatePassword` exportada; `savePostgresPassword(password)` (solo actualiza POSTGRES_PASSWORD + DATABASE_URL)
  - `index.ts`: `runResetPassword()`; flujo de fallo reestructurado — `isAuthProblem` (P1000/auth desde logs o mensaje del self-heal) → diálogo con botón "Restablecer contraseña"; fix del diagnóstico `authPattern` con P1000
  - `docker-entrypoint.sh`: fix del exit code (bug `if !` de v1.1.8)
- **Verificación**: typecheck limpio, 113/113 tests, eslint 0 errores en archivos tocados
- **Release**: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.9 (assets: `silver-knight-1.1.9-setup.exe` sha512 `94926E8D22C6807AA79B609EEA8102A0D0089BDA08BE229521C845B5B787436537C216542D6A46A544D4C383AD761881D0F19CDA57885B5A7FDCA8D2CE093B6F`, `.blockmap`, `latest.yml`)
- **Acción del operador**: instalar v1.1.9; si aparece el diálogo de P1000 → pulsar **"Restablecer contraseña"** (conserva datos) → la app cambia la contraseña de la BD y arranca.

## [2026-08-01] diagnose | Reset v1.1.9 falló: rol superusuario no es `postgres`
- **Fuente**: operador — diagnóstico v1.1.9 tras pulsar "Restablecer contraseña"
- **Páginas tocadas**: [[diagnostico-error-3001-post-update]]
- **Hallazgos**: (1) el flujo del botón funcionó: self-heal auto → P1000 → diálogo → operador pulsó "Restablecer contraseña"; (2) el ALTER falló con `psql: FATAL: role "postgres" does not exist` → el superusuario de la BD es `silverknight` (el `POSTGRES_USER`), no `postgres`; (3) el trust por unix-socket SÍ funciona (el error aparece tras la conexión/auth) → el mecanismo es correcto, solo el nombre del rol estaba hardcodeado; (4) el operador quedó en loop reset→reintentar→reset.
- **Fix v1.1.10**: `resetPostgresPassword` usa `loadEnvForChild()['POSTGRES_USER'] || 'silverknight'` para `psql -w -U <user> -c "ALTER USER <user> PASSWORD ..."`. Un rol siempre puede cambiar su propia contraseña → funciona aunque `silverknight` no fuera superusuario.

## [2026-08-01] release | v1.1.10 publicada — reset con el rol correcto
- **Descripción**: corrige el reset de contraseña para usar el usuario de la BD configurado (`POSTGRES_USER`, p. ej. `silverknight`) en vez del hardcodeado `postgres`. El resto del flujo (self-heal auto, botón en diálogo P1000, `savePostgresPassword`, recreate del server con la nueva DATABASE_URL) ya funcionaba.
- **Cambios clave**: `docker.ts` `resetPostgresPassword` → `pgUser = loadEnvForChild()['POSTGRES_USER'] || 'silverknight'`; psql con `-w` (no preguntar contraseña, fallar rápido) y `-U <pgUser>`; SQL `ALTER USER <pgUser> PASSWORD '...'`.
- **Verificación**: typecheck limpio, 113/113 tests, eslint 0 errores en archivos tocados
- **Release**: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.10 (assets: `silver-knight-1.1.10-setup.exe` sha512 `2ECB18C93EFC589F12CA332234971E718F08F9BE5741A703868F329FAA0C65D482BB74FC0D96D34108ED0AC1DDE20DBF748092DC84AC95F4D42BB05919593448`, `.blockmap`, `latest.yml`)
- **Acción del operador**: instalar v1.1.10; si el diálogo P1000 aparece → "Restablecer contraseña" (ahora usa el rol correcto) → la app arranca.

## [2026-08-01] fix | Auditoria de optimizacion — cuelgues aleatorios durante el uso
- **Descripcion**: auditoria read-only del stack (renderer/server/main) por cuelgues al azar con perfil pequeno. Diagnostico + fixes anti-hang aplicados (sin tocar fuentes inmutables ni planning/).
- **Paginas creadas**: [[auditoria-optimizacion-cuelgues]]
- **Paginas actualizadas**: [[index]]
- **Hallazgos**: (1) ppendFileSync en cada log del hilo main (causa mas probable de congelamientos al azar; log sin rotacion + Defender); (2) ipcRenderer.sendSync en preload (getUpdateStatus/getVersion); (3) sin timeout/AbortSignal en ningun fetch del renderer (pi.ts) → UI en "Cargando..." infinito; (4) waitForServer sin timeout por intento; (5) fetch de sync remoto sin timeout; (6) ReportsPage re-descargaba en cada cambio de fecha; (7) queries sin 	ake/select en reports/iva/dashboard/customers (baja urgencia con datos pequenos).
- **Fixes aplicados**: logger.ts async (buffer + ppendFile en cola, flush 50 lineas/1s, rotacion 5MB x3, lushLogsSync en efore-quit); pi.ts timeout global 15s via AbortController + 	imeoutMs por llamada; AuthProvider pi.health(5000) + flag cancelled; ReportsPage effect solo en cambio de tab + race guard por secuencia; preload sin sendSync (invoke async) + handlers sync removidos en updater; syncService AbortSignal.timeout(30000) en push remoto.
- **Verificacion**: typecheck limpio, 113/113 tests, electron-vite build OK, 0 errores eslint en archivos tocados.
- **Pendiente recomendado**: paginacion/select en reports/iva/dashboard/customers, indices ExchangeRate.date y SyncLog.createdAt, debounce en busquedas, regex de parseBcvRate, execSync async en before-quit.

## [2026-08-01] release | v1.1.11 publicada — optimizaciones anti-hang
- **Descripcion**: corrige cuelgues aleatorios durante el uso (perfil pequeno). Fixes de la auditoria de optimizacion: (1) timeout global 15s en todos los fetch del renderer via AbortController (pi.ts) — la UI ya no queda en "Cargando..." infinito; (2) logger del proceso main asincrono (buffer + cola ppendFile, flush 50 lineas/1s, rotacion 5MB x3, lushLogsSync en efore-quit) — elimina el bloqueo sincrono por cada log; (3) eliminado ipcRenderer.sendSync del preload (bloqueaba el renderer); (4) AuthProvider health-check con timeout por intento (5s) + flag cancelled; (5) ReportsPage ya no re-descarga en cada cambio de fecha y tiene race guard por secuencia; (6) sync con AbortSignal.timeout(30000) en fetch remoto; (7) fix en workflow elease.yml (ahora corre 
pm run build antes de electron-builder — los CI de v1.1.9/v1.1.10 fallaban por falta del build).
- **Paginas tocadas**: [[auditoria-optimizacion-cuelgues]], [[index]]
- **Verificacion**: typecheck limpio, 113/113 tests, build OK; CI release en GitHub Actions: success.
- **Release**: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.11 (assets: silver-knight-1.1.11-setup.exe sha512 qIb27fFzVICBhFbofpuQnkpLP3wzCZmIyXb1pz/98r51EPsDTGmjfytxGuliIyzytNN2DGCAMpREPYCF4N9ZdA==, .blockmap, latest.yml)
- **Accion del operador**: instalar silver-knight-1.1.11-setup.exe (o esperar el aviso de actualizacion en la app). Si persiste algun cuelgue, revisar %APPDATA%\silver-knight\logs\main.log por Window became unresponsive / RENDER PROCESS GONE.

## [2026-08-01] fix | CRLF rompia docker-entrypoint.sh (server exit 255, bug v1.1.11)
- **Descripcion**: tras actualizar a v1.1.11 el contenedor silverknight-server entraba en crash loop (exit 255, oomKilled=false) sin ningun log. Diagnostico: el instalador v1.1.11 empaqueta docker-entrypoint.sh con CRLF (el checkout de CI en Windows convierte LF->CRLF porque no habia .gitattributes). Al construir la imagen en la maquina del usuario desde resources/, el shebang #!/bin/sh\r no existe -> el contenedor muere al instante sin output. El one-shot prisma db push funcionaba porque usa --entrypoint npx (binario, evita el script). v1.1.10 (verificado extrayendo ambos setups con 7-Zip): docker-entrypoint.sh LF correcto; v1.1.11: 39 pares CRLF.
- **Fix aplicado**: .gitattributes en la raiz (text eol=lf para *.sh, Dockerfile, *.yml, *.yaml, *.prisma) + RUN sed -i 's/\r$//' /docker-entrypoint.sh en Dockerfile (defensa definitiva aunque el source llegue CRLF).
- **Verificacion**: extraido silver-knight-1.1.11-setup.exe y 1.1.10-setup.exe con 7-Zip -> CRLF 39 vs 0 en docker-entrypoint.sh; blob en git es LF puro.
- **Paginas tocadas**: [[docker-deployment]]
## [2026-08-02] release | v1.1.12 publicada - fix CRLF docker-entrypoint.sh
- **Descripcion**: corrige el crash loop del server (exit 255) introducido por v1.1.11. El instalador v1.1.11 empaqueto docker-entrypoint.sh con CRLF (checkout CI en Windows sin .gitattributes); el shebang #!/bin/sh no era valido y el contenedor server moria sin logs. Fix: .gitattributes (text eol=lf para *.sh, Dockerfile, *.yml, *.yaml, *.prisma) + RUN sed -i 's/\r$//' en Dockerfile.
- **Paginas tocadas**: [[diagnostico-server-exit-255-crlf]], [[docker-deployment]], [[index]]
- **Verificacion**: extraido setup v1.1.12 con 7-Zip -> docker-entrypoint.sh CRLF=0 (antes v1.1.11: 39, v1.1.10: 0). CI release success 2m48s (run 30729006469). /releases/latest -> v1.1.12. latest.yml correcto.
- **Nota operacional**: electron-builder crea la release como draft y no la publica ni marca Latest ni sube .blockmap; hay que ejecutar manualmente: gh release edit v1.1.12 --draft=false --latest. Sin blockmap la actualizacion usa descarga completa (funciona, no diferencial).
- **Release**: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.12
- **Accion del operador**: instalar v1.1.12 (auto-update o setup manual). La imagen server se reconstruye con el entrypoint LF.

## [2026-08-02] fix | Auto-publicacion de releases en CI (fin del draft manual)
- **Descripcion**: eliminado el trabajo manual de publicar cada release. electron-builder (--publish always) crea la release como **draft**, no marca Latest y pierde el blockmap (sube assets antes de crear la release). Nuevo paso "Finalize release (publish + latest + blockmap)" en `.github/workflows/release.yml` con `shell: bash` (los runners Windows usan pwsh por defecto): `gh release edit <ref> --draft=false --latest` + `gh release upload <ref> dist/*.blockmap --clobber`.
- **Paginas tocadas**: [[diagnostico-server-exit-255-crlf]], [[index]]
- **Verificacion**: CI success (run 30729322485). v1.1.12 ahora con isDraft=false, blockmap subido (02:46:13), /releases/latest -> v1.1.12. Primer intento fallo por sintaxis bash en shell pwsh (ParserError Missing '(') -> corregido con shell:bash.
- **Commits**: `d527b01` (finalize step), `157545e` (shell: bash). Tag v1.1.12 re-apuntado a 157545e.
- **Nota**: futuras releases quedan publicadas y Latest automaticamente; ya no se necesita `gh release edit` manual.