---
type: concept
tags: [currency, usd, ves, exchange-rate, architecture]
created: 2026-06-30
updated: 2026-09-28
sources: [adr-003, db-schema]
---

# Dual Currency

Mecanismo nativo de doble moneda (USD/VES) en Silver Knight. Fuentes: [[architectural-decisions]], [[db-schema]].

## Principio

- **Catálogo dolarizado**: [[product|Product]], [[customer|Customer]] e [[inventory-movement|InventoryMovement]] guardan **solo USD**. Los montos VES del catálogo se calculan en vivo (precio/costo USD × tasa vigente) al registrar/editar y en la lista de productos; no se persisten.
- **Factura fiscal dual**: la [[invoice|Invoice]] congela los montos VES (`unitPriceVes`, `totalVes`, `ivaVes`) y la `exchangeRate` usada al momento de la transacción (ver [[exchange-rate]]). Esto es requisito SENIAT y no se recalcula nunca.
- El POS opera **mono-moneda USD** (lista de precios en USD); el equivalente VES se muestra en vivo con la tasa activa y la factura se emite dual (USD + VES congelados) con la tasa del momento. No existe un flujo de "factura solo en Bs.".
- La tasa se resuelve en el servidor con la regla anclada a la **fecha de la tasa** (la que publica la fuente o elige el operador; ver [[rate-validity]]). Si el body no trae `exchangeRate`, el servidor usa la tasa activa; si no hay ninguna registrada → error 400 `RATE_MISSING`. A diferencia del modelo anterior, la tasa vieja no bloquea: pide actualizar pero permite cobrar con confirmación.

## Regla de vigencia de la tasa y flujo de inserción (desde 2026-09-28)

- **Regla simple anclada a la fecha de la tasa**: la tasa es vigente hasta que se acabe el día de su `effectiveDate` (la fecha que publica la fuente —DolarAPI `fechaActualizacion`, sitio del BCV— o la que elige el operador al ingresar manual). Si se publicó con anticipación (ej.: viernes con fecha del lunes), cubre hasta que se acabe ese día (el lunes). Pasado ese límite la tasa queda **vieja** (`old`): el POS pide actualizarla dentro del cobro pero permite **cobrar igual con confirmación**. `old` **nunca bloquea** (`RATE_EXPIRED` ya no existe); el único bloqueo es `RATE_MISSING`. **Detalle completo en [[rate-validity]]**.
- **Backend** (`POST /invoices`, `POST /reservations`): comparten el mismo resolver (`getActiveExchangeRate`); si no existe ninguna tasa → 400 `RATE_MISSING` con `details.errorCode`.
- **Renderer (POS)**: el `PaymentModal` muestra el panel de tasa activa (tasa + captura + "válida hasta") e integra las acciones "Consultar BCV" e "Ingresar manual" **dentro del cobro** (sin salir del modal, funciona offline). Si no hay tasa, bloquea el botón Cobrar y el operador debe registrarla ahí mismo; si la tasa está **vieja**, muestra la advertencia con un checkbox "Cobrar con esta tasa de todos modos" (Cobrar se habilita al confirmar); al guardar, se refresca la tasa activa automáticamente.
- El auto-fetch BCV funciona complementariamente: si está habilitado, refresca la tasa al arrancar y según horarios configurados (DolarAPI → fallback a scrape del sitio del BCV); los cambios de configuración se aplican sin reiniciar el servidor.

## ¿Qué entidades implementan esto?

- La **[[company|Company]]** define la moneda por defecto
- El **[[product|Product]]** guarda precios/costos solo en USD; VES derivado en vivo
- La **[[invoice|Invoice]]** guarda subtotales, IVA y totales en ambas monedas con la tasa congelada
- El **[[customer|Customer]]** tiene límite de crédito solo en USD
- El **[[exchange-rate|ExchangeRate]]** registra la tasa histórica congelada en cada factura

## Histórico

- **2026-09-28 (iteración 3)**: reemplazado el modelo de 3 estrategias (`rateValidityMode`) por la **regla simple de fecha** (`effectiveDate`, ver [[rate-validity]]): la tasa es vigente hasta que se acabe el día de su fecha y, al quedar vieja, el POS pide actualizarla dentro del cobro pero permite cobrar con confirmación. El panel inline del `PaymentModal` (Consultar BCV / Ingresar manual, ahora con campo de fecha) se mantiene.
- **2026-09-28 (iteración 2, supercedida)**: reemplazado el modelo de vigencia por días fijos (`bcvRateVigencyDays`) por un motor **data-driven** (`rateValidityMode`, ver [[rate-validity]]). El flujo de inserción manual pasó a ser un panel inline dentro de `PaymentModal` (el componente `RateModal` fue eliminado en el commit `717ad33` y no se reintrodujo). El POS reafirma su naturaleza USD-first: no existe "factura solo en Bs.".
- **2026-08-04**: eliminados `Product.priceVes/costVes`, `Customer.creditLimitVes`, `InventoryMovement.unitCostVes`. Antes el catálogo persistía ambas monedas; ahora solo USD con equivalencia VES en vivo. Facturas históricas conservan sus totales VES congelados. Al desplegar se pierden los valores VES del catálogo (deseado).

## Relación con otros conceptos

- [[dual-currency]] es requisito para [[fiscal-compliance]] (SENIAT requiere facturación en ambas monedas)
- [[architectural-decision-003|ADR-003]] formaliza la decisión arquitectónica que implementa dual-currency
- [[offline-first]] no interfiere: las tasas se capturan localmente sin necesidad de API externa
