---
type: entity
tags: [company, organization, fiscal]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# Company

Entidad que representa la empresa propietaria del sistema Silver Knight.

## Atributos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| name | string | Razón social |
| RIF | string | Registro de Información Fiscal (Venezuela) |
| address | string | Dirección fiscal |
| phone | string | Teléfono |
| email | string | Correo electrónico |
| defaultCurrency | enum | Moneda por defecto (USD/VES) |
| logo | string? | Logo de la empresa |

## Relaciones

- [[company]] -> [[user]]: 1:N (una empresa tiene muchos usuarios)
- [[company]] -> [[setting]]: 1:N (configuración por empresa)
- [[company]] -> [[exchange-rate]]: 1:N (tasas de cambio histórico)

## Reglas de negocio

- El RIF es único por empresa
- La empresa se configura durante el wizard de primer uso (first-run)
- Una vez creada, solo el admin puede editar sus datos
