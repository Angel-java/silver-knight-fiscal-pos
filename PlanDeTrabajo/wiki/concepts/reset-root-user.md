---
type: concept
tags: [ops, admin, root, credential, docker]
created: 2026-08-28
updated: 2026-08-30
---

# Reset / cambio de credenciales del usuario root

Operación de mantenimiento para cambiar el **username** y/o el **PIN** del usuario
root (`role='root'`) de un Silver Knight desplegado, sin pasar por la API.

## Por qué se necesita un script directo a BD

- El usuario root se crea automáticamente en el primer arranque desde variables de
  entorno (`ROOT_USERNAME`, `ROOT_PIN`) en `src/server/auth/autoAdmin.ts`.
- **Antes (bug)**: `autoCreateRoot()` solo creaba el root; si ya existía
  (`if (existing) return`), nunca reconciliaba el PIN -> **drift de credenciales** entre el
  `.env` y la BD.
- **Desde 2026-08-30**: `autoCreateRoot()` **reconcilia el root en cada arranque**. El `.env`
  (`ROOT_USERNAME`/`ROOT_PIN`) es la fuente de verdad: actualiza el PIN/rol si difieren;
  renombra un root legacy con otro nombre a `ROOT_USERNAME`; crea el root si no existe.
- El root es **inmutable por API**: `src/server/routes/users.ts` lo excluye de la lista
  (línea 30), prohíbe crearlo (56-59), modificarlo (108-111) y asignar el rol root (129-132).
- Por lo tanto hay **dos vías** en una máquina ya desplegada (ver
  [[diagnostico-login-root-drift]]):
  1. **Editar el `.env` + reiniciar (primaria, self-healing)** — desde 2026-08-30 el server
     **reconcilia el root en cada arranque** con el `.env` como fuente de verdad; no se toca la BD.
  2. **Script a BD directa** — `reset-root.js` edita la tabla `"User"` en Postgres.

## Guard de seguridad de ROOT_PIN

- A partir de v1.1.25 el `docker-compose.yml` inyecta `ROOT_PIN="${ROOT_PIN:-}"` al contenedor
  server, es decir **por defecto vacío**. Esto es una **no-op segura**: si el operador no define
  `ROOT_PIN`, `autoCreateRoot()` **no crea ni modifica** ningún root (evita fijar un PIN erróneo
  o re-crear usuarios por accidente). El root deseado solo se crea/reconcilia cuando `ROOT_PIN`
  tiene un valor explícito en el `.env`.

## Almacenamiento del PIN

- El `pin` se almacena como **hash bcrypt (costo 10)** con `bcryptjs`, nunca en claro.
- Configurado igual que en `autoAdmin.ts` y `users.ts` (`bcrypt.hash(pin, 10)`).
- No es recuperable en claro; solo se puede re-hashear y sobrescribir.

## Herramienta

Script **independiente** (no se mezcla con el código de `silver-knight/`), de **archivo
único autocontenido**:

- Ubicación: `opencode-tools/reset-root/reset-root.js` (fuera del código del sistema).
- **Lleva bcrypt incrustado** (bcryptjs, MIT) → no requiere `npm install` en la máquina destino:
  basta Node.js.
- Edita la tabla `"User"` vía `docker exec silverknight-db psql ...`:
  ```sql
  UPDATE "User" SET "username" = :username, "pin" = :hash, "updatedAt" = now()
  WHERE "role" = 'root';
  ```
- Genera el hash bcrypt(10) localmente (bcrypt embebido) y lo pasa a psql.
- **Credenciales por defecto** editables al inicio del archivo (`USERNAME_POR_DEFECTO`,
  `PIN_POR_DEFECTO`). `node reset-root.js` sin argumentos aplica los defaults.
- Flags: `--user`, `--pin`, `--user-only`, `--pin-only`, `--dry-run`, `--print-hash`,
  `--quiet`, `--container`, `--db-user`, `--db-name`.
- Verificación: `docker exec ... psql -c "SELECT username FROM \"User\" WHERE role='root';"`
- Evita auto-ejecución al ser requerido (`require.main === module` guard).

### Script empaquetado con la app (v1.1.25)
Desde v1.1.25, el instalador empaqueta `reset-root.js` como `extraResources` en
`electron-builder.yml`, de modo que **la remediación está disponible en la propia máquina**
en `resources\reset-root\reset-root.js` (bajo `process.resourcesPath`). Requiere **Node** y
**Docker** para ejecutarse; la vía primaria (editar `.env` + reiniciar) no requiere Node.

### Nota sobre el `.env` de la app empaquetada
El script no toca el `.env` de la app. En un despliegue empaquetado, ese archivo vive en
`%APPDATA%\silver-knight\config\.env` (via `app.getPath('userData')`), y `autoAdmin`/wizard
leen de ahí. La **vía primaria** para cambiar/recuperar la credencial del root es editar
`ROOT_USERNAME` y `ROOT_PIN` de ese archivo y **reiniciar el server** (auto-reconcilia).

### Vía primaria (recomendada): editar `.env` + reiniciar
1. Abrir `%APPDATA%\silver-knight\config\.env`.
2. Editar `ROOT_USERNAME` y `ROOT_PIN` con el valor deseado (guard: dejar `ROOT_PIN` vacío
   para que no haya cambios).
3. Reiniciar el server (reconstruye el contenedor, que re-lee el `.env` y reconcilia el root
   en `autoCreateRoot()`). No se toca la BD manualmente.

## Relacionado
- [[user|User]] — operador del sistema (el root es un User con `role='root'`)
- [[docker-deployment|Docker Deployment]] — los contenedores `silverknight-db`/`silverknight-server`
