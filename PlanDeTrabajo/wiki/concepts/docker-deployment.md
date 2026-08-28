---
type: concept
tags: [docker, deployment, backend, updater]
created: 2026-07-31
updated: 2026-08-27
sources: [roadmap]
---

# Docker Deployment

## Resumen

El backend (Express + Prisma + PostgreSQL) corre en Docker Compose (`silverknight-db` + `silverknight-server`) lanzado por la app Electron al arrancar. El modelo de deployment ha evolucionado para ser **offline-capable**: los arranques normales no reconstruyen la imagen, los rebuilds post-update son rápidos y no fatales, y desde v1.1.13 el arranque completo funciona sin internet usando la imagen cacheada.

## Modelo v1.1.13 (actual)

- **Arranque normal**: `docker compose up -d` **sin `--build`** — usa la imagen cacheada; `db` tiene `pull_policy: missing` → compose no intenta pull de `postgres:16-alpine` si la imagen ya existe localmente
- **Offline-first en arranque**: `getImageAvailability()` (`src/main/docker.ts`) consulta si `db` y `server` existen en caché; con imágenes presentes la app arranca sin red; faltan imágenes + offline → diálogo "Primera configuración requiere internet" con Reintentar / Copiar diagnóstico / Salir; faltan imágenes + online → pre-warm (server build + pull de `db`)
- **Imagen cacheable**: las deps del servidor viven en `server/package.json` + `server/package-lock.json` (versión fija `1.0.0`), NO en el `package.json` versionado de la app. La capa `COPY server/package.json* → npm ci` nunca se invalida con releases → los rebuilds post-update solo tocan capas locales (segundo build: 0.2s, 100% CACHED)
- **Sentinel de versión**: `ensureServerImage` (`src/main/server-image.ts`) escribe `.server-version` en `%APPDATA%\silver-knight` (escribible incluso cuando la app vive bajo `Program Files`). Solo reconstruye cuando la versión de la app cambia respecto al sentinel. Desde v1.1.13 es offline-aware: retorna `{ rebuilt, error?, skippedOffline? }`; offline con imagen → skip (sentinel no se actualiza → rebuild al volver online)
- **Rebuild no fatal**: si el rebuild falla, la app continúa con la imagen existente en vez de bloquearse con el error de puerto
- **Shutdown graceful real**: `before-quit` y `stopCompose` corren `docker compose down` con `COMPOSE_PROJECT_NAME=silverknight` → Postgres se apaga limpio al salir (sin crash recovery en el siguiente arranque)
- **La DB nunca se fuerza-mata**: `cleanupStaleContainers` excluye `silverknight-db`; solo remueve server/orphanos en conflictos
- **Health de proceso**: `/api/health` es liveness inmediato (sin DB); `/api/health/db` reporta la DB (503 si caída)
- **Detección de crash**: tras `up -d`, se inspecciona el contenedor server; si está `exited/restarting`, se muestran sus logs de inmediato
- **`prisma db push` gated por hash**: `docker-entrypoint.sh` solo corre `db push` cuando cambia el hash de `schema.prisma` (estado persistido en el volumen `silverknight-schema-state`)
- **Pre-warm post-update**: `installUpdate` calienta el cache Docker (pull + build) antes de `quitAndInstall`
- **Diagnóstico**: ante fallo, el diálogo ofrece "Copiar diagnóstico" (docker ps + compose ps + estado contenedores + logs + tail de `main.log` → portapapeles)
- **Proyecto Docker**: `COMPOSE_PROJECT_NAME=silverknight` (contenedores con nombre estable `silverknight-db` / `silverknight-server`)

## Resolución del CLI de Docker (v1.1.24)

Toda invocación de docker pasa por el exe resuelto por `src/main/docker-path.ts`:

- `resolveDockerOnce()` prueba `docker` pelado (PATH) y luego rutas absolutas conocidas (`Program Files`, x86, `%LOCALAPPDATA%\Docker\Docker\resources\bin\docker.exe`); el resultado se cachea y `getCachedDockerExe()` es el accesor síncrono usado por spawns/exec en `docker.ts`, `config.ts` y `before-quit`
- Sondas con timeout 20s + hasta 3 intentos con backoff — evita el falso "Docker no instalado" en máquinas donde AV/lentitud hace que `docker --version` tarde >5s (ver [[diagnostico-docker-not-installed-timeout]])
- `getChildEnv()` antepone el dir del exe al PATH de procesos hijos
- El diagnóstico (`gatherDiagnostics`) reporta `where docker`, exe resuelto y existencia de rutas candidatas

