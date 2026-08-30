---
type: overview
tags: [log, chronology]
created: 2026-06-30
updated: 2026-08-30
---

# Log de operaciones â€” Silver Knight
## [2026-08-30] release-prep | v1.1.25 - E2E máquina desplegada + empaquetado reset-root + bump
- **Descripción**: cierre del fix [[diagnostico-login-root-drift]]. Se validó **end-to-end** en esta máquina el flujo de máquina desplegada: editar `ROOT_PIN` en `%APPDATA%\silver-knight\config\.env` -> reiniciar/reconstruir el server -> `autoCreateRoot()` **reconcilia el root desde el `.env` en arranque** -> login con el PIN nuevo funciona sin tocar la BD (confirmado también por hash bcrypt en BD). Se revertió a `7vThdmg3StSm` (login OK de nuevo). El drift ya **no se replica** y la remediación está en la propia máquina.
- **Páginas creadas/actualizadas**: [[diagnostico-login-root-drift]] (creada), [[reset-root-user]], [[index]], [[log]].
- **Cambios**:
  - `electron-builder.yml`: `extraResources` empaqueta `../opencode-tools/reset-root/reset-root.js` -> `resources\reset-root\reset-root.js` (remediación disponible en la máquina desplegada; requiere Node+Docker).
  - `docker-compose.yml` / `.env.docker.example`: `ROOT_PIN="${ROOT_PIN:-}"` (**guard vacío, no-op seguro**: si no se define, `autoCreateRoot()` no crea/modifica root) y `ROOT_USERNAME=${ROOT_USERNAME:-admin}`.
  - `package.json`/`package-lock.json`: bump a `1.1.25` (release lista para publicar, NO publicada aún).
  - `autoAdmin.test.ts`: de 5 a **7 casos** (añadidos: `ROOT_PIN` string vacío -> no-op; reconcile tras cambio de `.env` entre arranques de la misma BD).
  - Se detectó y corrigió **BOM UTF-8** inyectado por `Set-Content -Encoding UTF8` de PS5.1 en `package.json`/`package-lock.json` (rompía `tsx` -> `Error parsing /app/package.json`); se limpiaron BOM de `autoAdmin.ts`, `docker-compose.yml`, `.env.docker.example` y las páginas wiki editadas. Lección: **no usar `-Encoding UTF8` de PS5.1 sobre JSON/YAML/TS** (añade BOM).
- **Verificación**: 239/239 tests (21 archivos), `typecheck:node` limpio, `docker compose config` resuelve `ROOT_PIN` correctamente. E2E completo en ambas direcciones (PIN E2E -> login OK / PIN real -> login OK).
- **Pendiente**: NO publicar v1.1.25 hasta confirmación explícita del usuario.
## [2026-08-30] fix | Login root - auto-reconciliación de credenciales + rotación de PIN
- **Descripción**: diagnóstico del login "Credenciales inválidas" y arreglo sistémico. La causa raíz es un **drift de credenciales root** entre el `.env` y la BD: `autoCreateRoot()` en `src/server/auth/autoAdmin.ts` **solo creaba** el root al primer arranque (`if (existing) return`) y **nunca reconciliaba** el PIN si el `.env` cambiaba después. Además el default de `ROOT_USERNAME` era `alucard` (usuario inexistente en la BD -> 401 "Credenciales inválidas"). Se verificó por hash bcrypt que el root real en BD era `admin` con PIN `admin1234` (distinto del `ROOT_PIN` de 17 chars del `.env` de producción).
- **Páginas actualizadas**: [[reset-root-user]], [[log]], [[index]]
- **Cambios**:
  - **Fuente de verdad** = `.env` (`ROOT_USERNAME`/`ROOT_PIN`). `autoCreateRoot()` ahora **reconcilia en cada arranque**, no solo crea:
    1. Si existe usuario con `ROOT_USERNAME` -> si su PIN no coincide (`bcrypt.compare`) o su rol no es `root`, lo **actualiza** al valor actual de `ROOT_PIN`.
    2. Si no existe por nombre pero hay un root con otro nombre (ej. legacy `alucard`) -> lo **renombra** a `ROOT_USERNAME` y actualiza PIN/rol.
    3. Si no hay root -> lo crea (comportamiento previo).
  - Default de `ROOT_USERNAME` cambiado de `alucard` -> `admin` (alineado con `src/main/config.ts` y la tool `reset-root`).
  - `docker-compose.yml` (servicio `server`): se añadieron `ROOT_USERNAME` y `ROOT_PIN` al entorno (antes el contenedor no recibía estas vars -> el reconcile no podía operar en despliegue Docker).
  - `.env.example`: documentado `ROOT_USERNAME` (default `admin`).
  - Test nuevo `src/server/auth/__tests__/autoAdmin.test.ts` (5 casos: sin PIN -> no-op; crear; PIN igual -> no update; PIN distinto -> reconcile; rename legacy).
- **Seguridad (rotación)**: nuevo PIN root **`7vThdmg3StSm`** aplicado a la BD vía reset-root y a los `.env` (producción y repo). Se abandonó el PIN por defecto `admin1234`. En producción también se cambió `CORS_ORIGIN=*` -> `http://localhost:3001`.
- **Verificación**: 5/5 tests autoAdmin, 14/14 tests auth; container `silverknight-server` reconstruido y healthy; login real OK (HTTP 200, role root) con `admin`/`7vThdmg3StSm`; el PIN antiguo `admin1234` -> 401.
- **Pendiente**: probar E2E en máquina desplegada (arranque de la app empaquetada leyendo el `.env` de `%APPDATA%` y reconciliando).

## [2026-08-28] tool | Script independiente de cambio de credenciales del root
- **DescripciÃ³n**: se creÃ³ `opencode-tools/reset-root/reset-root.js`, **fuera** del cÃ³digo de `silver-knight/`, para cambiar el **username** y/o **PIN** del usuario root (`role='root'`) de una mÃ¡quina desplegada. El root es inmutable por API (`users.ts`), por lo que el script edita directamente la tabla `"User"` en Postgres vÃ­a `docker exec silverknight-db psql`. **Archivo Ãºnico autocontenido**: lleva **bcryptjs incrustado** (MIT) â†’ no requiere `npm install` en destino, solo Node.js. Credenciales por defecto editables al inicio (`USERNAME_POR_DEFECTO`, `PIN_POR_DEFECTO`).
- **PÃ¡ginas creadas/actualizadas**: [[reset-root-user]], [[index]], [[log]]
- **Cambios**:
  - `opencode-tools/reset-root/reset-root.js`: JS puro/CommonJS autocontenido (bcrypt embebido). Generate hash local bcrypt(10). Flags `--user`, `--pin`, `--user-only`, `--pin-only`, `--dry-run`, `--print-hash`, `--quiet`, `--container`, `--db-user`, `--db-name`. Sin args â†’ aplica defaults. Guard `require.main === module` (no se auto-ejecuta al ser requerido). Valida PIN â‰¥4, escapa comillas simples, verifica que el UPDATE afecte exactamente 1 fila.
  - `opencode-tools/reset-root/README.md`: documentaciÃ³n de uso (no requiere instalaciÃ³n).
  - No toca el `.env` de `%APPDATA%\silver-knight\config\.env` (nota en wiki/README: actualizar `ROOT_USERNAME`/`ROOT_PIN` manualmente para persistencia).
- **VerificaciÃ³n**: hash bcrypt generado por el script embebido validado contra entrada con `compareSync` (true); `--dry-run` muestra el SQL correcto sin ejecutar.

## [2026-08-28] build | Sistema de Apartado de Productos (Layaway)
- **DescripciÃ³n**: nuevo mÃ³dulo **Apartados** (permiso `apartados`, Ã­tem propio en el Dashboard, ruta `/api/reservations`). Permite apartar mercancÃ­a con un abono inicial y abonos parciales (USD o VES), reservando stock; al liquidar el saldo se emite la factura fiscal FACT. Frontera fiscal: el apartado y los abonos NO son documentos fiscales (no NCF, no Libros IVA); solo la factura final lo es. Recibo impreso Ãºnicamente al liquidar (la factura final vÃ­a `printInvoice`).
- **PÃ¡ginas creadas**: [[reservation]], [[reservation-item]], [[reservation-payment]], [[layaway]]
- **PÃ¡ginas actualizadas**: [[index]], [[log]], [[inventory-movement]] (nuevos tipos `reserved`/`unreserved`)
- **Cambios**:
  - `prisma/schema.prisma`: nuevos modelos `Reservation`, `ReservationItem`, `ReservationPayment`; relaciones con `Customer`/`User`/`Product`/`Invoice`; campo `currency` en cabecera.
  - `src/server/utils/controlNumbers.ts`: extraÃ­do `nextControlNumber`, `ensureDefaultControl`, `buildInvoiceNumber` (antes locales en `routes/invoices.ts`).
  - `src/server/routes/invoices.ts`: refactor a `computeInvoiceTotals` + `createFiscalInvoiceFromReservation` (crea la FACT **sin** volver a decrementar stock, ya que este ya estÃ¡ reservado).
  - `src/server/routes/reservations.ts`: `POST /` (crear: decrementa stock + mov `reserved`, totales duales, deposit < total; el apartado inicial `depositUsd`/`depositVes` acepta USD o VES con la tasa), `GET /`, `GET /:id`, `POST /:id/payments` (abono USD/VES con tasa congelada de cabecera; si viene solo `amountVes` lo convierte a USD con `amountVes/rate`), `POST /:id/finalize` (emite FACT, vincula `invoiceId`, mov queda en `sale`), `POST /:id/cancel` (devuelve stock + mov `unreserved`).
  - `src/server/scheduler.ts`: job diario (00:00) que expira apartados activos con `dueDate` vencida (devuelve stock, status `expired`).
  - `src/server/validation/schemas.ts`: `'apartados'` en `PERMISSION_MODULES` + schemas `createReservationSchema`, `addReservationPaymentSchema`, `finalizeReservationSchema`, `cancelReservationSchema`.
  - `src/server/index.ts`: monta `/api/reservations`.
  - Renderer: permiso `'apartados'` en `lib/api.ts` (+ tipos y bloque `reservations`), ruta `/apartados` en `App.tsx`, Ã­tem+icono en DashboardPage, nueva `ApartadosPage.tsx` (lista con tabs por estado, modal de creaciÃ³n con selector de productos, cliente existente o nuevo, apartado USD/VES, detalle con historial de abonos, abono con selector de moneda USD/Bs. y equivalente segÃºn tasa congelada, liquidar y cancelar). Vista de apartados por cliente integrada en la ficha de `CustomersPage.tsx` (`GET /api/customers/:id` ahora incluye `reservations`, secciÃ³n "Apartados" con nÃºmero, estado, total y saldo â†’ enlaza al mÃ³dulo Apartados).
