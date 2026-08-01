---
type: concept
tags: [docker, deployment, backend, updater]
created: 2026-07-31
updated: 2026-07-31
sources: [roadmap]
---

# Docker Deployment

## Resumen

El backend (Express + Prisma + PostgreSQL) corre en Docker Compose (`silverknight-db` + `silverknight-server`) lanzado por la app Electron al arrancar. El modelo de deployment ha evolucionado para ser **offline-capable**: los arranques normales no reconstruyen la imagen, y los rebuilds post-update son rápidos y no fatales.

## Modelo v1.1.6 (actual)

- **Arranque normal**: `docker compose up -d` **sin `--build`** — usa la imagen cacheada, cero red, arranque instantáneo
- **Imagen cacheable**: las deps del servidor viven en `server/package.json` + `server/package-lock.json` (versión fija `1.0.0`), NO en el `package.json` versionado de la app. La capa `COPY server/package.json* → npm ci` nunca se invalida con releases → los rebuilds post-update solo tocan capas locales (segundo build: 0.2s, 100% CACHED)
- **Sentinel de versión**: `ensureServerImage` (`src/main/server-image.ts`) escribe `.server-version` en `%APPDATA%\silver-knight` (escribible incluso cuando la app vive bajo `Program Files`). Solo reconstruye cuando la versión de la app cambia respecto al sentinel
- **Rebuild no fatal**: si el rebuild falla, la app continúa con la imagen existente en vez de bloquearse con el error de puerto
- **Shutdown graceful real**: `before-quit` y `stopCompose` corren `docker compose down` con `COMPOSE_PROJECT_NAME=silverknight` → Postgres se apaga limpio al salir (sin crash recovery en el siguiente arranque)
- **La DB nunca se fuerza-mata**: `cleanupStaleContainers` excluye `silverknight-db`; solo remueve server/orphanos en conflictos
- **Health de proceso**: `/api/health` es liveness inmediato (sin DB); `/api/health/db` reporta la DB (503 si caída)
- **Detección de crash**: tras `up -d`, se inspecciona el contenedor server; si está `exited/restarting`, se muestran sus logs de inmediato
- **`prisma db push` gated por hash**: `docker-entrypoint.sh` solo corre `db push` cuando cambia el hash de `schema.prisma` (estado persistido en el volumen `silverknight-schema-state`)
- **Pre-warm post-update**: `installUpdate` calienta el cache Docker (pull + build) antes de `quitAndInstall`
- **Diagnóstico**: ante fallo, el diálogo ofrece "Copiar diagnóstico" (docker ps + compose ps + estado contenedores + logs + tail de `main.log` → portapapeles)
- **Proyecto Docker**: `COMPOSE_PROJECT_NAME=silverknight` (contenedores con nombre estable `silverknight-db` / `silverknight-server`)

## Historial de la causa raíz

| Versión | Cambio | Resultado |
|---|---|---|
| ≤ v1.1.1 | `up -d --build` en cada arranque | No resolvió |
| v1.1.2 | cleanup stale + retry | No resolvió |
| v1.1.3 | cleanup SIEMPRE + stop antes de update | No resolvió |
| v1.1.4 | logging a `main.log`, eliminado rebuild destructivo post-update, `--no-cache` fuera | No resolvió |
| v1.1.5 | `up -d` sin `--build`, deps estables `server/package.json`, sentinel version-gated no-fatal | Verificado local E2E; pendiente confirmación en máquina desplegada |
| v1.1.6 | shutdown graceful (`COMPOSE_PROJECT_NAME` en `before-quit`), cleanup sin tocar la DB, health liveness, detección de crash-loop, `prisma db push` gated por hash, pre-warm de cache post-update | Pendiente confirmación en máquina desplegada |

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
