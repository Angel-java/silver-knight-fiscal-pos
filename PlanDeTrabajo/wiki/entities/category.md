---
type: entity
tags: [category, product, inventory]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# Category

Categoría o familia de productos.

Una **[[category|Category]]** agrupa [[product|productos]] relacionados para facilitar la organización del inventario y la búsqueda en el POS.

## Atributos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| name | string | Nombre de la categoría |
| description | string | Descripción opcional |

## Relaciones con otras entidades

- Una **Category** contiene muchos **[[product|Products]]**