- **VerificaciÃ³n**: typecheck node+web PASS; 232/232 tests (20 archivos; +10 `reservations.test.ts`); 0 errores eslint nuevos en archivos tocados (solo warnings CRLF prettier preexistentes del repo).

## [2026-08-27] build | Reporte de fallas por problemas de conexiÃ³n en funciones de red
- **DescripciÃ³n**: las funciones que requieren internet ahora reportan con un mensaje claro **"No hay conexiÃ³n a internet. Verifica tu conexiÃ³n e intÃ©ntalo de nuevo. (causa tÃ©cnica)"** cuando fallan por conectividad, en lugar de mostrar el error tÃ©cnico crudo al operador.
- **ImplementaciÃ³n**: nuevo `src/server/utils/connectionError.ts` con `connectionFailureMessage(err)` â†’ clasifica errores de red/timeout (`fetch failed`, `ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`, `network error`, `abort`, etc.) y devuelve el mensaje claro + causa; `null` si no es conectividad. Se aplicÃ³ en:
  - `scheduler.ts` (auto-fetch BCV): guarda el mensaje claro en `bcvLastFetchError` (visible en SettingsPage "Motivo").
  - `routes/exchangeRates.ts` POST `/bcv` (manual): el error 502 indica "problema de conexiÃ³n a internet" cuando aplica; `detail` normaliza cada error de red.
  - `syncService.ts`: sustituye el error tÃ©cnico por el claro en el listado de errores del sync.
  - `main/updater.ts`: check/download y evento `error` muestran el mensaje claro solo cuando el probe dice online pero el host final no responde; se mantiene el skip silencioso offline-first.
- **PÃ¡ginas tocadas**: [[offline-first]], [[log]]
- **VerificaciÃ³n**: typecheck node+web PASS; 222/222 tests (19 archivos; +7 `connectionError.test.ts`, +1 caso en `updater.spec.ts`); 0 errores eslint (nuevo mÃ³dulo LF sin warnings; archivos CRLF conservan los warnings prettier preexistentes del repo).

## [2026-08-27] build | Endurecimiento offline-first (netProbe + vigencia de tasa + sync resiliente)
- **DescripciÃ³n**: implementadas las Fases A, B y C del plan de endurecimiento offline (sin internet, con Docker), segÃºn decisiÃ³n de alcance y prioridad documentada en [[offline-first]] y [[docker-deployment]].
  - **Fase A â€” probe de conectividad real**: nuevo `src/main/netProbe.ts` con `isReallyOnline()` (si `net.isOnline()` es false â†’ offline seguro sin probe; si true â†’ `fetch` real a un host estable con timeout y reintentos). Integrado en `src/main/index.ts` (decisiÃ³n de arranque), `server-image.ts` y `updater.ts`. Con imÃ¡genes cacheadas el arranque ya no depende del probe (la cachÃ© es la garantÃ­a); el probe decide solo cuando faltan imÃ¡genes.
  - **Fase C â€” vigencia de tasa + inserciÃ³n manual**: regla de negocio fijada (la factura se emite en Bs. y exige tasa SIEMPRE; sin tasa o vencida â†’ bloqueo con inserciÃ³n manual). Nueva setting `bcvRateVigencyDays` (default 1) gestionada en Ajustes > Vigencia de la tasa. `POST /invoices` devuelve 400 con `details.errorCode` (`RATE_MISSING`/`RATE_EXPIRED`). `PaymentModal` abre `RateModal` (nuevo, offline) que guarda la tasa manual y reintenta. `scheduler` registra estado del fetch BCV (`bcvLastFetchStatus/At/Error`) visible en SettingsPage.
  - **Fase B â€” sync resiliente**: `syncService` con retry con backoff (1mâ†’5mâ†’15m, cap) y **`lastSyncAt` solo avanza si el sync termina sin errores** (no se pierden registros al volver online; presupone push idempotente).
- **PÃ¡ginas tocadas**: [[offline-first]], [[docker-deployment]], [[dual-currency]], [[index]], [[log]]
- **VerificaciÃ³n**: typecheck node+web PASS; 215/215 tests (18 archivos; +5 `netProbe.spec.ts`, +9 `rateSettings.test.ts`, +3 `syncService.spec.ts`, +4 casos de vigencia en `invoices.test.ts`); 0 errores eslint nuevos (el Ãºnico error de lint observable en `PaymentModal.tsx` es preexistente en HEAD).
- **Pendiente**: release v1.1.25 con estos cambios y E2E offline en mÃ¡quina desplegada (arranque sin red con imagen cacheada, facturaciÃ³n sin tasa solicitando inserciÃ³n manual, sync que se recupera al volver online).

## [2026-08-23] fix | Falso "Docker no instalado" por timeout de 5s (v1.1.24)
- **DescripciÃ³n**: en una mÃ¡quina cliente con Docker Desktop correctamente instalado, la app reportaba "Docker Desktop no estÃ¡ instalado" en cada arranque. Evidencia del `main.log` del cliente (2323 lÃ­neas): todos los fallos de detecciÃ³n tardaban â‰¥5.4s (6.2s, 5.5s, 5.7s, 8.1s) = firma exacta del `timeout: 5000` de `checkDockerInstalled()`; la detecciÃ³n OK previa tardÃ³ 1.9s. Causa raÃ­z: AV escaneando cada proceso nuevo + PATH lookup lenta hacen que `docker --version` tarde 2â€“8s â†’ el timeout lo mataba y el catch reportaba `{installed: false}`. El shutdown tambiÃ©n mostrÃ³ `spawnSync cmd.exe ETIMEDOUT` al correr `docker compose down`.
- **Fix** (commits `fd5bc99` fix + `b0c3362` bump, tag `v1.1.24`): nuevo mÃ³dulo `src/main/docker-path.ts` con resoluciÃ³n de CLI cacheada (`resolveDockerOnce()` prueba PATH â†’ rutas absolutas conocidas; `getCachedDockerExe()` accesor sÃ­ncrono usado por todas las invocaciones de `docker.ts`, `config.ts` y `before-quit`), timeouts 5000â†’20000ms, 3 reintentos con backoff, PATH hijo aumentado en `getChildEnv()`, diÃ¡logo con Reintentar/Copiar diagnÃ³stico/Salir, `gatherDiagnostics()` enriquecido (where docker + timing + rutas candidatas + PATH del proceso) y `launchDockerDesktop()` con candidatos LOCALAPPDATA/derivados.
- **PÃ¡ginas tocadas**: [[diagnostico-docker-not-installed-timeout]] (nueva), [[docker-deployment]], [[index]], [[log]]
- **VerificaciÃ³n**: typecheck node+web PASS; 194/194 tests (15 archivos, +6 nuevos en `docker-path.spec.ts`: cachÃ©, fallback absoluto, recuperaciÃ³n en reintento, rendiciÃ³n tras N intentos, skips sin probe, output no parseable); lint 0 errores en archivos tocados.
- **Deuda documentada** (fuera de alcance): log spam stderr duplicado `[compose]`/`[config]`; wizard no lanza Docker Desktop cuando el daemon estÃ¡ parado; loop `.env exists but is missing required fields`.
- **Pendiente**: confirmar en la mÃ¡quina afectada que el arranque resuelve; CI quality sigue con los errores lint preexistentes (no bloquea releases).

## [2026-08-21] fix | ImportaciÃ³n todo-o-nada + diagnÃ³stico de import fantasma (v1.1.23)
- **DescripciÃ³n**: el usuario reportÃ³ que importar un respaldo JSON (~380 registros) desde otra instalaciÃ³n Silver Knight "no importÃ³ nada" pese a que la UI y el `MigrationLog` reportaban Ã©xito (`imported=379`). DiagnÃ³stico con evidencia de BD + contenedor encontrÃ³ 3 causas encadenadas: (1) imagen Docker stale (construida 2026-08-17T21:04Z, anterior a `bb4749d`): el validador viejo exigÃ­a `username && pin` pero el exportador omite `pin` â†’ todos los usuarios fallaban; el clasificador viejo no detectaba conflictos de `settings` â†’ P2002. (2) Bug estructural vigente: transacciÃ³n gigante Ãºnica tragando errores por registro; el primer statement fallido abortaba la tx en Postgres (cascada `25P02`), Prisma no lanza al commitear tx abortada, el cÃ³digo continuaba y escribÃ­a un log de Ã©xito falso con 0 filas persistidas. (3) El healthcheck del contenedor usaba `localhost` (resolvÃ­a a `::1` IPv6 donde Node no escucha) â†’ contenedor `unhealthy` pese a servir bien.
- **Fix** (commit `64968e0`, tag `v1.1.23`): `importer.ts` reescrito con planificador pre-vuelo (`buildImportPlan`) compartido por preview e import: valida schema por registro, duplicados intra-archivo (usernames, nombres categorÃ­a/proveedor, code/barcode producto, RIFs, nÃºmeros factura, keys settings, tipo+prefijo fiscal) y resuelve referencias caminando `BACKUP_ORDER` con mapas simulados; si hay cualquier error â†’ rechazo total `400` con `details: [{entity, errors:[{row,message}]}]`, sin tocar la BD y registrando el intento fallido en `MigrationLog`. EjecuciÃ³n transaccional sin swallow: cualquier fallo de BD revierte todo (`500`) y tambiÃ©n se registra. Referencias a usuarios root omitidos se mapean a `null` (no es error). CSV de productos exige que `category`/`supplier` existan en destino. UI: lista de errores al rechazar, botÃ³n bloqueado si el preview tiene errores, visor expandible de `errorDetail` en Historial, `ApiError.details` en `api.ts`. Dockerfile healthcheck â†’ `127.0.0.1`.
- **PÃ¡ginas tocadas**: [[data-migration]], [[index]], [[log]]
- **VerificaciÃ³n**: typecheck node+web PASS; 188/188 tests (14 archivos, +7 nuevos: todo-o-nada, duplicados intra-archivo, referencias rotas, rootâ†’null, CSV categorÃ­a inexistente, preview dup, ruta 400 estructurada); lint 0 errores en archivos tocados; rebuild `docker compose build server` + `up -d` â†’ ambos contenedores healthy; preview del respaldo real contra la BD viva con el cÃ³digo nuevo â†’ 0 errores (usuario sin pin ya no falla).
- **Pendiente**: reintentar desde la UI la importaciÃ³n del archivo grande (~380 registros) con credenciales root del usuario y verificar persistencia; confirmar CI quality/release v1.1.23 en verde.

