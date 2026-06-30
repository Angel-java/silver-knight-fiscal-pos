---
type: entity
tags: [category, product, inventory]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# Category

Categoría o familia de productos.

## Atributos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| name | string | Nombre de la categoría |
| description | string | Descripción opcional |

## Relaciones

- [[category]] -> [[product]]: 1:N (una categoría tiene muchos productos)