## Historial de la causa raíz

| Versión | Cambio | Resultado |
|---|---|---|
| ≤ v1.1.1 | `up -d --build` en cada arranque | No resolvió |
| v1.1.2 | cleanup stale + retry | No resolvió |
| v1.1.3 | cleanup SIEMPRE + stop antes de update | No resolvió |
| v1.1.4 | logging a `main.log`, eliminado rebuild destructivo post-update, `--no-cache` fuera | No resolvió |
| v1.1.5 | `up -d` sin `--build`, deps estables `server/package.json`, sentinel version-gated no-fatal | Verificado local E2E; pendiente confirmación en máquina desplegada |
| v1.1.6 | shutdown graceful (`COMPOSE_PROJECT_NAME` en `before-quit`), cleanup sin tocar la DB, health liveness, detección de crash-loop, `prisma db push` gated por hash, pre-warm de cache post-update | Pendiente confirmación en máquina desplegada |
| v1.1.13 | offline-first en arranque (`getImageAvailability`, `ensureServerImage` offline-aware con `skippedOffline`, pre-warm db `pullDbImage`, diálogo "Primera configuración requiere internet", `pull_policy: missing` en db, update check offline silencioso + retry por polling) | Verificado con typecheck + 122 tests; pendiente E2E offline en máquina desplegada |
| v1.1.24 | resolución de CLI docker con caché + rutas absolutas + reintentos, timeouts 5s→20s, PATH hijo aumentado, diálogo con Reintentar, diagnóstico CLI enriquecido | Verificado con typecheck + 194 tests; pendiente confirmación en la máquina afectada |
| v1.1.25 | **probe de conectividad real** (`netProbe.isReallyOnline`) en `index.ts`/`server-image.ts`/`updater.ts`; con imágenes cacheadas el arranque **no depende del probe** (la caché es la garantía); sync resiliente con backoff + `lastSyncAt` condicional; vigencia de tasa + inserción manual en POS + degradación BCV visible | Verificado con typecheck + 215 tests; pendiente E2E offline en máquina desplegada |

Causas raíz descubiertas en v1.1.6 (ver [[diagnostico-error-3001-post-update]]):
- `before-quit` corría `docker compose down` sin `COMPOSE_PROJECT_NAME` → no-op → la DB nunca se apagaba limpio
- `cleanupStaleContainers` hacía `rm -f` de la DB en cada arranque → crash recovery lento
- `/api/health` dependía de la DB → los health checks fallaban durante la recuperación
- `up -d` devolvía 0 aunque el contenedor server crasheara en loop → la app esperaba 120s a ciegas

## Reglas para el futuro

- NO volver a meter `--build` o `--no-cache` en el arranque normal
- NO volver a copiar el `package.json` versionado de la app en el stage `deps`
- Cambios de deps del servidor → bump de `server/package.json` a una versión nueva, nunca mezclada con la versión de la app
- Cualquier cambio en el Dockerfile/imagen exige bump de versión de la app para forzar el rebuild via sentinel
- NO correr `docker compose down`/`up` sin `COMPOSE_PROJECT_NAME=silverknight` (produce no-ops y conflictos)
- NO volver a hacer `rm -f` del contenedor `silverknight-db` (crash recovery)
- NO volver a meter consultas a la DB dentro de `/api/health` (health es liveness del proceso)
- NO eliminar `pull_policy: missing` de `db` ni volver a asumir que `up -d` puede hacer pull sin red
- Cualquier cambio que requiera red en el arranque empaquetado debe pasar por `isReallyOnline()` (probe real, no solo `net.isOnline()`) + imágenes en caché (ver [[offline-first]])
- NO invocar `docker`/`docker compose` pelado en el proceso main: usar `getCachedDockerExe()` / `getComposeCmd()` de `docker-path.ts`
- NO bajar los timeouts de las sondas docker por debajo de 20s ni diagnosticar "no instalado" sin reintentos (falsos positivos por AV/lentitud)
