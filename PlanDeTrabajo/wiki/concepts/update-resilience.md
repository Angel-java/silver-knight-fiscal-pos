---
type: concept
tags: [updates, resilience, recovery, watchdog, offline, boot]
created: 2026-09-09
updated: 2026-09-09
sources: [plan-vision]
---

# Update Resilience

Capacidad del sistema para seguir descargando y aplicando actualizaciones **aunque la app esté rota** (UI inutilizable, backend caído o update malo). Es el complemento de [[offline-first]] pensado para actualizaciones que fallan en máquinas desplegadas sin soporte técnico presencial.

## Capas del mecanismo

La resiliencia se implementa en 5 capas, todas en el proceso main (fuera de la UI):

### Capa 0 — Auto-descarga (`updater.ts`)
- `autoDownload = true` desde la implementación: al detectar una nueva versión, electron-updater inicia la descarga **sin intervención del usuario** (se conserva `autoInstallOnAppQuit = true`).
- Al completarse la descarga se escriben dos cosas: (1) el instalador se **cachea localmente** vía `installerCache`, y (2) `pendingUpgrade` se marca en el `boot-state.json` con la versión descargada (`bootState.ts`).
- `hasDownloadedUpdate()` / `getPendingUpgradeVersion()` / `onDownloaded(cb)` / `downloadAndInstall()` exponen el estado para la ventana de recuperación y el watchdog.

### Capa 1 — Boot state (`bootState.ts`)
- Registro persistente en `userData` (`boot-state.json`) con: última versión que arrancó (`appVersion`), `lastCleanShutdown`, `consecutiveFailures`, `failuresAfterUpdate` y `pendingUpgrade` (solo se limpia si la versión pendiente coincide con la instalada).
- `markBootReady()` borra los contadores de fallo; `markCrash()`/`markBootFailed()` los incrementan.
- `markCrash` se engancha a `uncaughtException` y `render-process-gone` (crashed/oom) en `index.ts`.

### Capa 2 — Recuperación (`recovery.ts`)
- `handleUnrecoverableStartup(reason, updater)`: si hay update descargado → cierra la app para que se instale al salir; si no, abre la **ventana de recuperación** (`recovery.html` empaquetado en `resources/`) con IPC: `recovery:get-info`, `recovery:copy-diagnostics`, `recovery:apply-update`, `recovery:install-cached`, `recovery:install-offline`, `recovery:relaunch`, `recovery:quit`.
- `maybeAutoRepair()`: si `failuresAfterUpdate >= 2` tras un update, **reinstala silenciosamente la última versión buena en caché** y cierra la app (rollback automático). Índice de severidad de contradicciones: `soft`.
- Los handlers IPC se registran idempotentemente **también al arranque** (`index.ts`, bloque packaged), así el panel de Settings puede disparar las mismas acciones de reparación desde la app.

### Capa 3 — Caché de instaladores (`installerCache.ts`)
- Al descargar un update real, también se guarda una copia del `.exe` instalador en `userData/silver-knight/installers/` (máx. 2, los más nuevos).
- Cada copia lleva sidecar `<file>.sha512`; `verifyInstallerFile()` exige: header **MZ**, tamaño > 1MB **y** sha512 coincidente antes de ejecutar cualquier instalador.
- `pickRollbackInstaller()` devuelve la versión **anterior** (comparador semántico de versiones).
- Ejecución: `launchInstallerDetached()` (update normal) o `installInstallerBlocking()` con `/S` (rollback/watchdog, silencioso).
- Aplica también para el cacheo del instalador descargado (`cacheDownloadedInstaller`).

### Capa 4 — Watchdog fuera-de-banda (`watchdog.ts`)
- `ensureWatchdogRegistration()` (solo empaquetado) registra `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\SilverKnightWatchdog` apuntando a `<exe> --watchdog` al inicio de sesión de Windows.
- `runWatchdog()` (invocado por `silver-knight.exe --watchdog` desde `whenReady`): primero prueba un arranque sano leyendo el boot state; si el estado indica fallos > umbral → intenta (en orden): paquete offline → `latest.yml` de GitHub (sha512 verificado) → reinstalación silenciosa.
- Reusa el **single-instance lock**: si la app normal ya corre, el watchdog pierde el lock y sale sin hacer nada.
- `build/installer.nsh` (macro `customUnInstall` en el desinstalador NSIS) borra la clave `Run` al desinstalar.

### Capa 5 — Paquete offline/USB (`offlineUpdate.ts`)
- El operador coloca un **paquete de actualización** en `C:\SilverKnightUpdates` (override: env `OFFLINE_UPDATES_DIR`): `manifest.json` + instalador + sha512.
- `getApplicableOfflineInstaller(currentVersion)` solo acepta una versión **más nueva** verificada; `installOfflinePackage()` la instala en silencio.
- Ruta de reparación manual sin internet (la misma carpeta es la que documenta el panel de Settings).

## Seguridad

- **Toda** ejecución de instalador (update, rollback, watchdog, offline) verifica sha512 (formato base64 de electron-builder) + header MZ + tamaño mínimo.
- La clave `HKCU\...\Run` registra el exe en `QUOTED_VALUE` con comillas escapadas (`\\"`) para que `reg` no lo parta; se re-arma al arrancar si apunta a otro exe.

## Configuración a nivel usuario

En Ajustes > Actualizaciones > **Reparación y auto-recuperación** (SettingsPage): descripción del mecanismo + botón "Reinstalar última versión en caché" (llama a `recovery:install-cached`). La versión actual se muestra en el propio panel de Actualizaciones; el estado de descarga cambió su texto a "Descargando actualización..." (descarga automática).

## Relación con otros conceptos

- La auto-descarga y la resiliencia permiten que [[offline-first]] no se pierda cuando hay red parcial: el update se baja de fondo y se instala en el siguiente arranque.
- [[docker-deployment]] sigue siendo la capa del backend: un update que rompe el arranque del servidor dispara `handleUnrecoverableStartup('backend-start-failed')` en vez de dejar el splash pegado.
- Rendija de severidad documentada (`soft`): el rollback automático **reinstala la app** pero no revierte `prisma db push` (forward-only); el código viejo tolera columnas extra en la DB, por diseño.

## Estado del mecanismo (2026-09-09)

- Implementado y probado: Capas 0–5 completas sobre el código real, 280 tests (25 archivos) en verde, typecheck node+web limpio, y SettingsPage con panel de auto-recuperación.
- **Publicado**: v1.2.0 (tag `v1.2.0`, GitHub Release con `latest.yml` + instalador). Es la primera versión en la que la auto-descarga/caché/watchdog están operativos. Pendiente: confirmar el E2E del watchdog/rollback en máquina desplegada (fuera de alcance).