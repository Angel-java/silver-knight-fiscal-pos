---
type: overview
tags: [log, chronology]
created: 2026-06-30
updated: 2026-07-03
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
