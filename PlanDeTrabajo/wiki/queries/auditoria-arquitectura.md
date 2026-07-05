---
type: query
tags: [audit, architecture, review]
created: 2026-07-04
updated: 2026-07-04
sources: [architectural-decisions, db-schema, small-profile-phase]
---

# Auditoría de Arquitectura — Silver Knight (Julio 2026)

> **Estado del proyecto**: Fase 1 (Small Profile) completada — 70/70 tareas ✅
> **Tech stack**: Electron 35 + React 19 + Express 5 + Prisma 6 + SQLite + TailwindCSS 4

---

## 1. Vista General — Puntuación por dimensión

| Dimensión | Puntuación | Estado |
|-----------|-----------|--------|
| Separación de capas | 9/10 | Sólido |
| Escalabilidad futura | 8/10 | Bueno |
| Calidad del código backend | 7/10 | Aceptable |
| Calidad del código frontend | 6/10 | Mejorable |
| Modelado de datos | 8/10 | Bueno |
| Seguridad | 6/10 | Mejorable |
| Testing | 0/10 | Crítico |
| Documentación | 8/10 | Bueno |
| **Global** | **6.5/10** | **Sólido con deudas técnicas puntuales** |

---

## 2. Fortalezas Arquitectónicas

### 2.1 Separación de capas (ADR-001, ADR-004)
- **Electron main process + Express embebido + React SPA**: Separación neta entre UI y lógica de negocio.
- El frontend se comunica por HTTP (`localhost:3001`), lo que permite migrar a Medium/Big cambiando solo la URL base.
- La API REST es idéntica en todos los perfiles — el core de negocio es portable.

### 2.2 Dual Currency nativo (ADR-003)
- `Product`, `Invoice`, `InvoiceItem` almacenan **ambos valores** (USD y VES) + tasa de cambio histórica.
- No hay conversión en tiempo real — se congela la tasa al momento de la transacción.
- Los reportes pueden mostrar en cualquier moneda.

### 2.3 Fiscal compliance desde el día 1 (ADR-005)
- Numeración CF con control de rangos, resoluciones SENIAT, notas de crédito/débito.
- `FiscalControl` model + `nextControlNumber()` dentro de transacciones Prisma para race-condition safety.
- Libros IVA (ventas/compras) implementados.

### 2.4 Prisma ORM con migraciones
- Schema único que migra de SQLite a PostgreSQL sin cambiar queries.
- 3 migraciones evolutivas con cambios incrementales.

### 2.5 Auth con JWT + fallback de secret
- `resolveJwtSecret()` busca en env → DB → genera automáticamente.
- Middleware `authMiddleware` + `adminMiddleware` limpios y reutilizables.

---

## 3. Problemas y Deudas Técnicas

### 3.1 Backend — Error handling (Severidad: ALTA)

**Problema**: Cada route handler tiene try/catch repetitivo:
```typescript
try {
  // ...
} catch (error) {
  console.error('[route] error:', error)
  res.status(500).json({ error: 'Error interno del servidor' })
}
```

**Impacto**: 15 rutas × ~3 endpoints = ~45 try/catch duplicados. Cualquier cambio en el formato de error requiere editar 45 lugares. No hay un error handler centralizado de Express.

**Solución**: Implementar middleware de error de Express:
```typescript
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || 'Error interno' })
})
```
Y lanzar errores con `next(err)` o usar `express-async-errors`.

---

### 3.2 Frontend — `API_BASE` hardcoded (Severidad: ALTA)

**Problema**: `src/renderer/src/lib/api.ts:1`:
```typescript
const API_BASE = 'http://localhost:3001/api'
```

**Impacto**: Viola ADR-004 (misma API en todos los perfiles). Para Medium/Big, la URL debe ser configurable. Obliga a recompilar el frontend para cambiar de perfil.

**Solución**: Leer la URL base de `localStorage`, `window.electron` (preload), o una variable de entorno, con fallback a localhost.

---

### 3.3 Sin tests (Severidad: CRÍTICA)

**Problema**: `package.json` no tiene script de test. No hay dependencias de testing (`vitest`, `jest`, `playwright`). Cero cobertura.

**Impacto**: Cada bugfix o refactor es un volado. No hay red de seguridad para cambios.

**Solución**: Agregar `vitest` para tests unitarios backend (rutas + servicios), `@testing-library/react` para componentes frontend. Prioridad: lógica fiscal (invoices, fiscalControl) > auth > CRUD.

---

### 3.4 Validación de entrada manual (Severidad: MEDIA)

**Problema**: Toda validación es inline en cada route handler. No hay schemas declarativos (Zod, Joi).

