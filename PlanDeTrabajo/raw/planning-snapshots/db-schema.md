# Esquema de Base de Datos

> Diseñado para SQLite (Small) y PostgreSQL (Medium/Big cloud).
> Todos los campos monetarios guardan USD y VES con la tasa de cambio del momento.

---

## Modelos

### Company

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| name | String | Razón social |
| rif | String | RIF de la empresa (J-X-XXXXXXXX-X) |
| address | String? | Dirección fiscal |
| phone | String? | Teléfono |
| email | String? | Correo electrónico |
| currency_default | String | 'VES' por defecto |
| logo_path | String? | Ruta al logo en la factura |
| created_at | DateTime | |

### User

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| username | String (unique) | Nombre de usuario |
| pin | String | PIN de 4-6 dígitos (hasheado) |
| full_name | String | Nombre completo del operador |
| role | String | 'admin' \| 'supervisor' \| 'operator' |
| active | Boolean | Si puede iniciar sesión |
| created_at | DateTime | |

### ExchangeRate

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| rate | Float | Tasa 1 USD = X VES |
| source | String | 'manual' \| 'bcv' |
| date | DateTime | Fecha de la tasa |
| created_at | DateTime | |

### Category

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| name | String | Nombre de la categoría |
| description | String? | |

### Product

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| code | String (unique) | Código interno del producto |
| barcode | String? | Código de barras (EAN-13, etc.) |
| name | String | Nombre del producto |
| description | String? | |
| category_id | String? | FK → Category |
| unit | String | 'UNIDAD', 'KG', 'LTS', etc. |
| price_usd | Float | Precio en dólares |
| price_ves | Float | Precio en bolívares |
| cost_usd | Float | Costo en dólares |
| cost_ves | Float | Costo en bolívares |
| stock | Float | Stock actual |
| min_stock | Float | Stock mínimo (alerta) |
| iva_percentage | Float | Porcentaje de IVA (16% default) |
| active | Boolean | Producto activo/inactivo |
| created_at | DateTime | |
| updated_at | DateTime | |

### Customer

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| rif | String? | RIF del cliente (V/J-E-XXXXXXXX-X) |
| name | String | Nombre o razón social |
| address | String? | Dirección |
| phone | String? | |
| email | String? | |
| credit_limit_usd | Float | Límite de crédito en USD |
| credit_limit_ves | Float | Límite de crédito en VES |
| active | Boolean | |
| created_at | DateTime | |

### Invoice

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| invoice_number | Int | Número correlativo por talonario |
| control_number | String | Número de control (CF) |
| document_type | String | 'factura' \| 'nota_credito' \| 'nota_debito' |
| customer_id | String? | FK → Customer |
| customer_name | String | Nombre al momento de facturar (denormalizado) |
| customer_rif | String? | RIF al momento de facturar |
| currency | String | Moneda de la factura: 'USD' \| 'VES' |
| exchange_rate | Float | Tasa usada al facturar |
| subtotal_usd | Float | |
| subtotal_ves | Float | |
| iva_usd | Float | |
| iva_ves | Float | |
| total_usd | Float | Total en USD |
| total_ves | Float | Total en VES |
| payment_method | String | 'cash_usd' \| 'cash_ves' \| 'transfer' \| 'pos' \| 'mixed' |
| payment_detail | String? | JSON con detalles de pago (mixto) |
| status | String | 'active' \| 'cancelled' |
| cancellation_reason | String? | Motivo de anulación |
| created_by_id | String | FK → User |
| created_at | DateTime | |
| cancelled_at | DateTime? | |

### InvoiceItem

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| invoice_id | String | FK → Invoice |
| product_id | String? | FK → Product |
| product_name | String | Nombre al facturar (denormalizado) |
| quantity | Float | Cantidad |
| price_usd | Float | Precio unitario en USD |
| price_ves | Float | Precio unitario en VES |
| subtotal_usd | Float | price_usd × quantity |
| subtotal_ves | Float | price_ves × quantity |
| iva_percentage | Float | % de IVA aplicado |
| iva_usd | Float | IVA en USD |
| iva_ves | Float | IVA en VES |

### CashRegister

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| user_id | String | FK → User |
| opening_amount_usd | Float | Monto inicial en USD |
| opening_amount_ves | Float | Monto inicial en VES |
| closing_amount_usd | Float? | Monto final en USD |
| closing_amount_ves | Float? | Monto final en VES |
| opened_at | DateTime | |
| closed_at | DateTime? | |
| status | String | 'open' \| 'closed' |
| notes | String? | Notas del cierre |

### Setting

| Campo | Tipo | Descripción |
|-------|------|-------------|
| key | String (unique) | Identificador de la configuración |
| value | String | Valor (JSON serializado) |

Ejemplos de settings:
- `profile` → `"small"`
- `printer_name` → `"TM-T20"`
- `printer_width` → `"42"`
- `invoice_header` → `"Gracias por su compra"`
- `invoice_footer` → `"Silver Knight C.A."`
- `auto_exchange_rate` → `"true"`
- `branch_name` → `"Sucursal Principal"`
- `pos_number` → `"1"`
- `invoice_series` → `"A"`

---

## Relaciones

```
Company ── tiene ──> User (varios)
Company ── tiene ──> Setting (varios)
Product ── pertenece ──> Category (opcional)
Invoice ── tiene ──> InvoiceItem (varios)
Invoice ── pertenece ──> Customer (opcional)
Invoice ── creada por ──> User
CashRegister ── pertenece ──> User
```
