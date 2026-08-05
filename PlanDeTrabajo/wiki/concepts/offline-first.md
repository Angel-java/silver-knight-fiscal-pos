---
type: concept
tags: [architecture, offline, sync, resilience]
created: 2026-06-30
updated: 2026-08-02
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

- La base de datos principal es local (SQLite en Small, SQLite en cada nodo en Medium)
- La nube (PostgreSQL) es opcional y se agrega en fase Big
- Todas las operaciones críticas (facturación, inventario, caja) son locales
- El sync es asíncrono cuando hay conexión

## Arranque offline (v1.1.13)

Desde v1.1.13 el **arranque de la app también es offline-first**. El core de negocio ya corría 100% local (renderer → `localhost:3001`); lo que podía bloquear el inicio sin internet era Docker (`docker compose up -d` intenta pull de `postgres:16-alpine`; `ensureServerImage` corría `docker compose build` con `npm ci` en cambio de versión). Ver [[diagnostico-offline-startup]].

Reglas de arranque en `app.isPackaged`:

- **Imágenes presentes en la caché local + `ensureServerImage` OK** → la app arranca sin red. `docker compose up -d` ya no intenta pull porque `db` tiene `pull_policy: missing`.
- **Imágenes presentes + offline** → `ensureServerImage` hace skip del rebuild (no hay red para `npm ci`); el sentinel `.server-version` no se actualiza, así que el rebuild se ejecuta al volver online.
- **Faltan imágenes + offline** → diálogo informativo "Primera configuración requiere internet" con **Reintentar / Copiar diagnóstico / Salir** (no bloquea al usuario en un error opaco; puede copiar el diagnóstico para soporte).
- **Faltan imágenes + online** → pre-warm: `ensureServerImage` (server) + `pullDbImage` (db), errores no fatales.

El auto-update también respeta offline: `checkForUpdates` hace skip silencioso (sin estado `error`) y guarda un check pendiente que se reintenta por polling de `net.isOnline()` cada 30s. Las funciones estrictamente de red (tasa BCV, sync cloud) siguen fallando con mensaje claro, pero la app es usable.

## Relación con otros conceptos

- [[offline-first]] no afecta [[dual-currency]]: las tasas se capturan localmente
- [[offline-first]] es compatible con [[fiscal-compliance]]: la facturación fiscal es local
- [[offline-first]] se apoya en [[docker-deployment]]: el arranque usa la imagen cacheada, sin red
