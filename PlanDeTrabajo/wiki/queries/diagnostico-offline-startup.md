---
type: query
tags: [diagnostic, offline, docker, startup, updater]
created: 2026-08-02
updated: 2026-08-02
sources: [v1.1.12, v1.1.13]
---

# Diagnóstico — Arranque offline-first (v1.1.13)

## Síntoma original
"La app no arranca sin internet". El core de negocio ya era 100% local (renderer → `localhost:3001`); lo que bloqueaba el arranque offline era el **stack Docker**:
1. `docker compose up -d` intenta hacer **pull** de `postgres:16-alpine` si la imagen no está cacheada.
2. `ensureServerImage` corre `docker compose build` (`npm ci` + `apk add`) cuando la versión de la app difiere del sentinel `.server-version` — sin red esto cuelga o falla.
3. El auto-update (`electron-updater`) intentaba consultar el feed y pasaba a estado `error`.

## Enfoque decidido
**Endurecer el arranque Docker** (no eliminar Docker): la app inicia y es usable sin internet; solo fallan con mensaje claro las funciones estrictamente de red (auto-update, tasa BCV, sync cloud).

## Cambios aplicados (v1.1.13)

### `src/main/docker.ts`
- `DB_IMAGE = 'postgres:16-alpine'`, `SERVER_IMAGE = 'silverknight-server:latest'`.
- `imageExists(name)` → `docker image inspect` con código de salida.
- `getImageAvailability()` → `{ db, server }` booleano.
- `pullDbImage(onOutput)` → `docker pull postgres:16-alpine` con streaming de salida.

### `src/main/server-image.ts` — `ensureServerImage` offline-aware
- Retorna `{ rebuilt: boolean, error?: string, skippedOffline?: boolean }`.
- Versión igual al sentinel → no rebuild.
- **Offline + imagen en caché** → skip rebuild (`skippedOffline: true`); el sentinel **no** se actualiza → el rebuild ocurre al volver online.
- **Offline + sin imagen** → error claro (no se puede reconstruir sin internet).
- **Online + build fallido + imagen existente** → continúa con la imagen cacheada (no fatal).
- **Online + build OK** → escribe sentinel.

### `src/main/index.ts` — `startBackend` (solo `app.isPackaged`)
- Imágenes presentes + `ensureServerImage` → **arranque offline OK**.
- Faltan imágenes + **offline** → `dialog.showMessageBox` tipo info: "Primera configuración requiere internet", botones `['Reintentar', 'Copiar diagnóstico', 'Salir']` (default 0, cancel 2). Reintentar → `return startBackend()`; Copiar → `copyDiagnostics()` luego reintenta; Salir → `app.quit()`.
- Faltan imágenes + **online** → pre-warm: `ensureServerImage` (server) + `pullDbImage` (db); errores no fatales (compose reintenta).

### `src/main/updater.ts` — check silencioso offline + retry
- `checkForUpdates()`: si `!net.isOnline()` → log + `pendingCheck = true` + return **sin** cambiar el estado a `error`.
- Reintento por **polling** de `net.isOnline()` cada 30s (`retryTimer`) mientras haya check pendiente.
- `startAutoCheck()` (4h) y `stopAutoCheck()` intactos; `stopAutoCheck` limpia `retryTimer` + `pendingCheck`.

### `docker-compose.yml`
- `services.db` → `pull_policy: missing`: compose usa la imagen cacheada si existe y no intenta pull offline.

## Notas técnicas
- `net.isOnline()` (Electron 43) **no es 100% confiable**: `false` es señal fuerte de que no hay conexión, pero `true` es inconcluso. Por eso la **garantía real es la imagen cacheada**; el check solo evita intentos de red inútiles.
- Electron 43 **eliminó los eventos `online`/`offline`** de `net` y `app` (no existen en `electron.d.ts`) → se usa polling de `net.isOnline()` con `setInterval`, no listeners de eventos.
- El diálogo de "primera configuración" usa `showMessageBox` asíncrono para no bloquear el hilo main.

## Verificación
- `npm run typecheck`: limpio.
- `npm test`: **122/122** (10 archivos; +9 tests: 2 offline en `updater.spec.ts`, 7 en `server-image.spec.ts`).
- `npm run lint`: **0 errores** en archivos tocados (los 11 errores preexistentes del repo están en otros archivos; 13288 warnings CRLF son preexistentes de todo el repo).

## Pendiente (E2E en máquina desplegada)
1. Desconectar la red, arrancar la app → debe abrir con la imagen cacheada y el update check quedar pendiente (no en error).
2. Con red, cambiar la versión de la app y arrancar offline → skip de rebuild; volver online → rebuild al próximo arranque.
3. Máquina limpia (sin imágenes Docker) + offline → debe mostrar el diálogo "Primera configuración requiere internet".
4. Volver online estando abierto → el auto-update reintenta el check pendiente (≤30s).

## Relación
- [[offline-first]] — concepto del principio (sección de arranque offline)
- [[docker-deployment]] — modelo de deployment con la fila v1.1.13
- [[diagnostico-error-3001-post-update]] — problema de backend anterior (no relacionado)
- [[diagnostico-server-exit-255-crlf]] — CRLF del entrypoint (v1.1.11 → v1.1.12), distinto
