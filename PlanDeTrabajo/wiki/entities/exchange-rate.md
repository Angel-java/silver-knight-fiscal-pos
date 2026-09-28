---
type: entity
tags: [exchange-rate, currency, bcv]
created: 2026-06-30
updated: 2026-09-28
sources: [db-schema]
---

# Exchange Rate

Registro histórico de tasas de cambio USD/VES. Fuentes: [[db-schema]], [[small-profile-phase]].

Un **[[exchange-rate|ExchangeRate]]** captura la tasa de cambio en un momento dado. Es fundamental para el sistema de [[dual-currency|doble moneda]]: cada [[invoice|factura]] congela la tasa al momento de la transacción en lugar de referenciarla dinámicamente. Desde 2026-09-28, la **vigencia** de cada captura se ancla a la **fecha de la tasa** (la que publica la fuente, `effectiveDate`); ver [[rate-validity]].

## Atributos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| rate | decimal | Tasa de cambio (Bs. por 1 USD) |
| source | string | `manual` / `bcv` / `bcv-scrape` / `bcv-auto` |
| date | datetime | Marca de tiempo de la captura (ordena la "activa" = la más reciente) |
| effectiveDate | datetime/null | Inicio del día (Caracas) al que corresponde la tasa; viene de DolarAPI (`fechaActualizacion`), del sitio del BCV o la elige el operador (manual). `null` en capturas antiguas → se usa el día de `date` |
| validUntil | (derivado) | Fin del día de `effectiveDate` (último ms, Caracas); después de este instante la tasa es **vieja** (`old`). No persiste |
| validFrom | (derivado) | Inicio del día de `effectiveDate` (no persiste) |

`validFrom`/`validUntil`/`effectiveDate` se exponen en `GET /exchange-rates` (list y `?latest=true`), `GET /exchange-rates/active` (`{ rate, old }`) y en las respuestas de `/bcv` y `POST /`.

## Reglas de vigencia (resumen)

- **Activa = captura más reciente** (por `date`); una captura futura nunca es activa; capturas duplicadas el mismo día → manda la de timestamp más nuevo.
- **Vigente hasta que se acabe su día**: la tasa vale hasta la medianoche de Caracas del día de `effectiveDate`. Si se publicó con anticipación (ej.: viernes con fecha del lunes), cubre hasta que se acabe el lunes.
- **Tasa vieja (`old`)**: pasado ese límite, el POS pide actualizarla dentro del cobro (Consultar BCV / Ingresar manual) pero permite **cobrar igual con confirmación** del operador. `old` **nunca bloquea**.
- **Sin tasa** (`RATE_MISSING`): el único bloqueo duro; el POS pide registrar una dentro del cobro.
- **Fines de semana**: sin anclaje a días de la semana; el viernes con fecha del lunes cubre vie/sáb/dom/lun sin configuración.

## Relaciones con otras entidades

- Un **ExchangeRate** pertenece al historial de una **[[company|Company]]**
- Las **[[invoice|facturas]]** congelan la tasa al momento de emitirse ([[dual-currency]])
- Los **[[reservation|apartados]]** resuelven la tasa con el mismo motor que facturación (desde 2026-09-28, antes `findFirst` asimétrico)
- Puede obtenerse automáticamente del BCV (`source: bcv`/`bcv-auto`/`bcv-scrape` vía DolarAPI → scrape) o ingresarse manualmente (`source: manual`)

## Hitos

- **2026-09-28 (iteración 3)**: campo `effectiveDate` (fecha de la tasa desde la fuente), regla simple "vigente hasta que se acabe su día", estado `old` no bloqueante con confirmación en el cobro, eliminadas `rateValidityMode`/`rateStaleWarningDays`. Detalle en [[rate-validity]].
- **2026-09-28 (iteración 2, supercedida)**: vigencia data-driven por timestamps + estrategias (`rateValidityMode`), endpoint `/active`, panel inline en el cobro, scheduler con fetch-on-start + recarga en caliente.