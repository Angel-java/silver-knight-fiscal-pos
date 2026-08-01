---
type: query
tags: [diagnostico, error-3001, backend, docker, updater]
created: 2026-07-31
updated: 2026-07-31
sources: [docker-deployment]
---

# Diagnóstico — Error 3001 post-update en máquina desplegada

## Síntoma

Tras instalar una actualización, la app se queda pegada en el splash en **"Esperando al servidor"** (progress ~80) y finalmente muestra el diálogo *"El backend tardó demasiado en iniciar. Verifica que el puerto 3001 no esté en uso."*

Ese punto de la UI es `waitForBackend` en `src/main/index.ts` (`waitForBackendWithContainerCheck`): agota su presupuesto (ahora 180s) esperando que `http://localhost:3001/api/health` responda OK **después** de que `docker compose up -d` ya devolvió éxito.

## Causas raíz

1. **`docker compose down` en `before-quit` era un no-op** (`src/main/index.ts`). Corría sin `COMPOSE_PROJECT_NAME=silverknight`, por lo que compose usaba el project name derivado de la carpeta (`resources`) y no encontraba los contenedores → la DB **nunca se apagaba de forma limpia** al salir.

2. **`cleanupStaleContainers` hacía `docker rm -f` de la DB en cada arranque** (`src/main/docker.ts`). Forzar el kill de PostgreSQL = shutdown sucio → **crash recovery** en el siguiente arranque, que con un volumen `pgdata` de producción sobre Docker Desktop/WSL2 puede superar los 120s.

3. **`/api/health` dependía de la DB** (`src/server/index.ts`): hacía `prisma.company.count()`. Si la DB estaba recuperándose, cada intento de health abortaba a los 3s (timeout del `AbortSignal`) → nunca marcaba "ready".

4. **`docker compose up -d` devuelve 0 aunque el server crashee en loop** (`restart: unless-stopped`). La app esperaba a ciegas sin detectar el crash del contenedor `silverknight-server`.

5. **`prisma db push --accept-data-loss` corría en cada arranque** (`docker-entrypoint.sh`), agregando latencia fija por arranque.

## Correcciones aplicadas (v1.1.6)

| Área | Cambio |
|---|---|
| `before-quit` | `COMPOSE_PROJECT_NAME=silverknight` → shutdown graceful real de Postgres al salir |
| `cleanupStaleContainers` | Nunca toca `silverknight-db`; solo limpia server/orphanos |
| `startCompose` | No limpia contenedores en arranques normales; solo en conflicto (retry) |
| Health | `/api/health` = liveness inmediato sin DB; `/api/health/db` con el conteo (503 si DB caída) |
| Wait | `waitForBackendWithContainerCheck`: 180s + detecta contenedor server `exited/restarting` y muestra sus logs de inmediato |
| Diagnóstico | `gatherDiagnostics` incluye `docker compose ps` + estado del contenedor server |
| Update | `installUpdate` pre-calienta el cache Docker (pull + build) antes de `quitAndInstall` |
| Entrypoint | `prisma db push` solo cuando cambia el hash de `schema.prisma` (volumen `silverknight-schema-state`) |

## Verificación

- `npx vitest run`: 113/113
- `npm run typecheck`: limpio
- Pendiente: confirmar en máquina desplegada; si vuelve a fallar, capturar **"Copiar diagnóstico"** (ahora incluye `docker compose ps` y estado del contenedor) o `%APPDATA%\silver-knight\logs\main.log`