## [2026-08-20] release | v1.1.22 publicada â€” selector de directorio de exportaciÃ³n
- **DescripciÃ³n**: primera release que incluye el selector de carpeta de exportaciÃ³n del mÃ³dulo de migraciÃ³n (commit `cc8898b`, escrito el 2026-08-19 y quedado local hasta hoy). El usuario elige dÃ³nde guardar exportaciones JSON/CSV; se persiste en Settings (`exportDir`), con fallback relativo `silverknight`. Cambio 100% lado cliente (IPC `select-directory` nuevo + parÃ¡metro opcional `defaultDir` en `save-file`); Ãºnico cambio server es constante muerta (`DEFAULT_EXPORT_DIR` en `config.ts`, sin importadores).
- **AuditorÃ­a pre-release** (solicitada para no romper mÃ¡quinas productivas):
  - Sin cambios de schema Prisma entre `v1.1.21` y HEAD â†’ no hay `prisma db push` en despliegue â†’ cero riesgo OOM/migraciÃ³n.
  - Compatibilidad bidireccional verificada: cliente nuevo â†” imagen server vieja OK (offline-safe: `ensureServerImage` salta rebuild sin internet y la imagen cacheada v1.1.21 es funcionalmente idÃ©ntica).
  - Riesgos menores documentados: default de exportDir es relativo al CWD (NSIS per-user â†’ escribible); guardar `exportDir` requiere permiso `settings` (falla silenciosa â†’ usa default).
- **VerificaciÃ³n**: typecheck node+web PASS, 181/181 tests (14 archivos), lint con solo los 11 errores preexistentes en archivos no tocados por el commit.
- **Flujo**: push `cc8898b` â†’ bump `package.json` 1.1.22 (commit `00e702f`) â†’ tag `v1.1.22` â†’ `release.yml` success (~3 min).
- **Release**: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.22 â€” assets `silver-knight-1.1.22-setup.exe` + `.blockmap` + `latest.yml` (`version: 1.1.22`). `/releases/latest` â†’ v1.1.22.
- **Nota**: el log no tiene entradas de release para v1.1.15â€“v1.1.21 (iteraciÃ³n sobre el mÃ³dulo de migraciÃ³n: permisos import root-only revertido en v1.1.20, `resolvePermissions` merge en v1.1.21); ver `git log --oneline`.
- **Pendiente**: CI quality y Build Windows Installer siguen rojos en main por lint preexistente (no bloquea releases); limpiar los 11 errores cuando se aborde deuda tÃ©cnica.

## [2026-08-16] build | MÃ³dulo de MigraciÃ³n de Datos (export/import)
- **DescripciÃ³n**: mÃ³dulo completo para migrar datos dentro del mismo sistema y hacia sistemas diferentes. Formatos CSV (catÃ¡logo/maestros) y JSON (`silverknight-backup` v1, respaldo completo/facturas). Import con dry-run (`/preview`), estrategias `skip`/`overwrite`/`create-new`, transacciÃ³n con rollback y `MigrationLog`. Permisos: export root+admin, import/preview solo root (rate-limit 10/h, body 25MB).
- **PÃ¡ginas creadas**: [[data-migration]]
- **PÃ¡ginas actualizadas**: [[index]], [[log]]
- **Archivos creados**:
  - `src/server/migration/csv.ts`, `formats.ts`, `exporter.ts`, `importer.ts`
  - `src/server/routes/migration.ts` (scopes/export/templates/preview/import/logs)
  - `src/renderer/src/pages/DataMigrationPage.tsx`
  - Tests: `csv.test.ts`, `exporter.test.ts`, `importer.test.ts`, `routes/__tests__/migration.test.ts`
- **Archivos modificados**: `schema.prisma` (`Invoice.importedFrom` + modelo `MigrationLog`), `server/index.ts` (montaje antes del json global), `validation/schemas.ts` (`PERMISSION_MODULES` + `'data-migration'`), `api.ts`, `App.tsx`, `SettingsPage.tsx`, `DashboardPage.tsx`, `UsersPage.tsx`
- **Reglas fiscales**: `FiscalControl` nunca se sobrescribe; user root nunca se pisa; facturas importadas son histÃ³ricas (`importedFrom='backup'`) y no avanzan `FiscalControl.currentNumber` del destino; FKs remapeadas por prefijo (`category-N`, `supplier-N`, `product-N`).
- **VerificaciÃ³n**: `npm test` 174/174 (14 files), typecheck node+web PASS, `prisma generate` OK. Lint: solo warnings CRLF prettier; 12 errores eslint **preexistentes** no relacionados (PaymentModal, main.tsx, afterPack.js, etc.).
- **Pendiente**: `prisma db push` contra BD dev falla (P1000 credenciales localhost:5432); schema se aplicarÃ¡ en entorno Docker/productivo.


## [2026-06-30] init | InicializaciÃ³n de la wiki
- **DescripciÃ³n**: CreaciÃ³n inicial de la estructura LLM Wiki siguiendo el patrÃ³n de Karpathy
- **PÃ¡ginas creadas**: [[index]], [[log]], [[overview]], [[company]], [[user]], [[dual-currency]], [[fiscal-compliance]], [[offline-first]]
- **Herramientas**: `tools/lint.sh`, `tools/search.sh`, `tools/stats.sh`
- **Notas**: Proyecto en fase de planificaciÃ³n pre-desarrollo. 60 tareas definidas en Phase 1 (Small). PlanDeTrabajo/ copiado a raw/planning-snapshots/ como fuentes inmutables.

## [2026-06-30] fix | Tejer relaciones entre pÃ¡ginas
- **DescripciÃ³n**: CreaciÃ³n de pÃ¡ginas faltantes y wikilinks entre todas las pÃ¡ginas
- **PÃ¡ginas creadas**: [[category]], [[customer]], [[exchange-rate]], [[invoice]], [[invoice-item]], [[cash-register]], [[product]], [[setting]], [[architectural-decision-003]]
- **PÃ¡ginas actualizadas**: [[overview]], [[dual-currency]], [[fiscal-compliance]], [[offline-first]], [[company]], [[user]], [[index]]
- **Resultado lint**: 0 huÃ©rfanos, 0 enlaces rotos

## [2026-06-30] ingest | Ingesta de 6 planning snapshots como fuentes wiki
- **Fuentes**: `raw/planning-snapshots/plan-vision.md`, `roadmap.md`, `tasks.md`, `architectural-decisions.md`, `db-schema.md`, `small-profile-phase.md`
- **PÃ¡ginas creadas**: [[plan-vision]], [[roadmap]], [[tasks]], [[architectural-decisions]], [[db-schema]], [[small-profile-phase]]
- **PÃ¡ginas actualizadas**: [[index]]
- **Notas**: Ahora cada fuente tiene su propia pÃ¡gina en wiki/sources/ con enlaces a las entidades y conceptos que documenta

## [2026-06-30] fix | Eliminar nodos duplicados en la wiki
- **DescripciÃ³n**: Se corrigieron 4 casos de duplicaciÃ³n â€” (1) architectural-decision-003.md simplificado a stub que delega en dual-currency.md, (2) referencia circular eliminada en dual-currency.md, (3) wikilink ADR-005 corregido en fiscal-compliance.md, (4) overview.md reducido eliminando tablas duplicadas de PLAN.md
- **PÃ¡ginas actualizadas**: [[architectural-decision-003]], [[dual-currency]], [[fiscal-compliance]], [[overview]], [[index]]
- **Resultado lint**: 0 huÃ©rfanos, 0 enlaces rotos

## [2026-07-01] build | Etapa 1.1 y 1.2 completadas
- **DescripciÃ³n**: Scaffolding del proyecto completado â€” Electron + Vite + React + TypeScript + TailwindCSS + Express embebido + Prisma SQLite
- **PÃ¡ginas actualizadas**: [[tasks]], [[roadmap]], [[index]], [[log]]
- **Archivos creados**:
  - `silver-knight/src/main/server/index.ts` â€” Servidor Express embebido
  - `silver-knight/src/main/database/prisma.ts` â€” Cliente Prisma singleton
  - `silver-knight/prisma/schema.prisma` â€” Schema con 10 modelos (Company, User, ExchangeRate, Category, Product, Customer, Invoice, InvoiceItem, CashRegister, Setting)
- **Detalle**: Proyecto inicializado con `npm create @quick-start/electron` (template react-ts). Express en puerto 3001 dentro del proceso main. MigraciÃ³n Prisma ejecutada (`prisma/migrations/`). Tailwind v3 con PostCSS. Build y typecheck pasan limpios.
- **Tareas completadas**: 17 de 60 (Etapa 1.1 y 1.2)

## [2026-07-01] build | Etapa 1.3 completada â€” Auth + Setup
- **DescripciÃ³n**: Sistema de autenticaciÃ³n local con JWT + login con PIN, wizard de primer uso (empresa + admin), dashboard placeholder con navegaciÃ³n
- **Archivos creados**:
  - `src/main/server/routes/auth.ts` â€” Endpoints POST /login, POST /setup, GET /me, GET /company
  - `src/main/server/middleware/auth.ts` â€” JWT middleware + generaciÃ³n de tokens
  - `src/renderer/src/contexts/AuthContext.tsx` â€” Contexto de sesiÃ³n global
  - `src/renderer/src/lib/api.ts` â€” Cliente API con fetch
  - `src/renderer/src/pages/LoginPage.tsx` â€” Pantalla de login con username + PIN
  - `src/renderer/src/pages/SetupWizardPage.tsx` â€” Wizard de 2 pasos (empresa â†’ admin)
  - `src/renderer/src/pages/DashboardPage.tsx` â€” Dashboard con menÃº y resumen
- **Dependencias**: react-router-dom, @tanstack/react-query, bcryptjs, jsonwebtoken
- **Tareas completadas**: 23 de 60 (Etapas 1.1, 1.2, 1.3)

## [2026-07-01] build | Etapa 1.4 completada â€” Productos e Inventario
- **DescripciÃ³n**: CRUD completo de categorÃ­as y productos con bÃºsqueda, stock con alerta de mÃ­nimo, ajustes de inventario
- **Archivos creados**:
  - `src/main/server/routes/categories.ts` â€” API CRUD de categorÃ­as
  - `src/main/server/routes/products.ts` â€” API CRUD de productos + ajuste de stock
  - `src/renderer/src/pages/CategoriesPage.tsx` â€” GestiÃ³n de categorÃ­as con modal
  - `src/renderer/src/pages/ProductsPage.tsx` â€” Lista con bÃºsqueda, paginaciÃ³n, stock, ajuste
  - `src/renderer/src/pages/ProductFormPage.tsx` â€” Formulario con precio dual, costo, IVA, categorÃ­a
- **Tareas completadas**: 30 de 60 (Etapas 1.1 a 1.4)

