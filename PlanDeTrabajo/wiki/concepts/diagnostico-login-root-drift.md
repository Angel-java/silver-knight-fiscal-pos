---
type: concept
tags: [ops, diagnosis, root, login, credential, docker]
created: 2026-08-30
updated: 2026-08-30
---

# Diagnóstico — Login root "Credenciales inválidas" (drift de credenciales)

Procedimiento operativo para diagnosticar y resolver el error **"Credenciales inválidas"
(HTTP 401)** al intentar entrar como **root** en una máquina desplegada.

## Síntoma

- En la pantalla de login, el usuario root **no entra** con el PIN que está en el `.env` de
  la instalación, devolviendo 401 "Credenciales inválidas".
- El resto de usuarios (admin) pueden entrar normalmente.

## Causa raíz

**Drift de credenciales entre el `.env` y la BD.** Antes de v1.1.25,
`autoCreateRoot()` (`src/server/auth/autoAdmin.ts`) **solo creaba** el root al primer arranque
(`if (existing) return`) y **nunca reconciliaba** el PIN si el `.env` cambiaba después. Dos
sub-causas típicas:

1. **484 con dos valores distintos** (`.env` vs BD): el login valida contra la **BD**, no
   contra el `.env`. Si el `.env` fue editado pero la BD quedó con un PIN viejo → 401.
2. **`ROOT_USERNAME` inexistente en BD** (ej. default legacy `alucard`): el server busca el
   usuario por `ROOT_USERNAME`; si no existe en la BD → 401 "Credenciales inválidas"
   (el 401 se emite tanto por username inexistente como por PIN incorrecto).

## Diagnóstico rápido

1. Ver que el contenedor server esté healthy:
   `docker ps --filter "name=silverknight"`.
2. Leer el `.env` que usa la app empaquetada (`%APPDATA%\silver-knight\config\.env`) y confirmar
   `ROOT_USERNAME` y `ROOT_PIN` actuales.
3. Contrastar contra la BD:
   `docker exec -i silverknight-db psql -U silverknight -d silverknight -c "SELECT username, role FROM \"User\" ORDER BY role;"`.
   El usuario con `role='root'` debe existir y coincidir con `ROOT_USERNAME`.

## Resolución

### Vía primaria: editar el `.env` y reiniciar (self-healing, desde v1.1.25)

1. Abrir `%APPDATA%\silver-knight\config\.env`.
2. Fijar `ROOT_USERNAME=admin` (o el deseado) y `ROOT_PIN=<PIN nuevo>`.
   - Guard: si `ROOT_PIN` se deja **vacío**, `autoCreateRoot()` no haca nada (no-op seguro).
3. Reiniciar el server (reconstruye el contenedor y re-lee el `.env`).
4. `autoCreateRoot()` **reconcilia el root en cada arranque**: actualiza PIN/rol, o renombra
   un root legacy a `ROOT_USERNAME`, o crea el root si no existe. La BD se corrige sola.
5. Entrar con `ROOT_USERNAME`/`ROOT_PIN` nuevos.

### Vía script: `reset-root.js` (remediación directa a BD)

Si la vía anterior no aplica (o se necesita un pin inmediato), la herramienta empaquetada
`reset-root.js` edita la tabla `"User"` directamente vía `docker exec ... psql`:

- Empaquetada con la app desde v1.1.25 en `resources\reset-root\reset-root.js`
  (y en el repo en `opencode-tools/reset-root/reset-root.js`).
- Autocontenida (bcrypt incrustado), solo requiere **Node** + **Docker**.
- Ejemplo: `node reset-root.js --user admin --pin <PIN>`.
- Ver [[reset-root-user]].

## Prevención (por qué ya no debería repetirse)

- **`autoCreateRoot()` reconcilia el root en cada arranque** con el `.env` como fuente de
  verdad (v1.1.25) — el drift se autocorrige.
- Default de `ROOT_USERNAME` cambiado `alucard` → `admin` (alineado con `config.ts`).
- `docker-compose.yml` inyecta `ROOT_PIN`/`ROOT_USERNAME` al contenedor server
  (antes el contenedor no recibía `ROOT_PIN` y no podía reconciliar).
- Guard: `ROOT_PIN` default vacío = no-op seguro (no fija PIN erróneo).

## Relacionado
- [[reset-root-user]] — operación de mantenimiento de credenciales del root
- [[user|User]] — el root es un `User` con `role='root'`
- [[docker-deployment|Docker Deployment]] — contenedores `silverknight-db`/`silverknight-server`
