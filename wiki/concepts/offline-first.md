---
type: concept
tags: [architecture, offline, sync, resilience]
created: 2026-06-30
updated: 2026-06-30
sources: [plan-vision]
---

# Offline-first

Principio arquitectónico: el sistema funciona 100% sin conexión a internet.

## Implicaciones

- La base de datos principal es local (SQLite en Small, SQLite en cada nodo en Medium)
- La nube (PostgreSQL) es opcional y se agrega en fase Big
- Todas las operaciones críticas (facturación, inventario, caja) son locales
- El sync es asíncrono cuando hay conexión

## Estrategia

1. Small: 100% local, sin necesidad de internet nunca
2. Medium: red local, servidor central con SQLite
3. Big: cloud opcional con sync engine vía WebSockets + colas