## [2026-07-01] build | Mejoras en Settings, costos y UI
- **DescripciÃ³n**: API de settings (GET/PUT /api/settings), margen de ganancia configurable en SettingsPage, auto-cÃ¡lculo de precio desde costo + margen en ProductFormPage, reorden de campos (costo antes que precio), reemplazo de emojis rotos por SVGs en Dashboard y ProductsPage, fix de teclado numÃ©rico (type="number" â†’ text+inputMode)
- **Archivos creados**: `src/main/server/routes/settings.ts`
- **Archivos modificados**: `App.tsx`, `DashboardPage.tsx`, `ProductFormPage.tsx`, `ProductsPage.tsx`, `SettingsPage.tsx`, `api.ts`, `server/index.ts`
- **Tareas completadas**: 31 de 60 (Etapas 1.1 a 1.4 + 1.9.1)

## [2026-07-01] build | Etapa 1.5 â€” POS (Punto de Venta)
- **DescripciÃ³n**: Interfaz POS completa con buscador de productos, carrito, selector de moneda USD/VES, cÃ¡lculo de IVA, mÃ©todos de pago (efectivo/transferencia/punto/mixto), cÃ¡lculo de vuelto, finalizaciÃ³n de factura con descuento de stock y generaciÃ³n de nÃºmero secuencial
- **Archivos creados**: `src/main/server/routes/invoices.ts`, `src/renderer/src/pages/POSPage.tsx`
- **Archivos modificados**: `server/index.ts`, `App.tsx`, `api.ts`
- **Tareas completadas**: 38 de 60 (Etapas 1.1 a 1.5 parcial + 1.9.1)

## [2026-07-02] build | Etapa 1.7 completada â€” FacturaciÃ³n Fiscal SENIAT
- **DescripciÃ³n**: ImplementaciÃ³n completa de requisitos fiscales venezolanos. MigraciÃ³n de DB con modelo FiscalControl + campos fiscales en Invoice. NumeraciÃ³n por talonario con control SECUENCIAL. GeneraciÃ³n de nÃºmero CF (Comprobante Fiscal) con formato SENIAT. Soporte para Factura, Nota de CrÃ©dito y Nota de DÃ©bito. AnulaciÃ³n de facturas con restituciÃ³n de stock y registro de motivo. Libros IVA de Ventas y Compras con filtro por perÃ­odo. Vista de factura con todos los datos fiscales (nÃºmero CF, resoluciÃ³n, RIFs). PÃ¡gina de gestiÃ³n de talonarios en Ajustes.
- **Archivos creados**:
  - `prisma/migrations/20260702232936_add_fiscal_control/` â€” MigraciÃ³n: modelo FiscalControl + campos documentType, cancelReason, cancelledAt, fiscalControlId en Invoice
  - `src/main/server/routes/fiscalControl.ts` â€” API CRUD de talonarios + auto-creaciÃ³n de default
  - `src/main/server/routes/ivaBooks.ts` â€” API libros IVA de Ventas y Compras
  - `src/renderer/src/pages/FiscalControlPage.tsx` â€” GestiÃ³n de talonarios
  - `src/renderer/src/pages/IvaBooksPage.tsx` â€” Consulta de libros IVA
- **Archivos modificados**: `schema.prisma`, `invoices.ts`, `server/index.ts`, `api.ts`, `InvoiceViewPage.tsx`, `App.tsx`, `SettingsPage.tsx`, `TASKS.md`, `overview.md`, `index.md`
- **Tareas completadas**: 51 de 60 (Etapas 1.1 a 1.7 + 1.9.1)

## [2026-07-02] build | Etapa 1.6 completada â€” MÃ³dulo de Clientes
- **DescripciÃ³n**: CRUD completo de clientes con datos fiscales (RIF), historial de compras por cliente, lÃ­mites de crÃ©dito USD/VES. IntegraciÃ³n con POS para seleccionar cliente en tiempo real. MenÃº Clientes restaurado en el Dashboard.
- **Archivos creados**:
  - `src/main/server/routes/customers.ts` â€” API CRUD con bÃºsqueda, paginaciÃ³n, validaciÃ³n de duplicados
  - `src/renderer/src/pages/CustomersPage.tsx` â€” Lista con bÃºsqueda, modal de crear/editar, detalle con historial de facturas
- **Archivos modificados**: `server/index.ts`, `api.ts`, `App.tsx`, `DashboardPage.tsx`, `POSPage.tsx`, `TASKS.md`, `overview.md`, `index.md`
- **Tareas completadas**: 42 de 60 (Etapas 1.1 a 1.6 + 1.9.1)

## [2026-07-02] fix | Mantenimiento â€” menÃºs rotos y wiki desactualizada
- **DescripciÃ³n**: Se removieron los enlaces del Dashboard a "Clientes" y "Reportes" que navegaban a rutas inexistentes (caÃ­an en redirect al inicio). Se actualizÃ³ overview.md (31â†’38 tareas) e index.md.
- **Archivos modificados**: `DashboardPage.tsx`, `overview.md`, `index.md`
- **Notas**: Clientes (etapa 1.6) y Reportes (etapa 1.8) se agregarÃ¡n de vuelta al menÃº cuando se implementen sus respectivos mÃ³dulos.

## [2026-07-02] build | Etapa 1.8 completada â€” Reportes y Dashboard
- **DescripciÃ³n**: ImplementaciÃ³n completa de reportes con 5 tabs (Ventas Diarias, Ventas por PerÃ­odo, Inventario, Top Productos, Cierre de Caja) con datos en tiempo real desde la API. ReportsPage con tabla de facturas navegable, desglose por mÃ©todo de pago, filtros de fecha, y botÃ³n Imprimir/PDF. Reportes API endpoints creados en ruta `/reports`. MenÃº Reportes restaurado en DashboardPage.
- **Archivos creados**:
  - `src/main/server/routes/reports.ts` â€” 5 endpoints: sales-daily, sales-range, inventory, top-products, cash-close
  - `src/renderer/src/pages/ReportsPage.tsx` â€” UI completa con 5 tabs, summaries, tablas de datos
- **Archivos modificados**: `server/index.ts`, `api.ts`, `App.tsx`, `DashboardPage.tsx`, `TASKS.md`, `overview.md`, `index.md`
- **Tareas completadas**: 58 de 60 (Etapas 1.1 a 1.8 + 1.9.1)

## [2026-07-02] build | Etapa 1.9 completada â€” ConfiguraciÃ³n del Sistema
- **DescripciÃ³n**: ImplementaciÃ³n completa de la configuraciÃ³n del sistema. BCV auto-fetch (POST /api/exchange-rates/bcv con parser HTML). ConfiguraciÃ³n de impresiÃ³n (ancho de papel, encabezado/pie). Selector de perfil Small/Medium/Big. EdiciÃ³n de datos de empresa (PUT /api/auth/company). GestiÃ³n de usuarios (CRUD completo con ruta /api/users y pÃ¡gina UsersPage con tabla, crear/editar modal, activar/desactivar).
- **Archivos creados**:
  - `src/main/server/routes/users.ts` â€” API CRUD de usuarios (list, create, update con cambio de PIN/rol/estado)
  - `src/renderer/src/pages/UsersPage.tsx` â€” UI completa con tabla, modal de crear/editar, toggle activo/inactivo
- **Archivos modificados**: `exchangeRates.ts` (BCV fetch + parser), `auth.ts` (PUT /company), `server/index.ts`, `api.ts`, `SettingsPage.tsx`, `App.tsx`, `DashboardPage.tsx`, `TASKS.md`, `overview.md`, `index.md`
- **Tareas completadas**: 64 de 70 (Etapas 1.1 a 1.9)

## [2026-07-02] build | Etapa 1.10 completada â€” ImpresiÃ³n TÃ©rmica + Fase 1 terminada
- **DescripciÃ³n**: ImplementaciÃ³n completa de impresiÃ³n tÃ©rmica ESC/POS. GeneraciÃ³n de comandos ESC/POS raw con formato de ticket fiscal (encabezado, items, totales, IVA, desglose por moneda, mÃ©todos de pago, corte de papel). ComunicaciÃ³n con impresora vÃ­a `lp` (Linux/macOS). API de listado de impresoras (`lpstat`). Vista previa del ticket en modal con tipografÃ­a mono. ReimpresiÃ³n desde InvoiceViewPage. Prueba de impresiÃ³n en SettingsPage con selecciÃ³n de impresora.
- **Archivos creados**:
  - `src/main/server/printer.ts` â€” Generador ESC/POS (`buildThermalTicket`) + comunicaciÃ³n (`printRaw`, `printInvoice`, `getAvailablePrinters`)
  - `src/main/server/routes/print.ts` â€” API endpoints: GET /printers, POST /invoice/:id
- **Archivos modificados**: `server/index.ts`, `api.ts`, `InvoiceViewPage.tsx`, `SettingsPage.tsx`, `TASKS.md`, `overview.md`, `index.md`
- **Tareas completadas**: 70 de 70 â€” **Fase 1 Small Profile terminada** ðŸŽ‰

## [2026-07-03] fix | Lint masivo + bugs responsive + auto-cÃ¡lculo VES
- **DescripciÃ³n**: CorrecciÃ³n de 100 errores de lint + 2 bugs funcionales + mejora responsive del POS y Dashboard.
- **Lint corregido**:
  - 8x `set-state-in-effect` â€” migraciÃ³n a async IIFE inline en POSPage, ProductsPage, ReportsPage, SettingsPage, UsersPage, FiscalControlPage, IvaBooksPage
  - 4x `exhaustive-deps` â€” inlining de efectos en POSPage, ReportsPage, CategoriesPage, CustomersPage
  - 1x `only-export-components` â€” AuthContext.tsx dividido en [[AuthContext]], [[AuthProvider]], [[useAuth]]
  - 87x `explicit-function-return-type` â€” `: void`, `: Promise<void>`, `: boolean`, `: string`, `: JSX.Element` agregados en 18 archivos
- **Bug fix**: `ProductFormPage.tsx` â€” costVes no se calculaba cuando `profitMargin = 0`; ahora se calcula siempre que haya `exchangeRate > 0`, independiente del margen
- **Responsive**:
  - `POSPage.tsx`: layout `flex-col lg:flex-row` â€” mobile apilado (carrito abajo con `max-h-[45vh]`), desktop side-by-side. Grid de productos: `grid-cols-2 sm:3 lg:3 xl:4`
  - `DashboardPage.tsx`: `grid-cols-5` â†’ `grid-cols-6` â€” los 6 botones del menÃº caben en una fila en pantalla completa
- **Resultado lint**: 0 errores, 0 warnings
- **Resultado typecheck**: 0 errores

