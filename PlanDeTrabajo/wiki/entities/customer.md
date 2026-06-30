---
type: entity
tags: [customer, client, fiscal]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# Customer

Cliente o receptor de factura. Fuente: [[db-schema]].

Un **[[customer|Customer]]** es la persona o empresa que recibe una [[invoice|factura]]. Sus datos fiscales (RIF, dirección) son obligatorios para el [[fiscal-compliance|cumplimiento SENIAT]].

## Atributos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| RIF | string | Registro de Información Fiscal (Venezuela) |
| name | string | Razón social o nombre |
| address | string | Dirección fiscal |
| phone | string | Teléfono |
| email | string | Correo electrónico |
| creditLimitUsd/CreditLimitVes | decimal | Límite de crédito en ambas monedas ([[dual-currency]]) |

## Relaciones con otras entidades

- Un **Customer** tiene muchas **[[invoice|facturas]]** (historial de compras)
- Un **Customer** requiere datos fiscales para **[[fiscal-compliance|cumplimiento SENIAT]]**
- Un **Customer** tiene límites de crédito en **[[dual-currency|ambas monedas]]**
