---
type: concept
tags: [architecture, offline, sync, resilience]
created: 2026-06-30
updated: 2026-08-27
sources: [plan-vision]
---

# Offline-first

Principio arquitectónico: el sistema funciona 100% sin conexión a internet. Fuente: [[plan-vision]].

## ¿Qué entidades operan offline?

- La **[[company|Company]]** completa: configuración, datos, todo local
- El **[[user|User]]** puede facturar sin internet
- La **[[invoice|Invoice]]** se emite y almacena 100% local
- El **[[product|Product]]** y el inventario se gestionan localmente
- El **[[cash-register|CashRegister]]** abre y cierra jornadas sin conexión

## Implicaciones

- La base de datos principal es **PostgreSQL local vía Docker** con imagen cacheada (no hay SQLite nativo en el código real; el arranque depende de Docker Desktop). Ver [[docker-deployment]].
- La nube (sync remoto) es opcional y se configura manualmente en Ajustes.
- Todas las operaciones críticas (facturación, inventario, caja, POS, reportes, migración) son locales.
- El sync es asíncrono cuando hay conexión y funciona mediante `localhost` entre renderer y backend.

## Arranque offline (v1.1.13)

Desde v1.1.13 el **arranque de la app también es offline-first**. El core de negocio ya corría 100% local (renderer → `localhost:3001`); lo que podía bloquear el inicio sin internet era Docker (`docker compose up -d` intenta pull de `postgres:16-alpine`; `ensureServerImage` corría `docker compose build` con `npm ci` en cambio de versión). Ver [[diagnostico-offline-startup]].

Reglas de arranque en `app.isPackaged`:

- **Imágenes presentes en la caché local + `ensureServerImage` OK** → la app arranca sin red. `docker compose up -d` ya no intenta pull porque `db` tiene `pull_policy: missing`.
- **Imágenes presentes + offline** → `ensureServerImage` hace skip del rebuild (no hay red para `npm ci`); el sentinel `.server-version` no se actualiza, así que el rebuild se ejecuta al volver online.
- **Faltan imágenes + offline** → diálogo informativo "Primera configuración requiere internet" con **Reintentar / Copiar diagnóstico / Salir** (no bloquea al usuario en un error opaco; puede copiar el diagnóstico para soporte).
- **Faltan imágenes + online** → pre-warm: `ensureServerImage` (server) + `pullDbImage` (db), errores no fatales.

## Endurecimiento offline (v1.1.25, pendiente de release)

### Fase A — Probe real de conectividad (`netProbe`)
- `net.isOnline()` es poco fiable (falsos positivos por DNS/antivirus/red intermedia). Se agregó `netProbe.isReallyOnline()`: si `net.isOnline()` es `false` → offline seguro (sin probe); si es `true` → verifica con un `fetch` real a un host estable con timeout corto y reintentos.
- En `startBackend`, si **ambas imágenes están en caché** se arranca **sin depender del probe** (la imagen cacheada es la garantía). El probe solo decide en el caso de imágenes faltantes (offline → diálogo; online → pre-warm).
- `net.isOnline()` se reemplazó por `isReallyOnline()` en `server-image.ts`, `updater.ts` y `index.ts`.

### Fase B — Sync resiliente offline (`syncService`)
- **Backoff**: tras un sync fallido, el siguiente intento se agenda en 1m → 5m → 15m (cap) en lugar de esperar el intervalo normal completo.
- **Sin pérdida de registros**: `lastSyncAt` **solo avanza cuando el sync termina sin errores**. Si una entidad falla (red caída a mitad), el cursor se queda atrás y en el próximo reintento se vuelven a consultar y re-enviar los registros pendientes. Esto presupone que el endpoint cloud de push es **idempotente**.

### Fase C — Tasa BCV offline y vigencia
- **Regla de negocio**: la factura se emite en bolívares y **exige tasa SIEMPRE**. Sin tasa (o vencida) el backend devuelve 400 con `errorCode` (`RATE_MISSING` o `RATE_EXPIRED`), y el POS abre un **modal de inserción manual** que guarda la tasa y reintenta la emisión. Ver [[dual-currency]].
- **Vigencia configurable**: nueva setting `bcvRateVigencyDays` (default 1 día). Si la última tasa supera la vigencia se considera vencida. Gestionada en Ajustes > Vigencia de la tasa.
- **Degradación visible**: `scheduler` registra el estado del último fetch automático (`bcvLastFetchStatus`/`bcvLastFetchAt`/`bcvLastFetchError`) que la SettingsPage muestra, para que el operador sepa por qué no hay tasa automática.

## Auto-update offline

`checkForUpdates` hace skip silencioso (sin estado `error`) y guarda un check pendiente que se reintenta por polling de `net.isOnline()` cada 30s. Las funciones estrictamente de red (tasa BCV, sync cloud) siguen fallando con mensaje claro, pero la app es usable.

## Reporte de fallas por conexión (mensaje claro)

Para que el operador entienda *por qué* falló una función de red, los errores de conectividad se normalizan en un mensaje claro en español: **"No hay conexión a internet. Verifica tu conexión e inténtalo de nuevo. (causa técnica)"** (se añade el detalle técnico entre paréntesis para diagnóstico).

- Implementado por `src/server/utils/connectionError.ts` (`connectionFailureMessage(err)`) → devuelve el mensaje claro si el error es de red/timeout (`fetch failed`, `ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`, `network error`, `abort`, etc.) o `null` si no lo es.
- Compartido por: auto-fetch BCV (`scheduler.ts`, persiste el mensaje claro en `bcvLastFetchError`), fetch BCV manual (`routes/exchangeRates.ts` POST `/bcv`, el error 502 dice "problema de conexión a internet" cuando aplica), sync cloud (`syncService.ts`, sustituye el error técnico por el claro en el listado de errores) y auto-update (`main/updater.ts`, check/download/evento `error` muestran el mensaje claro solo cuando el probe dice online pero el host final no responde).
- No cambia el diseño offline-first: el skip silencioso del auto-update offline se mantiene.

## Relación con otros conceptos

- [[offline-first]] no afecta [[dual-currency]]: las tasas se capturan localmente
- [[offline-first]] es compatible con [[fiscal-compliance]]: la facturación fiscal es local
- [[offline-first]] se apoya en [[docker-deployment]]: el arranque usa la imagen cacheada, sin red
