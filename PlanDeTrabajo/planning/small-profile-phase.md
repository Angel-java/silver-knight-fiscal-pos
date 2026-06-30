# Fase 1 — Perfil Small: Plan Detallado

> **Duración estimada**: 10 etapas, ~60 tareas
> **Objetivo**: POS funcional en 1 máquina, inventario, facturación fiscal, doble moneda

---

## Dependencia entre etapas

```
1.1 Scaffolding
    └── 1.2 DB Schema
           ├── 1.3 Auth + Setup
           │     ├── 1.4 Productos
           │     │    └── 1.5 POS ──┐
           │     │                  ├── 1.7 Fiscal ── 1.8 Reports
           │     └── 1.6 Clientes ──┘
           └── 1.9 Config ── 1.10 Impresión
```

---

## Cómo trabajar cada etapa

Cada etapa sigue este proceso:
1. **Backend**: Crear/rutas endpoints en Express + validación
2. **Frontend**: Crear/páginas y componentes en React
3. **Integración**: Conectar frontend con API via TanStack Query
4. **Verificación**: Probar flujo completo manualmente

---

## Detalle de endpoints API por etapa

### 1.3 — Auth
```
POST   /api/auth/login          { username, pin } → { token, user }
POST   /api/auth/setup          { company, adminUser } → { token, user }
GET    /api/auth/me             → { user }
GET    /api/company             → { company }
```

### 1.4 — Productos
```
GET    /api/products            ?search=&category=&page=
GET    /api/products/:id
POST   /api/products            { ...product }
PUT    /api/products/:id
PATCH  /api/products/:id/stock  { quantity, type }
GET    /api/categories
POST   /api/categories
PUT    /api/categories/:id
DELETE /api/categories/:id
```

### 1.5 — POS
```
GET    /api/pos/search          ?q= (búsqueda rápida de productos)
POST   /api/pos/invoice         { items, customer, currency, payments }
GET    /api/pos/last-invoices   ?limit=
GET    /api/pos/invoice/:id
POST   /api/pos/invoice/:id/reprint
```

### 1.6 — Clientes
```
GET    /api/customers           ?search=
GET    /api/customers/:id
POST   /api/customers
PUT    /api/customers/:id
GET    /api/customers/:id/invoices
```

### 1.7 — Fiscal
```
POST   /api/fiscal/cancel-invoice   { id, reason }
GET    /api/fiscal/iva-book-sales   ?from=&to=
GET    /api/fiscal/iva-book-purchases ?from=&to=
GET    /api/fiscal/control-numbers  (talonarios)
```

### 1.8 — Reports
```
GET    /api/reports/dashboard
GET    /api/reports/sales       ?from=&to=&currency=
GET    /api/reports/inventory
GET    /api/reports/top-products ?from=&to=
POST   /api/cash-register/open  { amounts }
POST   /api/cash-register/close { amounts }
GET    /api/cash-register/current
```

### 1.9 — Settings
```
GET    /api/settings
PUT    /api/settings            { key, value }
GET    /api/exchange-rates      ?latest=true
POST   /api/exchange-rates      { rate, source }
POST   /api/exchange-rates/fetch-bcv  (auto desde BCV)
```

Ver resumen en la wiki: [[small-profile-phase]]