## [2026-07-04] audit | AuditorÃ­a de arquitectura
- **DescripciÃ³n**: RevisiÃ³n completa del cÃ³digo fuente backend, frontend, base de datos, seguridad, y documentaciÃ³n
- **PÃ¡ginas creadas**: [[auditoria-arquitectura]]
- **PÃ¡ginas actualizadas**: [[index]]
- **Score global**: 6.5/10
- **Hallazgos crÃ­ticos**: 0 tests (0/10), API_BASE hardcodeada (viola ADR-004), error handling repetitivo en 45+ lugares, POSPage monolÃ­tico (647 lÃ­neas)
- **Fortalezas**: separaciÃ³n de capas sÃ³lida, dual currency nativo, fiscal compliance desde dÃ­a 1, Prisma migrations
- **Recomendaciones**: agregar tests primero, centralizar errores, hacer API_BASE configurable, rate limiting en login

## [2026-07-04] plan | Plan de Cliente Web + Cloud Server
- **DescripciÃ³n**: CreaciÃ³n del plan tÃ©cnico para extender Silver Knight con cloud sync (Fase 3.1) y web client SPA (Fase 3.3). Arquitectura Cloud â†’ Web Client con PostgreSQL, sync receiver, y React SPA independiente.
- **PÃ¡ginas creadas**: [[web-client-cloud-plan|Plan â€” Cliente Web + Cloud Server]]
- **PÃ¡ginas actualizadas**: [[index]]
- **Notas**: Archivo guardado en `PlanDeTrabajo/planning/web-client-cloud-plan.md`. 2 fases: Cloud Server (A.1-A.6) y Web Client (B.1-B.10). Pendiente de iniciar implementaciÃ³n.

## [2026-07-06] delete | EliminaciÃ³n del plan Cliente Web + Cloud Server
- **DescripciÃ³n**: Eliminado el plan de Cliente Web + Cloud Server por replanteamiento de la direcciÃ³n del proyecto. Se removiÃ³ el archivo `web-client-cloud-plan.md`, la referencia en `PLAN.md` ("Web client para gestiÃ³n centralizada") y la etapa 3.3 de `ROADMAP.md`.
- **Archivos eliminados**: `PlanDeTrabajo/planning/web-client-cloud-plan.md`
- **PÃ¡ginas actualizadas**: [[index]]
- **Notas**: El usuario va a replantear desde cero cÃ³mo debe funcionar el cliente web.

## [2026-07-07] build | Sistema de Control de Entradas de Inventario
- **DescripciÃ³n**: ImplementaciÃ³n del mÃ³dulo de movimientos de inventario con audit trail completo. Nuevo modelo `InventoryMovement` con tipos `entry`, `exit`, `sale`, `cancellation`. El stock adjustment manual ahora crea movimientos, las facturas registran `sale`, y las anulaciones registran `cancellation`.
- **PÃ¡ginas creadas**: [[inventory-movement]]
- **PÃ¡ginas actualizadas**: [[product]], [[index]]
- **Archivos creados**:
  - `src/main/server/routes/inventoryEntries.ts` â€” API CRUD de movimientos
  - `src/renderer/src/pages/InventoryEntriesPage.tsx` â€” UI con tabla, filtros por tipo, modal de creaciÃ³n
- **Archivos modificados**: `schema.prisma`, `products.ts`, `invoices.ts`, `server/index.ts`, `api.ts`, `ProductsPage.tsx`, `App.tsx`, `DashboardPage.tsx`, `schemas.ts`
- **MigraciÃ³n**: `20260708022835_add_inventory_movement`
- **Tests**: 82/82 pasan

## [2026-07-11] docs | .env.example + README de replicaciÃ³n
- **DescripciÃ³n**: Creado `.env.example` con todas las variables de entorno documentadas y reescrito `README.md` con guÃ­a completa de replicaciÃ³n del entorno de desarrollo en otra terminal.
- **Archivos creados**: `silver-knight/.env.example`
- **Archivos modificados**: `silver-knight/README.md`
- **Contenido README**: stack tecnolÃ³gico, prerequisitos (Node 20+, build tools), pasos de replicaciÃ³n (clone â†’ env â†’ install â†’ prisma â†’ dev), tabla de variables de entorno, scripts npm, modo Docker, estructura del proyecto, endpoints API, CI/CD pipeline, requisitos de hardware
- **Commit**: `e09cf3c`

## [2026-07-27] fix | Auto-updates, seguridad y repo pÃºblico
- **DescripciÃ³n**: RevisiÃ³n completa del sistema de auto-updates, correcciÃ³n de bugs, integraciÃ³n de docker-updater, eliminaciÃ³n de secretos del cÃ³digo y historial de git, y migraciÃ³n a repo pÃºblico.
- **Archivos modificados**: `updater.ts`, `docker-updater.ts`, `index.ts`, `preload/index.ts`, `preload/index.d.ts`, `UpdateNotification.tsx`, `SettingsPage.tsx`, `autoAdmin.ts`, `Dockerfile`, `docker-compose.yml`, `start-dev.ts`, `.env.example`, `.env.docker.example`, `package.json`, `.gitignore`
- **Archivos creados**: `scripts/setup.ts`, `updater.spec.ts`, `docker-updater.spec.ts`
- **Cambios clave**:
  - Progress bar real en UpdateNotification (antes hardcodeado a 60%)
  - Cleanup de listeners IPC en preload y componentes React
  - `getVersionAsync` para eliminar `sendSync` del renderer
  - `docker-updater.ts` integrado al startup con feedback al splash
  - 29 tests nuevos (110 total)
  - Script `npm run setup` genera `.env` con credenciales seguras
  - Secretos eliminados de cÃ³digo: PIN root, DB password, Dockerfile DATABASE_URL
  - Historial de git reescrito con `git-filter-repo` (sin secretos)
  - Repo migrado a pÃºblico en GitHub
- **Pendiente**: Revisar script de configuraciÃ³n para instalaciÃ³n en producciÃ³n
- **Commits**: `de363b2` (post reescritura)

## [2026-07-31] build | v1.1.5 publicada â€” Docker offline + imagen de servidor cacheable
- **DescripciÃ³n**: EliminaciÃ³n de la causa raÃ­z del error de puerto 3001 en la mÃ¡quina desplegada. Cada arranque corrÃ­a `docker compose up -d --build`, y la capa de deps del Dockerfile (`COPY package.json â†’ npm ci`) se invalidaba en cada bump de versiÃ³n de la app (el `package.json` de `resources/` contiene la versiÃ³n). En la mÃ¡quina desplegada (acceso lento a registry) el build fallaba â†’ backend nunca arrancaba.
- **Cambios clave**:
  - `startCompose` ahora corre `docker compose up -d` **sin `--build`** â€” arranques normales offline e instantÃ¡neos con la imagen cacheada
  - Nuevo `server/package.json` + `server/package-lock.json` (solo deps del servidor, versiÃ³n fija `1.0.0`): la capa `npm ci` ya no se invalida con releases de la app; rebuilds post-update son capas locales rÃ¡pidas
  - `Dockerfile`: stage `deps` usa `server/package.json`/`lock`; schema copiado despuÃ©s del `npm ci`
  - `ensureServerImage` (`server-image.ts`): rebuild solo cuando cambia la versiÃ³n de la app; sentinel `.server-version` movido a `userData` (`%APPDATA%`, escribible incluso bajo `Program Files`); fallo de rebuild NO fatal â†’ la app cae a la imagen existente en vez de errorear
  - DiÃ¡logos de fallo con botÃ³n **"Copiar diagnÃ³stico"** (docker ps + logs del contenedor + tail de `main.log` â†’ portapapeles) para que el operador de la mÃ¡quina desplegada pueda enviar la causa real
- **VerificaciÃ³n local E2E**: sentinel vacÃ­o â†’ rebuild cacheado (4s) â†’ `up -d` offline â†’ backend listo en ~22s â†’ app estable. `npx vitest run` 110/110, typecheck limpio, `docker compose build` segunda vez 100% CACHED en 0.2s
- **Release**: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.5
- **Commit**: `54d3626`
- **Pendiente**: confirmar en la mÃ¡quina desplegada; si falla, que el operador envÃ­e el diagnÃ³stico copiado o `%APPDATA%\silver-knight\logs\main.log`

## [2026-07-31] fix | v1.1.6 â€” causas raÃ­z del error 3001 post-update (confirmado en mÃ¡quina desplegada)
- **Fuente**: operador de mÃ¡quina desplegada â€” splash pegado en "Esperando al servidor" â†’ timeout â†’ diÃ¡logo puerto 3001
- **PÃ¡ginas tocadas**: [[docker-deployment]], [[diagnostico-error-3001-post-update]], [[index]]
- **Resumen**: el `up -d` ya devolvÃ­a OK pero el backend no respondÃ­a en 120s. Causas: (1) `before-quit` corrÃ­a `docker compose down` sin `COMPOSE_PROJECT_NAME` â†’ no-op â†’ Postgres nunca se apagaba limpio; (2) `cleanupStaleContainers` hacÃ­a `rm -f` de la DB en cada arranque â†’ crash recovery lento sobre volumen de producciÃ³n; (3) `/api/health` dependÃ­a de la DB â†’ health checks fallaban durante recuperaciÃ³n; (4) `up -d` no reportaba crash-loops del contenedor server; (5) `prisma db push` corrÃ­a en cada arranque
- **Cambios clave**:
  - `index.ts`: `before-quit` con `COMPOSE_PROJECT_NAME=silverknight` (shutdown graceful real); arranque usa `waitForBackendWithContainerCheck` (180s) que detecta contenedor `exited/restarting` y muestra sus logs de inmediato; `gatherDiagnostics` con `docker compose ps` + estado del contenedor server
  - `docker.ts`: `cleanupStaleContainers` excluye `silverknight-db`; `startCompose` limpia solo en conflicto; helpers `getServerContainerState`/`getComposePsText`; `waitForBackend` default 180s + log
  - `server/index.ts`: `/api/health` liveness inmediato sin DB; `/api/health/db` nuevo (503 si DB caÃ­da)
  - `updater.ts`: pre-warm del cache Docker (pull + build) antes de `quitAndInstall`
  - `docker-entrypoint.sh` + `docker-compose.yml`: `prisma db push` solo cuando cambia el hash de `schema.prisma` (volumen `silverknight-schema-state`)
- **VerificaciÃ³n**: `npx vitest run` 113/113 (3 tests nuevos de pre-warm), typecheck limpio, lint sin errores nuevos
- **Release**: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.6
- **Commit**: `f8883c5`
- **Pendiente**: confirmar en la mÃ¡quina desplegada; si vuelve a fallar, capturar "Copiar diagnÃ³stico" (ahora incluye compose ps + estado del contenedor)

