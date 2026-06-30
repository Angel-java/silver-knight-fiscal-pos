---
type: concept
tags: [architecture, offline, sync, resilience]
created: 2026-06-30
updated: 2026-06-30
sources: [plan-vision]
---

# Offline-first

Principio arquitectónico: el sistema funciona 100% sin conexión a internet.

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

## Relación con otros conceptos

- [[offline-first]] no afecta [[dual-currency]]: las tasas se capturan localmente
- [[offline-first]] es compatible con [[fiscal-compliance]]: la facturación fiscal es local
