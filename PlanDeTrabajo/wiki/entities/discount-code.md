---
type: entity
tags: [discount-code, discount, pricing, promotions]
created: 2026-10-06
updated: 2026-10-06
sources: [db-schema]
---

# Discount Code

Un **DiscountCode** define un descuento porcentual sobre el carrito que el operador puede aplicar en el **[[pos|POS]]** ingresando un código al momento del cobro. Se configura desde el **panel de gestión** en `/discount-codes` (accesible desde Ajustes → Códigos de Descuento). Cada uso se registra en **DiscountUsage**, lo que permite límites globales y por cliente.

## Atributos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| code | string (unique) | Código público (mayúsculas, autogenerable) |
| description | string/null | Descripción interna de la campaña |
| discountType | string | `PERCENTAGE` (único tipo soportado hasta 2026-10-06) |
| discountValue | float | Porcentaje de descuento, 1–100 |
| validFrom / validUntil | datetime/null | Ventana de validez; **"hasta"** se interpreta hasta el fin de ese día |
| minSubtotal / minQuantity | float/int/null | Condiciones mínimas del carrito |
| currency | VES / USD | Moneda para evaluar `minSubtotal` |
| usageLimit / usedCount | int/null / int | Límite global de usos (`null` = ilimitado) |
| usagePerCustomer | int/null | Límite de usos por cliente (`null` = sin límite) |
| requireCustomer | bool | Exige cliente seleccionado para usar el código |
| scope | ALL / PRODUCTS / CATEGORIES | Sobre qué se calcula: todo el carrito, productos o categorías específicas |
| productIds / categoryIds | json/null | Elementos incluidos cuando `scope != ALL` |
| maxDiscountAmount | float/null | Tope máximo del descuento por factura |
| isActive | bool | Acepta el código en el POS |
| deletedAt | datetime/null | Soft-delete (se conserva si el código ya fue usado) |

El modelo vive en `prisma/schema.prisma` (`DiscountCode` + `DiscountUsage`) y el CRUD/validación en `src/server/routes/discountCodes.ts` + `src/server/utils/discounts.ts`.

## Reglas de validación (server-side, `POST /validate`)

- Errores tipificados: `NOT_FOUND`, `DELETED`, `INACTIVE`, `NOT_YET_VALID`, `EXPIRED`, `USAGE_LIMIT_EXCEEDED`, `CUSTOMER_REQUIRED`, `CUSTOMER_USAGE_LIMIT_EXCEEDED`, `MIN_SUBTOTAL_NOT_MET`, `MIN_QUANTITY_NOT_MET`, `NO_ELIGIBLE_ITEMS`.
- El descuento se calcula sobre el **subtotal elegible**: si `scope = ALL` todo el carrito; si es por productos/categorías, solo la suma de las líneas que matchean (el server exige `items[]` con `productId`/`categoryId`).
- `maxDiscountAmount` acota el monto final del descuento.
- El registro de uso (`DiscountUsage`) se crea al emitir la [[invoice|factura]], vinculando cliente + código + montos descontados (USD/VES).

## Historial

- **2026-10-06**: panel de gestión completo en `/discount-codes` (rebuild de la página): todos los parámetros configurables, incluida la selección de **productos/categorías** para códigos con alcance restringido (antes imposible desde UI — el formulario no enviaba `productIds`/`categoryIds`). Tabs por estado + búsqueda + paginación, toggle rápido activo/inactivo, copiar código. Acceso desde Ajustes. Fix en el **POS**: el carrito ahora envía `categoryId` en el `validate` (antes el alcance por categorías nunca aplicaba).

## Relaciones

- **[[invoice|Invoice]]**: `discountCodeId` + `discountValue` + montos descontados (USD/VES); uso registrado en `DiscountUsage`.
- **[[customer|Customer]]**: usos por cliente (`usagePerCustomer`) contados vía `DiscountUsage.customerId`.
- **[[product|Product]]** / **[[category|Category]]**: base del alcance restringido (`productIds` / `categoryIds`).