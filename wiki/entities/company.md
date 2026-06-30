---
type: entity
tags: [company, organization, fiscal]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# Company

Entidad que representa la empresa propietaria del sistema Silver Knight.

Una [[company|Company]] es la raíz del sistema. Cada instancia de Silver Knight pertenece a una sola empresa, y todos los [[user|usuarios]], [[product|productos]], [[invoice|facturas]] y configuraciones están asociados a ella.

## Atributos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| name | string | Razón social |
| RIF | string | Registro de Información Fiscal (Venezuela) |
| address | string | Dirección fiscal |
| phone | string | Teléfono |
| email | string | Correo electrónico |
| defaultCurrency | enum | Moneda por defecto (USD/VES) — ver [[dual-currency]] |
| logo | string? | Logo de la empresa |

## Relaciones con otras entidades

- Una **Company** tiene muchos **[[user|Users]]** (operadores del sistema)
- Una **Company** tiene muchas **[[setting|Settings]]** (configuración clave-valor)
- Una **Company** tiene un historial de **[[exchange-rate|Exchange Rates]]** (tasas de cambio)
- La **Company** define la moneda por defecto, concepto manejado por [[dual-currency]]
- El RIF de la Company es el emisor fiscal para [[fiscal-compliance]]

## Reglas de negocio

- El RIF es único por empresa
- La empresa se configura durante el wizard de primer uso (first-run)
- Una vez creada, solo el admin puede editar sus datos