## [2026-07-31] diagnose | Crash-loop confirmado en `prisma db push` + diagnÃ³stico ampliado
- **Fuente**: operador de mÃ¡quina desplegada â€” diÃ¡logo v1.1.6 reporta "El contenedor del servidor no estÃ¡ corriendo (estado: restarting, reinicios: 6)"
- **PÃ¡ginas tocadas**: [[diagnostico-error-3001-post-update]]
- **Resumen**: los logs del contenedor muestran un loop en `prisma db push` dentro del entrypoint (sale "Prisma schema loaded... at db:5432" y se corta antes de mostrar el error real). ReproducciÃ³n local con DB limpia Postgres 16: `db push` OK en 508ms â†’ el schema no es el problema. HipÃ³tesis: (1) fallo de autenticaciÃ³n (volumen `pgdata` inicializado con contraseÃ±a pre-secretos, no coincide con `.env`), (2) OOM kill (la salida se corta sin mensaje de error), (3) volumen corrupto.
- **Cambios (en curso, v1.1.7)**:
  - `getServerContainerState` expone `oomKilled` (`docker inspect ... {{.State.OOMKilled}}`)
  - DiÃ¡logo de fallo: mensajes especÃ­ficos si `oomKilled` (RAM/WSL2) o si los logs matchean patrones de auth (`password authentication failed`, `Authentication failed against database server`, `role "silverknight" does not exist`, `SCRAM authentication`)
  - Logs del diÃ¡logo 800 â†’ 2000 chars; `getServerContainerLogs(50)` â†’ 100 lÃ­neas
- **PrÃ³ximo paso**: operador debe enviar el "Copiar diagnÃ³stico" (v1.1.6 ya lo incluye completo, ~50 lÃ­neas de logs del contenedor) para confirmar la causa antes de emitir v1.1.7

## [2026-08-01] diagnose | DiagnÃ³stico completo recibido â†’ OOM como causa mÃ¡s probable â†’ self-heal v1.1.7
- **Fuente**: operador pegÃ³ el "Copiar diagnÃ³stico" completo de v1.1.6
- **PÃ¡ginas tocadas**: [[diagnostico-error-3001-post-update]]
- **Hallazgos**: (1) imagen construida bien y rÃ¡pido (registry OK, v1.1.5 resuelto); (2) DB `Up (healthy)`; (3) server `Restarting`, restarts=15; (4) logs del contenedor muestran loop en `prisma db push`: `Datasource "db"...` y se corta **sin error**; (5) **no hay P1000** â†’ descartado fallo de auth; (6) hash de schema nunca se escribe â†’ re-push infinito; (7) warning `pgdata` creado por project "resources" (inofensivo, datos preservados). **Causa mÃ¡s probable: OOM kill** â€” build terminÃ³ a las 02:22:58 (export/unpack pesados en RAM) y el contenedor arrancÃ³ 2s despuÃ©s â†’ pico de memoria WSL2 â†’ kill silencioso.
- **Cambios v1.1.7 implementados**:
  - `getServerContainerState`: +`oomKilled` +`exitCode` (137 = OOM)
  - DiÃ¡logo: exit/oomKilled en el mensaje; logs hasta 2000 chars
  - **BotÃ³n "Reparar"** (`runSelfHeal`): one-shot `prisma db push` con salida+exit capturados directo â†’ clasifica (137â†’RAM, P1000â†’contraseÃ±a) â†’ en Ã©xito escribe hash de schema + `compose restart server` + re-wait â†’ arranque sin terminal
  - Helpers nuevos en docker.ts: `runPrismaPushOnce`, `computeSchemaHash` (sha256 exacto de bytes, compatible con `sha256sum` del entrypoint), `writeSchemaStateHash`, `restartServerContainer`
- **VerificaciÃ³n**: typecheck limpio, 113/113 tests, eslint 0 errores en archivos tocados
- **Pendiente**: emitir release v1.1.7 (o, alternativa sin release, operador sube RAM de Docker Desktop por GUI â‰¥4096 MB)

## [2026-08-01] release | v1.1.7 publicada â€” self-heal para crash-loop de `prisma db push`
- **DescripciÃ³n**: release con el botÃ³n "Reparar" y diagnÃ³stico OOM/exitus. El operador instala; si el push one-shot reporta exit 137 â†’ subir RAM de Docker Desktop por GUI (Settings â†’ Resources â†’ Memory â‰¥ 4096 MB â†’ Apply & Restart); si reporta P1000 â†’ reintroducir contraseÃ±a en ConfiguraciÃ³n. En Ã©xito, la app escribe el hash de schema y arranca sin terminal.
- **Cambios clave**: botÃ³n "Reparar" (`runSelfHeal`) en el diÃ¡logo de fallo; `getServerContainerState` con `oomKilled` + `exitCode`; helpers `runPrismaPushOnce` (compose run one-shot con salida/exit capturados), `computeSchemaHash` (sha256 de bytes exacto, compatible con `sha256sum` del entrypoint), `writeSchemaStateHash` (docker run al volumen schema-state), `restartServerContainer`; logs 100 lÃ­neas / 2000 chars
- **VerificaciÃ³n**: typecheck limpio, 113/113 tests, eslint 0 errores en archivos tocados
- **Release**: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.7 (assets: `silver-knight-1.1.7-setup.exe` sha512 `70CD23919827C49CCD08E139432D537CD2DC94890CE60E875E09A95D9B7E5FDA6B6EFE7D6784B77D8D96F0EDDE1B5A3AF66D85AF4D9B627353F18EF7D3CAB73F`, `.blockmap`, `latest.yml`)
- **Commit**: `cd561a4` (fix) + `9e80402` (docs wiki)
- **Nota**: electron-builder publicÃ³ 2 drafts con assets partidos (bug conocido) â€” se limpiaron y la release se creÃ³ manualmente con `gh release create`; el draft residual de v1.1.6 tambiÃ©n se eliminÃ³
- **Pendiente**: confirmar en la mÃ¡quina desplegada; pedir al operador el resultado del botÃ³n "Reparar" (exit code) o "Copiar diagnÃ³stico" si falla

## [2026-08-01] diagnose | DiagnÃ³stico v1.1.7 desplegado â€” build cacheado tambiÃ©n crashea â†’ OOM crÃ³nico; binario desplegado â‰  release
- **Fuente**: operador â€” diagnÃ³stico post-instalaciÃ³n v1.1.7 (header `app v1.1.7`, sentinel `Saved server image version: 1.1.7`)
- **PÃ¡ginas tocadas**: [[diagnostico-error-3001-post-update]]
- **Hallazgos**: (1) la lÃ­nea `Server container: ...restarts=7` **NO incluye `oomKilled`**, aunque el tag v1.1.7 (`git show v1.1.7:src/main/index.ts`) sÃ­ lo imprime â†’ el binario desplegado no es el release publicado (probable instalaciÃ³n obsoleta; se resuelve con reinstall limpio); (2) el build v1.1.7 fue casi todo CACHED (export 1.1s vs 16.5s) y el contenedor **igual crasheÃ³ en `prisma db push`** â†’ **descarta el pico de RAM por build**; (3) la salida vuelve a cortar en `Datasource "db": ... at db:5432` sin error â†’ **OOM crÃ³nico por RAM insuficiente de WSL2** (mÃ¡quina siempre al lÃ­mite, no solo durante el build).
- **ImplicaciÃ³n**: la causa es memoria insuficiente de Docker Desktop (no la app). Fix dual: (a) subir RAM de Docker Desktop â‰¥4096 MB (GUI), (b) auto-reparaciÃ³n en la app para que el push one-shot tenga mÃ¡xima probabilidad de Ã©xito (detener el contenedor en crash antes del push libera memoria).

## [2026-08-01] release | v1.1.8 publicada â€” auto-reparaciÃ³n sin botÃ³n + entrypoint endurecido
- **DescripciÃ³n**: el operador ya no debe pulsar "Reparar": ante `container-crashed` la app ejecuta `runSelfHeal()` automÃ¡ticamente y solo si falla muestra el diÃ¡logo con la causa clasificada. Se detiene el contenedor en crash-loop antes del push one-shot (libera node+prisma en colisiÃ³n). Entrypoint endurecido: si `prisma db push` falla imprime el exit code y sale con ese cÃ³digo (fin del crash silencioso); el hash de schema solo se escribe si el push tuvo Ã©xito.
- **Cambios clave**:
  - `index.ts`: `selfHealAttempted` (1 intento automÃ¡tico por sesiÃ³n); auto-heal en `backendResult.status === 'container-crashed'`; diÃ¡logo final sin botÃ³n "Reparar" (`['Reintentar', 'Copiar diagnÃ³stico', 'Salir']`); `gatherDiagnostics` +`exitCode` + `docker system df`
  - `docker.ts`: `stopServerContainer()` (`compose stop server`), `getDockerSystemDf()`
  - `docker-entrypoint.sh`: `! npx prisma db push 2>&1; rc=$?` â†’ echo exit + `exit $rc`; hash solo si push OK
- **VerificaciÃ³n**: typecheck limpio, 113/113 tests, eslint 0 errores en archivos tocados
- **Release**: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.8 (assets: `silver-knight-1.1.8-setup.exe` sha512 `8F5D6335C6DB9ED12538F24F60E0EFE892919400489C04B76BAB1D69C9049F33895D823A0D7F5784FD391DC102955659FC638F60E6F32A1D1DB9FA8E441B5372`, `.blockmap`, `latest.yml`)
- **Pendiente**: operador desinstala Silver Knight (Settings â†’ Apps â†’ Silver Knight â†’ Uninstall) e instala v1.1.8 limpio; si el diÃ¡logo clasifica exit 137 â†’ subir RAM de Docker Desktop â‰¥4096 MB; si el push one-shot tiene Ã©xito â†’ hash escrito â†’ servidor arranca sin terminal

## [2026-08-01] diagnose | CAUSA CONFIRMADA: P1000 (autenticaciÃ³n), NO OOM â€” el error siempre estuvo en stderr
- **Fuente**: operador â€” diagnÃ³stico v1.1.8 completo (logs del contenedor ahora con `2>&1`)
- **PÃ¡ginas tocadas**: [[diagnostico-error-3001-post-update]]
- **Hallazgos**: (1) los logs del contenedor muestran por fin el error real: `Error: P1000: Authentication failed against database server, the provided database credentials for silverknight are not valid`; (2) la contraseÃ±a del `.env` (`%APPDATA%\silver-knight\config\.env`) NO coincide con la que usÃ³ el volumen `silverknight-pgdata` al inicializarse; (3) la contraseÃ±a original fue **generada aleatoriamente** en la instalaciÃ³n inicial y nunca se mostrÃ³ â†’ el operador no la sabe; (4) la contraseÃ±a original quedÃ³ "quemada" en el volumen cuando el wizard no detectÃ³ el volumen existente (`detectExistingDockerVolume` requiere Docker corriendo) y generÃ³ una nueva.
- **Bug propio descubierto (v1.1.8)**: el entrypoint imprimÃ­a `exit code 0` en fallos â€” `if ! npx prisma db push ...; then rc=$?` captura el `$?` de la negaciÃ³n (0), no del comando. Se corrige en v1.1.9 (`npx ... 2>&1; rc=$?; if [ $rc -ne 0 ]`).
- **Bloqueo de UX**: el wizard `EnvSetupPage` solo aparece si `config.exists()` es falso; como la config existe (con contraseÃ±a mala), el operador no tenÃ­a ningÃºn botÃ³n para corregir la contraseÃ±a.
- **Descartado definitivamente**: OOM / subir RAM de Docker Desktop (la salida cortada era solo stderr no capturado).

