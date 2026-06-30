---
type: entity
tags: [user, auth, role]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# User

Representa un operador del sistema Silver Knight. Fuente: [[db-schema]].

Un **[[user|User]]** es una persona que opera el sistema. Pertenece a una [[company|Company]] y puede crear [[invoice|facturas]], abrir/cerrar [[cash-register|caja]], y gestionar el inventario según su rol.

## Atributos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| username | string | Nombre de usuario único |
| PIN | string (hash) | PIN de acceso (hasheado) |
| fullName | string | Nombre completo |
| role | enum | admin / supervisor / operator |
| active | boolean | Si el usuario está activo |

## Roles

- **admin**: control total del sistema
- **supervisor**: puede ver reportes, anular facturas
- **operator**: puede facturar, gestionar caja

## Relaciones con otras entidades

- Un **User** pertenece a una **[[company|Company]]**
- Un **User** crea muchas **[[invoice|facturas]]**
- Un **User** abre y cierra **[[cash-register|caja]]**
