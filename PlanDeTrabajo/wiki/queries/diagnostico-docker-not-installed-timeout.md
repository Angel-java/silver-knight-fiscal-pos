---
type: query
tags: [docker, diagnostico, timeout, startup, antivirus]
created: 2026-08-23
updated: 2026-08-23
sources: [main-log-cliente-2026-08-23]
---

# Diagnóstico — "Docker no está instalado" en máquina con Docker instalado (v1.1.24)

## Síntoma

En una máquina cliente con Docker Desktop correctamente instalado (y funcionando en terminal normal), Silver Knight mostraba el error **"Docker Desktop no está instalado en esta máquina"** en cada arranque, sin llegar a levantar el backend.

## Causa raíz: timeout de 5s, no ausencia de Docker

`checkDockerInstalled()` (`src/main/docker.ts`) ejecutaba `execAsync('docker --version', { timeout: 5000 })`. En esa máquina, `docker --version` tarda entre 2 y 8 segundos (antivirus escaneando cada proceso nuevo + PATH lookup lenta dentro de la app empaquetada). El timeout mataba la llamada → el catch reportaba `{ installed: false }`.

### Evidencia del log (`main.log`, máquina afectada)

| Hora | Evento | Duración | Firma |
|---|---|---|---|
| 14:53:29→31 | Detección OK, compose up, pull postgres, build server | 1.9s | Normal |
| 14:58:58 | App cerrada durante export de build | — | — |
| 15:03:41→47.8 | "Docker not installed" | **6.2s** | = timeout 5000ms + overhead |
| 03:07 | "Docker not installed" | 5.5s | Timeout |
| 04:05 | "Docker not installed" | 5.7s | Timeout |
| 23:32 | "Docker not installed" | 8.1s | Timeout |

Regla de firma: **cualquier fallo de detección que tarde ≥5.4s es un timeout, no una ausencia real**. Un `docker --version` genuinamente fallido ("no se reconoce como comando") falla en <100ms. El shutdown también evidenció `spawnSync C:\WINDOWS\system32\cmd.exe ETIMEDOUT` al correr `docker compose down` (líneas 2306 y 2323 del log).

## Fix (v1.1.24)

Nuevo módulo `src/main/docker-path.ts`:

- **Timeout 20000ms** por sonda (antes 5000ms) — `DOCKER_CHECK_TIMEOUT_MS`
- **Resolución con caché**: `resolveDockerOnce()` prueba `docker` pelado (PATH) y si falla cae a rutas absolutas conocidas (`C:\Program Files\Docker\Docker\resources\bin\docker.exe`, variante x86, `%LOCALAPPDATA%\Docker\Docker\resources\bin\docker.exe`). El exe ganador queda cacheado (`getCachedDockerExe()`) y **todas** las invocaciones de `docker.ts`/`config.ts`/`before-quit` lo usan (spawns shell:true reciben el exe quoted; `writeSchemaStateHash` sin shell recibe la ruta cruda)
- **Reintentos**: `resolveDockerWithRetry()` = 3 intentos con backoff 1.5s×n (`DOCKER_CHECK_ATTEMPTS=3`). Cuando Docker no existe realmente, el comando falla rápido → los 3 intentos suman ~5s; cuando solo hay lentitud, el intento 2 o 3 resuelve
- **PATH hijo aumentado**: `getChildEnv()` antepone el dir del exe resuelto al PATH de procesos hijos (`docker compose exec/run`)
- **Diagnóstico enriquecido**: `gatherDiagnostics()` agrega salida de `where docker` con timing, exe resuelto, existencia de rutas candidatas y PATH del proceso
- **UI**: el diálogo de "no detectado" ahora ofrece **Reintentar / Copiar diagnóstico / Salir** (antes solo salía)
- **Tests**: 6 nuevos en `src/main/docker-path.spec.ts` (caché, fallback absoluto, recuperación en reintento, rendición tras N intentos, output no parseable)

## Lecciones

1. Nunca diagnosticar "instalado/no instalado" con un timeout menor que la latencia peor caso del entorno objetivo (POS venezolanos: AV agresivo, discos lentos).
2. Medir siempre la duración de las sondas y loggearla — fue la única vía para distinguir timeout de ausencia.
3. En Windows empaquetado, no confiar en un único mecanismo de resolución de binarios: PATH puede diferir entre sesión interactiva y contexto de app.

## Deuda documentada (fuera de alcance v1.1.24)

- **Log spam**: stderr de compose se registra dos veces (`[compose]` y `[config]`) durante pulls/builds
- **Wizard no lanza Docker Desktop**: `start-backend-after-wizard` (`config.ts`) llama `checkDockerRunning()` directamente y no lanza/espera Docker Desktop cuando el daemon está parado
- **Loop `.env` inválido**: sesión 2ª del log mostró reiteración de wizard por `.env exists but is missing required fields`

## Páginas relacionadas

- [[docker-deployment]] — modelo de deployment general
- [[diagnostico-error-3001-post-update]] — diagnóstico previo con metodología similar
- [[offline-first]]