## [2026-08-01] release | v1.1.9 publicada â€” restablecer contraseÃ±a de Postgres conservando datos
- **DescripciÃ³n**: ante P1000 el diÃ¡logo ofrece **"Restablecer contraseÃ±a"**: la app genera una contraseÃ±a nueva, la aplica al volumen existente vÃ­a `docker compose exec -T db psql -U postgres -c "ALTER USER ..."` (la imagen postgres permite conexiÃ³n local por unix socket con `trust`, sin tocar `pg_hba.conf` â†’ NO se pierde ningÃºn dato), guarda la nueva contraseÃ±a en `.env` preservando el resto (`savePostgresPassword`), y relanza `startBackend()` (compose `up -d` recrea el contenedor server con la nueva DATABASE_URL).
- **Cambios clave**:
  - `docker.ts`: `resetPostgresPassword(newPassword)` (exec spawn con shell:true y SQL entrecomillada para el shell)
  - `config.ts`: `generatePassword` exportada; `savePostgresPassword(password)` (solo actualiza POSTGRES_PASSWORD + DATABASE_URL)
  - `index.ts`: `runResetPassword()`; flujo de fallo reestructurado â€” `isAuthProblem` (P1000/auth desde logs o mensaje del self-heal) â†’ diÃ¡logo con botÃ³n "Restablecer contraseÃ±a"; fix del diagnÃ³stico `authPattern` con P1000
  - `docker-entrypoint.sh`: fix del exit code (bug `if !` de v1.1.8)
- **VerificaciÃ³n**: typecheck limpio, 113/113 tests, eslint 0 errores en archivos tocados
- **Release**: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.9 (assets: `silver-knight-1.1.9-setup.exe` sha512 `94926E8D22C6807AA79B609EEA8102A0D0089BDA08BE229521C845B5B787436537C216542D6A46A544D4C383AD761881D0F19CDA57885B5A7FDCA8D2CE093B6F`, `.blockmap`, `latest.yml`)
- **AcciÃ³n del operador**: instalar v1.1.9; si aparece el diÃ¡logo de P1000 â†’ pulsar **"Restablecer contraseÃ±a"** (conserva datos) â†’ la app cambia la contraseÃ±a de la BD y arranca.

## [2026-08-01] diagnose | Reset v1.1.9 fallÃ³: rol superusuario no es `postgres`
- **Fuente**: operador â€” diagnÃ³stico v1.1.9 tras pulsar "Restablecer contraseÃ±a"
- **PÃ¡ginas tocadas**: [[diagnostico-error-3001-post-update]]
- **Hallazgos**: (1) el flujo del botÃ³n funcionÃ³: self-heal auto â†’ P1000 â†’ diÃ¡logo â†’ operador pulsÃ³ "Restablecer contraseÃ±a"; (2) el ALTER fallÃ³ con `psql: FATAL: role "postgres" does not exist` â†’ el superusuario de la BD es `silverknight` (el `POSTGRES_USER`), no `postgres`; (3) el trust por unix-socket SÃ funciona (el error aparece tras la conexiÃ³n/auth) â†’ el mecanismo es correcto, solo el nombre del rol estaba hardcodeado; (4) el operador quedÃ³ en loop resetâ†’reintentarâ†’reset.
- **Fix v1.1.10**: `resetPostgresPassword` usa `loadEnvForChild()['POSTGRES_USER'] || 'silverknight'` para `psql -w -U <user> -c "ALTER USER <user> PASSWORD ..."`. Un rol siempre puede cambiar su propia contraseÃ±a â†’ funciona aunque `silverknight` no fuera superusuario.

## [2026-08-01] release | v1.1.10 publicada â€” reset con el rol correcto
- **DescripciÃ³n**: corrige el reset de contraseÃ±a para usar el usuario de la BD configurado (`POSTGRES_USER`, p. ej. `silverknight`) en vez del hardcodeado `postgres`. El resto del flujo (self-heal auto, botÃ³n en diÃ¡logo P1000, `savePostgresPassword`, recreate del server con la nueva DATABASE_URL) ya funcionaba.
- **Cambios clave**: `docker.ts` `resetPostgresPassword` â†’ `pgUser = loadEnvForChild()['POSTGRES_USER'] || 'silverknight'`; psql con `-w` (no preguntar contraseÃ±a, fallar rÃ¡pido) y `-U <pgUser>`; SQL `ALTER USER <pgUser> PASSWORD '...'`.
- **VerificaciÃ³n**: typecheck limpio, 113/113 tests, eslint 0 errores en archivos tocados
- **Release**: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.10 (assets: `silver-knight-1.1.10-setup.exe` sha512 `2ECB18C93EFC589F12CA332234971E718F08F9BE5741A703868F329FAA0C65D482BB74FC0D96D34108ED0AC1DDE20DBF748092DC84AC95F4D42BB05919593448`, `.blockmap`, `latest.yml`)
- **AcciÃ³n del operador**: instalar v1.1.10; si el diÃ¡logo P1000 aparece â†’ "Restablecer contraseÃ±a" (ahora usa el rol correcto) â†’ la app arranca.

## [2026-08-01] fix | Auditoria de optimizacion â€” cuelgues aleatorios durante el uso
- **Descripcion**: auditoria read-only del stack (renderer/server/main) por cuelgues al azar con perfil pequeno. Diagnostico + fixes anti-hang aplicados (sin tocar fuentes inmutables ni planning/).
- **Paginas creadas**: [[auditoria-optimizacion-cuelgues]]
- **Paginas actualizadas**: [[index]]
- **Hallazgos**: (1) ppendFileSync en cada log del hilo main (causa mas probable de congelamientos al azar; log sin rotacion + Defender); (2) ipcRenderer.sendSync en preload (getUpdateStatus/getVersion); (3) sin timeout/AbortSignal en ningun fetch del renderer (pi.ts) â†’ UI en "Cargando..." infinito; (4) waitForServer sin timeout por intento; (5) fetch de sync remoto sin timeout; (6) ReportsPage re-descargaba en cada cambio de fecha; (7) queries sin 	ake/select en reports/iva/dashboard/customers (baja urgencia con datos pequenos).
- **Fixes aplicados**: logger.ts async (buffer + ppendFile en cola, flush 50 lineas/1s, rotacion 5MB x3, lushLogsSync en efore-quit); pi.ts timeout global 15s via AbortController + 	imeoutMs por llamada; AuthProvider pi.health(5000) + flag cancelled; ReportsPage effect solo en cambio de tab + race guard por secuencia; preload sin sendSync (invoke async) + handlers sync removidos en updater; syncService AbortSignal.timeout(30000) en push remoto.
- **Verificacion**: typecheck limpio, 113/113 tests, electron-vite build OK, 0 errores eslint en archivos tocados.
- **Pendiente recomendado**: paginacion/select en reports/iva/dashboard/customers, indices ExchangeRate.date y SyncLog.createdAt, debounce en busquedas, regex de parseBcvRate, execSync async en before-quit.

## [2026-08-01] release | v1.1.11 publicada â€” optimizaciones anti-hang
- **Descripcion**: corrige cuelgues aleatorios durante el uso (perfil pequeno). Fixes de la auditoria de optimizacion: (1) timeout global 15s en todos los fetch del renderer via AbortController (pi.ts) â€” la UI ya no queda en "Cargando..." infinito; (2) logger del proceso main asincrono (buffer + cola ppendFile, flush 50 lineas/1s, rotacion 5MB x3, lushLogsSync en efore-quit) â€” elimina el bloqueo sincrono por cada log; (3) eliminado ipcRenderer.sendSync del preload (bloqueaba el renderer); (4) AuthProvider health-check con timeout por intento (5s) + flag cancelled; (5) ReportsPage ya no re-descarga en cada cambio de fecha y tiene race guard por secuencia; (6) sync con AbortSignal.timeout(30000) en fetch remoto; (7) fix en workflow elease.yml (ahora corre 
pm run build antes de electron-builder â€” los CI de v1.1.9/v1.1.10 fallaban por falta del build).
- **Paginas tocadas**: [[auditoria-optimizacion-cuelgues]], [[index]]
- **Verificacion**: typecheck limpio, 113/113 tests, build OK; CI release en GitHub Actions: success.
- **Release**: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.11 (assets: silver-knight-1.1.11-setup.exe sha512 qIb27fFzVICBhFbofpuQnkpLP3wzCZmIyXb1pz/98r51EPsDTGmjfytxGuliIyzytNN2DGCAMpREPYCF4N9ZdA==, .blockmap, latest.yml)
- **Accion del operador**: instalar silver-knight-1.1.11-setup.exe (o esperar el aviso de actualizacion en la app). Si persiste algun cuelgue, revisar %APPDATA%\silver-knight\logs\main.log por Window became unresponsive / RENDER PROCESS GONE.

