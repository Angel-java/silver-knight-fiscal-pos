---
type: entity
tags: [setting, configuration, system]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# Setting

Almacenamiento clave-valor para configuración del sistema. Fuente: [[db-schema]].

Un **[[setting|Setting]]** guarda opciones de configuración de la [[company|Company]] en formato JSON. Permite almacenar cualquier ajuste sin modificar el schema de la base de datos.

## Atributos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| key | string (PK) | Identificador único |
| value | JSON | Valor serializado |

## Relaciones con otras entidades

- Un **Setting** pertenece a una **[[company|Company]]** (configuración por empresa)