```typescript
if (!username || !pin) {
  res.status(400).json({ error: 'Username y PIN requeridos' })
  return
}
```

**Impacto**: Riesgo de errores de validación inconsistentes. Mayor superficie para bugs de tipo.

**Solución**: Implementar Zod schemas en las rutas críticas (invoices, auth, products) con middleware de validación.

---

### 3.5 `ensureDefaultControl` en GET (Severidad: MEDIA)

**Problema**: `routes/fiscalControl.ts:40` — `ensureDefaultControl()` se llama en cada `GET /fiscal-control`, lo que crea registros default como side-effect de una operación de lectura.

**Impacto**: Efecto secundario silencioso en una request GET. Puede crear controles default incluso si el admin no los ha configurado.

**Solución**: Llamar `ensureDefaultControl()` solo en `POST /invoices` (cuando se necesita el control) o en un setup inicial, no en la lista GET.

---

### 3.6 POSPage monolítico (Severidad: MEDIA)

**Problema**: `POSPage.tsx` tiene **647 líneas**, un solo componente maneja: búsqueda de productos, grid, carrito, selección de cliente (modal), pagos (modal), integración POS, creación de factura.

**Impacto**: Difícil de mantener, testear, y reutilizar. Estado mezclado entre sub-componentes.

**Solución**: Extraer:
- `ProductGrid` — grid de productos
- `CartPanel` — carrito con items y totales
- `CustomerModal` — selección de cliente
- `PaymentModal` — división de pagos + integración POS
- `POSPage` como orquestador que solo coordina estos 4

---

### 3.7 Seguridad (Severidad: MEDIA)

| Issue | Archivo | Riesgo |
|-------|---------|--------|
| `sandbox: false` | `src/main/index.ts:30` | Electron sin sandbox — permite acceso a Node.js desde renderer vía preload |
| CORS abierto | `src/main/server/index.ts:27` | `app.use(cors())` sin origen específico |
| Sin rate limiting | `routes/auth.ts` | Login sin protección contra brute force |
| JWT secret en DB | `middleware/auth.ts` | Si alguien accede a SQLite, tiene el secret |
| `dangerouslySetInnerHTML` | `InvoiceViewPage.tsx:467` | Vector XSS potencial (bajo riesgo por ser datos locales) |

**Solución**: Activar `sandbox: true` (requiere refactor del preload), configurar CORS con origen específico, implementar `express-rate-limit` en `/auth/login`.

---

### 3.8 Performance — Sin índices en SQLite (Severidad: BAJA-MEDIA)

**Problema**: El schema Prisma no define índices adicionales más allá de los de unique/PRIMARY KEY. Campos como `Invoice.status`, `Invoice.documentType`, `Invoice.createdAt`, `InvoiceItem.invoiceId` no tienen índices explícitos.

**Impacto**: Con miles de facturas, las queries de reportes y Libros IVA harán full-table scans.

**Solución**: Agregar índices:
```prisma
model Invoice {
  @@index([status, documentType, createdAt])
}
model InvoiceItem {
  @@index([invoiceId])
}
```

---

### 3.9 CashRegister no implementado (Severidad: BAJA)

**Problema**: El modelo `CashRegister` está marcado `@deprecated` en schema pero no tiene rutas API ni UI. Queda como deuda técnica documentada.

**Solución**: Implementar en Fase 2 o eliminar del schema si no se planea usar.

---

### 3.10 BCV Scheduler — Polling ineficiente (Severidad: BAJA)

**Problema**: `scheduler.ts` hace poll cada 60 segundos y verifica si la hora actual coincide con una hora configurada. Esto es un polling ciego cada minuto.

**Impacto**: Ineficiente pero aceptable para un sistema desktop con recursos locales. No es problema real para 1 usuario.

**Solución**: Usar `node-cron` para ejecutar en horarios exactos en vez de polling.

---

## 4. Deudas Técnicas Menores

| Issue | Archivo | Detalle |
|-------|---------|---------|
| Payments como JSON string | `Invoice.payments` | Se parsea manualmente en 4+ lugares. Crear helper `parsePayments()` |
| `req.params.id as string` | Varios | Express 5 tipa `req.params` como `Record<string, string>` — el cast es innecesario |
| `page`/`skip`/`take` manual | Varios | No hay helper de paginación reutilizable |
| `useEffect` debounce manual | POSPage, CustomersPage | `setTimeout`/`clearTimeout` repetido. Extraer hook `useDebounce` |
| Sin `React.memo`/`useMemo` | POSPage | `subtotalUsd`, `ivaUsd`, etc. se recalculan en cada render |
| Sin variante `CartItem` para POS | POSPage | `CartItem` duplica lógica de `InvoiceItem` |
| `console.log` disperso | Varios | Logs de debugging que deberían ir a un logger estructurado o eliminarse |

