---
type: entity
tags: [setting, configuration, system]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# Setting

Almacenamiento clave-valor para configuración del sistema.

## Atributos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| key | string (PK) | Identificador único |
| value | JSON | Valor serializado |

## Relaciones

- [[setting]] -> [[company]]: N:1 (configuración por empresa)
