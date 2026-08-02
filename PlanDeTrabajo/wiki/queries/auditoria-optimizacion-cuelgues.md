---
type: query
tags: [auditoria, optimizacion, cuelgues, rendimiento, renderer, main-process]
created: 2026-08-01
updated: 2026-08-01
---

# Auditoría de optimización — Cuelgues aleatorios durante el uso

## Síntoma reportado

> "El sistema se queda colgado sin razón aparente."

Perfil: **pequeño** (pocas ventas/día), cuelgues **al azar durante el uso** (no solo al abrir/cerrar). Operación: solo diagnóstico + fixes anti-hang.

## Método

Auditoría read-only del stack completo: renderer (React), server (Express + Prisma) y proceso main (Electron/Docker). Revisión de ~40 archivos. Sin cambios en fuentes inmutables ni en `planning/`.

## Hallazgos priorizados (perfil pequeño → causas de cuelgues aleatorios)

### Alta severidad (candidatas a congelamientos al azar)

1. **Logging síncrono en el hilo main** — `src/main/logger.ts` usaba `appendFileSync` en **cada** `writeLog`. El hilo main de Electron recibía un write a disco síncrono por cada:
   - mensaje de consola del renderer (`webContents.on('console-message')`, `src/main/index.ts:488`)
   - IPC `renderer-log` (`index.ts:531`)
   - progreso de descarga de update (cada %)
   
   Disco lento + log sin rotación + Windows Defender escaneando el `.log` → **stalls aleatorios** de la ventana completa. Es la causa más compatible con "cuelgues al azar".

2. **`ipcRenderer.sendSync` en el preload** — `src/preload/index.ts` (`getUpdateStatus`, `getVersion`) bloqueaba el hilo del renderer hasta que main respondiera. Si main estaba ocupado → congelamiento puntual. (No había consumidores activos, pero el canal quedaba expuesto.)

3. **Sin timeout en los fetch del renderer** — `src/renderer/src/lib/api.ts` (`request<T>`) no usaba `AbortSignal`. Cualquier request que se perdiera (blip de red/WSL2, DB reiniciándose) dejaba la UI en "Cargando..."/"Procesando..." indefinidamente.

4. **`waitForServer` sin timeout por intento** — `src/renderer/src/contexts/AuthProvider.tsx` reintentaba `api.health()` hasta 10×; si el backend aceptaba TCP pero nunca respondía, el arranque quedaba colgado.

### Media severidad

5. **Fetch de sync sin timeout** — `src/server/syncService.ts` (`syncNow`) no tenía `AbortSignal.timeout` en el fetch a la URL remota (a diferencia del fetch BCV, 10s). Un remoto colgado dejaba el server empujando entidades en serie (empresa→…→facturas con items/customer/fiscalControl) cada ciclo. Solo afecta si el sync está habilitado.

6. **ReportsPage re-descargaba por cada cambio de fecha** — el `useEffect` dependía de `[tab, rangeFrom, rangeTo, cashDate]`: cada clic en un date input disparaba la query pesada (`sales-range` sin paginación), además del botón "Consultar". Sin cancelación de requests previos → requests solapados.

### Baja severidad / escala (con perfil pequeño no causan el cuelgue, pero crecen)

7. Queries sin `take`/`select` en `reports.ts`, `ivaBooks.ts` (`/ventas`, `/compras`), `dashboard.ts` `/summary`, `customers.ts` GET `/:id` (incluyen `items`).
8. Sin `@@index` en `ExchangeRate.date` ni `SyncLog.createdAt` (`prisma/schema.prisma`).
9. `before-quit` usa `execSync('docker compose down')` (15s) en el hilo main.
10. Debounce existente (`useDebounce.ts`) solo aplicado en POSPage; falta en búsquedas de Products/Customers.
11. Regex potencialmente costosas en `parseBcvRate` (`exchangeRates.ts`).

## Correcciones aplicadas (2026-08-01)

| Área | Cambio |
|---|---|
| `logger.ts` | Escritura **asíncrona** (búfer + `appendFile` en cola, flush cada 50 líneas o 1s), rotación a 5 MB con 3 backups, `flushLogs()`/`flushLogsSync()` exportados |
| `main/index.ts` | `flushLogsSync()` en `before-quit` antes de `docker compose down` |
| `api.ts` | `request<T>` con timeout global `AbortSignal` (15s default), soporte `timeoutMs` por llamada y señal externa; error claro "La solicitud tardó demasiado" |
| `AuthProvider.tsx` | `api.health(5000)` por intento (5s c/u) + flag `cancelled` para evitar setState tras desmontar |
| `ReportsPage.tsx` | `useCallback loadData` con guard de secuencia (race-safe); effect solo re-descarga al **cambiar de tab**; botón "Consultar" con fechas actuales |
| `preload/index.ts` + `index.d.ts` | Eliminados `ipcRenderer.sendSync`; `getUpdateStatus`/`getVersion` ahora `invoke` async |
| `main/updater.ts` | Removidos handlers `ipcMain.on` de `get-update-status`/`get-app-version` (solo quedan los `invoke`) |
| `syncService.ts` | `AbortSignal.timeout(30000)` en el fetch de push al remoto |

## Verificación

- `npm run typecheck`: limpio (node + web).
- `npm test`: **113/113**.
- `npx electron-vite build`: OK (main, preload, renderer).
- Lint: 0 errores en los archivos modificados (los 11 errores globales restantes son preexistentes, en archivos no tocados).

## Pendiente recomendado (fase B/C, no ejecutado)

- Paginación/límites + `select` de columnas en `reports.ts`, `ivaBooks.ts`, `dashboard.ts`, `customers.ts`.
- Índices `@@index([date])` en `ExchangeRate` y `@@index([createdAt])` en `SyncLog`.
- Debounce en búsquedas de Products/Customers/Suppliers.
- Simplificar regex de `parseBcvRate`.
- `execSync` asíncrono en `before-quit`.

## Cómo confirmar futuros cuelgues

`main.log` ya registra `Window became unresponsive` y `RENDER PROCESS GONE` (`src/main/index.ts`). Con el logging ahora asíncrono y rotado (5 MB), revisar `%APPDATA%\silver-knight\logs\main.log` para correlacionar el instante del cuelgue.
