# Bug Fixes — Post-Fase 1

> Plan de resolución de bugs encontrados tras auditoría de código (Julio 2026).

---

## 🔨 Etapa B1 — Integridad Fiscal y Consistencia de Datos

| # | Tarea | Prioridad | Estado |
|---|-------|-----------|--------|
| B1.1 | Race condition en numeración CF | 🔴 Alta | ✅ |
| B1.2 | Cash-close usa UTC | 🔴 Alta | ✅ |
| B1.3 | Validar stock al crear factura | 🔴 Alta | ✅ |

## 🔨 Etapa B2 — Seguridad y Estabilidad

| # | Tarea | Prioridad | Estado |
|---|-------|-----------|--------|
| B2.1 | JWT secret seguro | 🔴 Alta | ✅ |
| B2.2 | Detener scheduler al cerrar | 🟠 Media | ✅ |
| B2.3 | Shell escaping en printer | 🟠 Media | ✅ |
| B2.4 | Control de acceso por rol | 🟠 Media | ✅ |

## 🔨 Etapa B3 — Corrección de Datos y Queries

| # | Tarea | Prioridad | Estado |
|---|-------|-----------|--------|
| B3.1 | IVA Ventas filtrar anuladas | 🟠 Media | ✅ |
| B3.2 | Product update: evitar NaN en precios | 🟠 Media | ✅ |
| B3.3 | Error P2002 en FiscalControl con mensaje preciso | 🟢 Baja | ✅ |
| B3.4 | POS: validar stock en frontend | 🟢 Baja | ✅ |

## 🔨 Etapa B4 — Dead Code y Limpieza

| # | Tarea | Prioridad | Estado |
|---|-------|-----------|--------|
| B4.1 | CashRegister: deprecado en schema | 🟢 Baja | ✅ |
| B4.2 | CSP en producción | 🟢 Baja | ✅ |
| B4.3 | Gitignore graphify-out | 🟢 Baja | ✅ |
| B4.4 | ensureDefaultControl multi-tipo | 🟢 Baja | ✅ |

---

**Total: 15 tareas**
