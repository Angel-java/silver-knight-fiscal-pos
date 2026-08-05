---
type: concept
tags: [currency, usd, ves, exchange-rate, architecture]
created: 2026-06-30
updated: 2026-08-04
sources: [adr-003, db-schema]
---

# Dual Currency

Mecanismo nativo de doble moneda (USD/VES) en Silver Knight. Fuentes: [[architectural-decisions]], [[db-schema]].

## Principio

- **Catálogo dolarizado**: [[product|Product]], [[customer|Customer]] e [[inventory-movement|InventoryMovement]] guardan **solo USD**. Los montos VES del catálogo se calculan en vivo (precio/costo USD × tasa vigente) al registrar/editar y en la lista de productos; no se persisten.
- **Factura fiscal dual**: la [[invoice|Invoice]] congela los montos VES (`unitPriceVes`, `totalVes`, `ivaVes`) y la `exchangeRate` usada al momento de la transacción (ver [[exchange-rate]]). Esto es requisito SENIAT y no se recalcula nunca.
- La tasa se toma del body `exchangeRate` al facturar; si no se envía, el servidor usa la última registrada en BD; si no hay ninguna → error 400 "No hay una tasa de cambio configurada. Regístrala en Ajustes > Tasa BCV."

## ¿Qué entidades implementan esto?

- La **[[company|Company]]** define la moneda por defecto
- El **[[product|Product]]** guarda precios/costos solo en USD; VES derivado en vivo
- La **[[invoice|Invoice]]** guarda subtotales, IVA y totales en ambas monedas con la tasa congelada
- El **[[customer|Customer]]** tiene límite de crédito solo en USD
- El **[[exchange-rate|ExchangeRate]]** registra la tasa histórica congelada en cada factura

## Histórico

- **2026-08-04**: eliminados `Product.priceVes/costVes`, `Customer.creditLimitVes`, `InventoryMovement.unitCostVes`. Antes el catálogo persistía ambas monedas; ahora solo USD con equivalencia VES en vivo. Facturas históricas conservan sus totales VES congelados. Al desplegar se pierden los valores VES del catálogo (deseado).

## Relación con otros conceptos

- [[dual-currency]] es requisito para [[fiscal-compliance]] (SENIAT requiere facturación en ambas monedas)
- [[architectural-decision-003|ADR-003]] formaliza la decisión arquitectónica que implementa dual-currency
- [[offline-first]] no interfiere: las tasas se capturan localmente sin necesidad de API externa