## [2026-08-01] fix | CRLF rompia docker-entrypoint.sh (server exit 255, bug v1.1.11)
- **Descripcion**: tras actualizar a v1.1.11 el contenedor silverknight-server entraba en crash loop (exit 255, oomKilled=false) sin ningun log. Diagnostico: el instalador v1.1.11 empaqueta docker-entrypoint.sh con CRLF (el checkout de CI en Windows convierte LF->CRLF porque no habia .gitattributes). Al construir la imagen en la maquina del usuario desde resources/, el shebang #!/bin/sh\r no existe -> el contenedor muere al instante sin output. El one-shot prisma db push funcionaba porque usa --entrypoint npx (binario, evita el script). v1.1.10 (verificado extrayendo ambos setups con 7-Zip): docker-entrypoint.sh LF correcto; v1.1.11: 39 pares CRLF.
- **Fix aplicado**: .gitattributes en la raiz (text eol=lf para *.sh, Dockerfile, *.yml, *.yaml, *.prisma) + RUN sed -i 's/\r$//' /docker-entrypoint.sh en Dockerfile (defensa definitiva aunque el source llegue CRLF).
- **Verificacion**: extraido silver-knight-1.1.11-setup.exe y 1.1.10-setup.exe con 7-Zip -> CRLF 39 vs 0 en docker-entrypoint.sh; blob en git es LF puro.
- **Paginas tocadas**: [[docker-deployment]]
## [2026-08-02] release | v1.1.12 publicada - fix CRLF docker-entrypoint.sh
- **Descripcion**: corrige el crash loop del server (exit 255) introducido por v1.1.11. El instalador v1.1.11 empaqueto docker-entrypoint.sh con CRLF (checkout CI en Windows sin .gitattributes); el shebang #!/bin/sh no era valido y el contenedor server moria sin logs. Fix: .gitattributes (text eol=lf para *.sh, Dockerfile, *.yml, *.yaml, *.prisma) + RUN sed -i 's/\r$//' en Dockerfile.
- **Paginas tocadas**: [[diagnostico-server-exit-255-crlf]], [[docker-deployment]], [[index]]
- **Verificacion**: extraido setup v1.1.12 con 7-Zip -> docker-entrypoint.sh CRLF=0 (antes v1.1.11: 39, v1.1.10: 0). CI release success 2m48s (run 30729006469). /releases/latest -> v1.1.12. latest.yml correcto.
- **Nota operacional**: electron-builder crea la release como draft y no la publica ni marca Latest ni sube .blockmap; hay que ejecutar manualmente: gh release edit v1.1.12 --draft=false --latest. Sin blockmap la actualizacion usa descarga completa (funciona, no diferencial).
- **Release**: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.12
- **Accion del operador**: instalar v1.1.12 (auto-update o setup manual). La imagen server se reconstruye con el entrypoint LF.

## [2026-08-02] fix | Auto-publicacion de releases en CI (fin del draft manual)
- **Descripcion**: eliminado el trabajo manual de publicar cada release. electron-builder (--publish always) crea la release como **draft**, no marca Latest y pierde el blockmap (sube assets antes de crear la release). Nuevo paso "Finalize release (publish + latest + blockmap)" en `.github/workflows/release.yml` con `shell: bash` (los runners Windows usan pwsh por defecto): `gh release edit <ref> --draft=false --latest` + `gh release upload <ref> dist/*.blockmap --clobber`.
- **Paginas tocadas**: [[diagnostico-server-exit-255-crlf]], [[index]]
- **Verificacion**: CI success (run 30729322485). v1.1.12 ahora con isDraft=false, blockmap subido (02:46:13), /releases/latest -> v1.1.12. Primer intento fallo por sintaxis bash en shell pwsh (ParserError Missing '(') -> corregido con shell:bash.
- **Commits**: `d527b01` (finalize step), `157545e` (shell: bash). Tag v1.1.12 re-apuntado a 157545e.
- **Nota**: futuras releases quedan publicadas y Latest automaticamente; ya no se necesita `gh release edit` manual.
## [2026-08-02] build | Offline-first startup hardening (v1.1.13)
- **Descripcion**: endurecimiento del arranque para que la app inicie y sea usable sin internet. Solo fallan las funciones estrictamente de red (auto-update, tasa BCV, sync cloud). No se elimina Docker: se usa la imagen cacheada si existe.
- **Paginas creadas**: [[diagnostico-offline-startup]]
- **Paginas actualizadas**: [[offline-first]], [[docker-deployment]], [[index]]
- **Cambios**:
  - `src/main/docker.ts`: `DB_IMAGE = postgres:16-alpine`, `SERVER_IMAGE = silverknight-server:latest`, `imageExists(name)`, `getImageAvailability()` (db + server), `pullDbImage(onOutput)`.
  - `src/main/server-image.ts`: `ensureServerImage` offline-aware -> retorna `{ rebuilt, error?, skippedOffline? }`; offline con imagen en cache -> skip rebuild (sentinel no se actualiza -> rebuild al volver online); build fallido con imagen -> continua con ella.
  - `src/main/index.ts`: `startBackend` reescrito (solo app.isPackaged): imagenes presentes + ensureServerImage -> offline OK; faltan imagenes + offline -> dialogo "Primera configuracion requiere internet" con Reintentar / Copiar diagnostico / Salir; faltan imagenes + online -> pre-warm (ensureServerImage + pullDbImage).
  - `src/main/updater.ts`: `checkForUpdates` offline -> skip silencioso (sin estado error) + `pendingCheck=true`; reintento por polling de `net.isOnline()` cada 30s (`retryTimer`) en vez de eventos `online` (removidos de Electron); auto-check cada 4h intacto.
  - `docker-compose.yml`: `pull_policy: missing` en servicio `db` -> compose no intenta pull si la imagen ya existe en cache local.
- **Notas tecnicas**: `net.isOnline()` no es 100% confiable (true es inconcluso) -> la garantia es usar imagen cacheada si existe; el check solo evita intentos de red inutiles. Electron 43 removio los eventos `online`/`offline` de `net` y `app` (no tipados) -> se uso polling con `setInterval`.
- **Verificacion**: typecheck limpio, 122/122 tests (10 archivos, +9 tests nuevos), 0 errores eslint en archivos tocados (solo warnings CRLF preexistentes del repo).
- **Pendiente**: probar E2E offline en maquina desplegada (desconectar red, arrancar, verificar que abre con imagen cacheada y muestra el dialogo solo si no hay imagenes).

## [2026-08-04] build | CatÃ¡logo dolarizado â€” solo precios USD (Producto/Cliente/Inventario)
- **DescripciÃ³n**: eliminados los campos VES persistentes del catÃ¡logo. Producto, Inventario y Cliente guardan solo USD; el equivalente VES se muestra en vivo con la tasa vigente al registrar/editar y en la lista de productos; la facturaciÃ³n congela los montos VES con la tasa al facturar.
- **PÃ¡ginas actualizadas**: [[product]], [[customer]], [[inventory-movement]], [[dual-currency]], [[index]]
- **Cambios**:
  - `prisma/schema.prisma`: eliminados `Product.priceVes`, `Product.costVes`, `Customer.creditLimitVes`, `InventoryMovement.unitCostVes`.
  - `src/server/validation/schemas.ts`: eliminados de todos los schemas (`createProductSchema`/`updateProductSchema` â†’ `.required({name, priceUsd})`, `invoiceItemSchema` sin `unitPriceVes`, customer schemas, `createInventoryEntrySchema`); `createInvoiceSchema.exchangeRate` â†’ `optional().default(0)`.
  - `src/server/routes/invoices.ts` (POST): calcula `unitPriceVes = round2(unitPriceUsd Ã— tasa)`; tasa = body `exchangeRate`, fallback Ãºltima de BD, si no hay â†’ 400 "No hay una tasa de cambio configurada. RegÃ­strala en Ajustes > Tasa BCV."; factura conserva congelados `totalVes`/`ivaVes`/`unitPriceVes`/`exchangeRate` (documento fiscal dual; no se tocÃ³ TicketPreview/InvoiceViewPage/printer).
  - `src/server/routes/`: products.ts (POST/PUT sin priceVes/costVes), inventoryEntries.ts (sin unitCostVes), reports.ts (summary sin totalValueVes/totalPriceVes), customers.ts (sin creditLimitVes).
  - `src/renderer/src/lib/api.ts`: tipos `Product`/`ProductInput`/`InventoryMovement`/`Customer`/`InvoiceInput` sin campos VES; `CartItem` sin `unitPriceVes`; `reports.inventory` summary sin totalValueVes/totalPriceVes.
  - Renderer: `ProductFormPage` (inputs VES â†’ referencia read-only `â‰ˆ Bs.` con tasa cargada), `ProductsPage` (columna Precio VES = `priceUsd Ã— tasa` en vivo), POS (`POSPage`/`CartPanel`/`PaymentModal` calculan VES con `exchangeRate`), `InventoryEntriesPage`, `CustomersPage`, `ReportsPage`.
- **VerificaciÃ³n**: `prisma generate` OK, typecheck limpio (node+web), 122/122 tests (10 archivos), 0 errores eslint en archivos tocados (11 errores preexistentes en `scripts/afterPack.js`/`UsersPage.tsx`/etc. no relacionados).
- **Nota**: `prisma db push` al desplegar pierde los valores VES del catÃ¡logo (deseado); las facturas histÃ³ricas conservan sus totales VES congelados.

## [2026-08-04] release | v1.1.14 (offline-first + catÃ¡logo dolarizado)
- **DescripciÃ³n**: primera release desde v1.1.12. **No hubo tag v1.1.13**: la versiÃ³n `1.1.13` quedÃ³ como bump de `package.json` dentro del commit `d4e244a` y nunca se etiquetÃ³; `v1.1.14` incluye tanto el offline-first startup hardening como el catÃ¡logo dolarizado. `package.json` bump â†’ `1.1.14`.
- **PÃ¡ginas tocadas**: [[log#2026-08-04-build--catÃ¡logo-dolarizado--solo-precios-usd-productoclienteinventario]], [[log#2026-08-02-build--offline-first-startup-hardening-v1113]], [[offline-first]], [[docker-deployment]], [[dual-currency]], [[index]]
- **VerificaciÃ³n local previa**: typecheck (node+web) limpio, `prisma generate` OK, 122/122 tests, `npm run build` (electron-vite) OK, 0 errores eslint nuevos (11 preexistentes documentados).
- **Flujo de release**: push a `main` â†’ CI quality; tag `v1.1.14` â†’ `release.yml` â†’ electron-builder `--win --publish always` â†’ finalize (draft=false, latest, blockmap re-upload).
- **Comportamiento esperado en la mÃ¡quina desplegada**: auto-update a v1.1.14; al primer arranque `ensureServerImage` reconstruye la imagen server (deps estables en `server/package.json` â†’ build rÃ¡pido en cachÃ©) y `docker-entrypoint.sh` aplica `prisma db push` por cambio de hash de schema (pierde columnas VES del catÃ¡logo, deseado; facturas histÃ³ricas conservan totales VES congelados).
- **Pendiente de E2E**: arranque offline con imagen cacheada en mÃ¡quina desplegada (4 checks en [[diagnostico-offline-startup]]).
- **Resultado**: tag `v1.1.14` push â†’ `Release` workflow OK en 3m9s (build + publish + finalize latest + blockmap). Release publicada: https://github.com/Angel-java/silver-knight-fiscal-pos/releases/tag/v1.1.14 â€” assets `silver-knight-1.1.14-setup.exe` + `.blockmap` + `latest.yml` (`version: 1.1.14`, `releaseDate 2026-08-05T02:28:41Z`). CI/Build-win en main siguen rojos por el paso Lint (11 errores + 17k warnings CRLF de prettier, pre-existentes desde v1.1.12; `release.yml` no corre lint).
