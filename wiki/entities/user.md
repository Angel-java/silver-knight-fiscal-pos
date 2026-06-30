---
type: entity
tags: [user, auth, role]
created: 2026-06-30
updated: 2026-06-30
sources: [db-schema]
---

# User

Representa un operador del sistema Silver Knight.

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

## Relaciones

- [[user]] -> [[company]]: N:1
- [[user]] -> [[invoice]]: 1:N (facturas creadas por el usuario)
- [[user]] -> [[cash-register]]: 1:N (aperturas/cierres de caja)
