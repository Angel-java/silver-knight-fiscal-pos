---
type: entity
tags: [cash-register, pos, session, closure]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# Cash Register

Apertura y cierre de caja del sistema POS. Fuente: [[db-schema]].

Un **[[cash-register|CashRegister]]** registra el inicio y fin de la jornada de un [[user|operador]]. Controla los montos en [[dual-currency|ambas monedas]] y puede operar sin conexión ([[offline-first]]).

## Atributos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| openingAmount | decimal | Monto de apertura (dual currency) |
| closingAmount | decimal | Monto de cierre (dual currency) |
| openedAt | datetime | Fecha/hora de apertura |
| closedAt | datetime | Fecha/hora de cierre |
| status | enum | open / closed |

## Relaciones con otras entidades

- Un **CashRegister** es abierto/cerrado por un **[[user|User]]**
- Opera con **[[dual-currency|doble moneda]]**: montos en USD y VES
- Funciona sin conexión gracias al principio **[[offline-first]]**
