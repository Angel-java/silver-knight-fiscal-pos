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

## Hallazgo post-v1.1.6 en máquina desplegada (2026-07-31)

El diálogo ya detecta el crash del contenedor, pero la causa exacta sigue oculta:

- **Diálogo**: *"El contenedor del servidor no está corriendo (estado: restarting, reinicios: 6)"*.
- **Logs del contenedor (truncados)**: loop `PostgreSQL is ready` → `Schema changed (or first run). Pushing schema...` → `Prisma schema loaded... at db:5432` y corta ahí → crash-loop dentro de `prisma db push` del entrypoint.
- El operador **no puede ejecutar comandos**; depende del botón "Copiar diagnóstico" del diálogo.

### Hipótesis (ordenadas por probabilidad)

1. **Fallo de autenticación Postgres** — el volumen `silverknight-pgdata` se inicializó con la contraseña antigua (pre-secretos) y no coincide con `POSTGRES_PASSWORD` de `.env`. El error real de Prisma (P1000) quedaba cortado en el truncado de 800 chars.
2. **OOM kill** — la salida se corta sin mensaje de error, compatible con el proceso muriendo por RAM insuficiente (WSL2/Docker Desktop).
3. **Volumen de datos corrupto/incompatible** — el `db push` no puede reconciliar el schema contra un `pgdata` dañado.

### Mejoras de diagnóstico implementadas (v1.1.7, en curso)

- `getServerContainerState` ahora expone **`oomKilled`** (`docker inspect ... {{.State.OOMKilled}}`) y **`exitCode`** (`{{.State.ExitCode}}`).
- Diálogo de fallo: si `oomKilled` → mensaje específico de memoria (RAM/WSL2). Si los logs contienen patrón de auth (`password authentication failed`, `Authentication failed against database server`, `role "silverknight" does not exist`, `SCRAM authentication`) → mensaje accionable de contraseña/volumen.
- Logs mostrados en el diálogo: 800 → **2000** chars; `getServerContainerLogs(50)` → **100** líneas en el diagnóstico.

## Confirmación con diagnóstico real del operador (2026-08-01)

El operador pegó el "Copiar diagnóstico" completo. Hechos:

1. **La imagen se construyó bien y rápido** (02:22:23→02:22:58, `npm ci` 13s, build ~23s, la mayoría CACHED) → el problema de registry lento de v1.1.5 está resuelto en esa máquina.
2. **La DB está sana**: `silverknight-db` `Up 41 minutes (healthy)`.
3. **`silverknight-server` crash-lopea**: `Restarting (1)`, restarts=15. El diálogo de v1.1.6 lo detectó 19s después del start.
4. **Logs del contenedor (completos, 50 líneas)**: loop idéntico en cada iteración →
   `PostgreSQL is ready` → `Schema changed (or first run). Pushing schema...` → `Prisma schema loaded` → `Datasource "db": ... at db:5432` → **se corta sin ningún error**.
5. **NO aparece P1000** (fallo de auth) → la hipótesis de contraseña queda descartada a menos que el error se pierda por buffering.
6. El hash de schema nunca se escribe (`Schema changed` en cada reinicio) porque el push nunca termina → loop infinito.
7. Warning de compose: `volume "silverknight-pgdata" already exists but was created for project "resources"` — volumen heredado de la config pre-v1.1.6 (inofensivo, compose lo reutiliza; datos preservados).

### Causa más probable: OOM kill

La salida se corta **sin mensaje de error** justo cuando `prisma db push` arranca el schema-engine nativo. Timing: el build terminó a las 02:22:58 (export + unpack de imagen son las fases más pesadas en RAM) y 2s después el contenedor del server arrancó → pico de memoria en WSL2 (Docker Desktop limita la RAM) → el kernel OOM-killea el proceso silenciosamente. El diagnóstico v1.1.6 no capturaba `ExitCode`/`OOMKilled` → no se podía confirmar.

### Plan v1.1.7 (implementado, verificado)

| Área | Cambio |
|---|---|
| Estado | `getServerContainerState` expone `oomKilled` + `exitCode` (137 = OOM) |
| Diálogo | Incluye `exit`, `oomKilled` y mensajes específicos; logs hasta 2000 chars |
| **Botón "Reparar"** | `runSelfHeal()`: (1) one-shot `prisma db push` capturando salida+exit code directamente; (2) si exit=137 → mensaje de RAM (Docker Desktop → Settings → Resources); si P1000 → mensaje de contraseña; (3) en éxito → escribe el hash de schema en el volumen + `docker compose restart server` + re-wait → app arranca sin terminal |
| Self-heal | `runPrismaPushOnce` (compose run --entrypoint npx), `writeSchemaStateHash` (docker run + sha256 exacto del archivo), `computeSchemaHash`, `restartServerContainer` |

### Próximo paso

Emitir v1.1.7. El operador instala → si OOM, el diálogo lo confirma (exit 137) y/o el botón Reparar aplica el schema en un one-shot con menos presión de memoria (el build ya terminó) → app arranca. Alternativa inmediata sin release: el operador sube la RAM de Docker Desktop por GUI (Settings → Resources → Memory ≥ 4096 MB → Apply & Restart) y reintenta v1.1.6.