---

## 5. Cumplimiento de ADRs

| ADR | Estado | Notas |
|-----|--------|-------|
| ADR-001: Electron + Express embebido | ✅ | Correcto |
| ADR-002: Prisma + SQLite | ✅ | Correcto, migrable a PG |
| ADR-003: Dual Currency nativo | ✅ | Correcto, ambos valores en cada entidad |
| ADR-004: Misma API en todos los perfiles | ⚠️ | `API_BASE` hardcoded en frontend (ver 3.2) |
| ADR-005: Fiscal desde inicio | ✅ | Correcto, 100% fiscal |

---

## 6. Scorecard por archivo

| Archivo | Líneas | Calidad | Observaciones |
|---------|--------|---------|---------------|
| `src/main/index.ts` | 96 | 8/10 | Clean, buen lifecycle |
| `src/main/server/index.ts` | 55 | 8/10 | Limpio, falta error middleware |
| `src/main/server/middleware/auth.ts` | 77 | 8/10 | Buen diseño |
| `src/main/server/printer.ts` | 258 | 7/10 | ESC/POS sólido, `printInvoice` mezcla lógica |
| `src/main/server/puntoVenta.ts` | 241 | 7/10 | Parseo de respuestas frágil |
| `src/main/server/syncService.ts` | 266 | 6/10 | Sin paginación, sin manejo de conflictos real |
| `src/main/server/scheduler.ts` | 85 | 5/10 | Polling ineficiente |
| `src/main/server/routes/invoices.ts` | 241 | 7/10 | Transacciones correctas, lógica densa |
| `src/main/server/routes/customers.ts` | 163 | 7/10 | Error handling de Prisma OK |
| `src/main/server/routes/auth.ts` | 147 | 7/10 | Limpio, setup transactional |
| `src/main/server/routes/exchangeRates.ts` | 129 | 6/10 | Scraping frágil, buen fallback |
| `src/main/server/routes/reports.ts` | 248 | 6/10 | Duplicación de lógica de agregación |
| `src/main/server/routes/fiscalControl.ts` | 119 | 6/10 | Side-effect en GET |
| `src/renderer/src/lib/api.ts` | 636 | 8/10 | Bien tipado, completo |
| `src/renderer/src/pages/POSPage.tsx` | 647 | 4/10 | Monolítico, sin tests, acoplado |
| `src/renderer/src/pages/InvoiceViewPage.tsx` | 473 | 5/10 | `dangerouslySetInnerHTML`, lógica duplicada |
| `src/renderer/src/pages/ReportsPage.tsx` | — | 6/10 | Similar a POS |
| `prisma/schema.prisma` | 188 | 8/10 | Buen diseño, índices faltantes |

---

## 7. Recomendaciones Priorizadas

### Inmediatas (Fase 1.5 — antes de pasar a Medium)
1. **Agregar tests** — `vitest` para backend, `@testing-library/react` para frontend. Cubrir invoices y auth primero.
2. **Centralizar error handling** — middleware de error de Express.
3. **Hacer `API_BASE` configurable** — para permitir ADR-004 sin recompilar.
4. **Rate limiting en login** — `express-rate-limit`.

### Corto plazo (antes de Fase 2)
5. **Refactor POSPage** — extraer componentes (`ProductGrid`, `CartPanel`, `PaymentModal`, `CustomerModal`).
6. **Zod validation** — schemas de validación para todos los inputs de API.
7. **Mover `ensureDefaultControl`** de GET a POST.
8. **Helper `parsePayments`** — DRY para deserialización de pagos.

### Mediano plazo
9. **Índices SQLite** — agregar `@@index` en Invoice y InvoiceItem.
10. **Hook `useDebounce`** — eliminar setTimeout manual repetido.
11. **Logger estructurado** — reemplazar `console.log`/`console.error` por `pino` o `winston`.
12. **Cache de JWT secret** — ya implementado en `cachedSecret`, correcto.
13. **CashRegister** — implementar o eliminar del schema.

### Largo plazo (para Fase 2 Medium Profile)
14. **Migrar a PostgreSQL** — Prisma provider swap.
15. **SyncService con paginación y conflict resolution** — para volúmenes reales.
16. **Dockerizar** backend para despliegue en servidor.
17. **CI/CD pipeline** — GitHub Actions con lint + typecheck + tests.
