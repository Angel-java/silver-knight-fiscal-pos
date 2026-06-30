# Silver Knight — Sistema de Gestión de Inventario y Facturación

## Visión General

SaaS profesional de inventario y facturación distribuido por **Silver Knight**,
diseñado para el comercio venezolano con soporte de doble moneda (USD/VES)
y facturación fiscal cumpliendo requisitos SENIAT.

Distribuido en 3 perfiles escalables: **Small → Medium → Big**.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Shell | Electron + Vite |
| Frontend | React 18 + TypeScript + TailwindCSS + Radix UI |
| Backend (embebido) | Express (Node.js, dentro de Electron) |
| Base de Datos Local | SQLite via better-sqlite3 + Prisma ORM |
| Base de Datos Cloud | PostgreSQL (fase 2) |
| Data Fetching | TanStack React Query |
| Mobile | React Native (fase post-Big) |
| Sync | WebSockets + colas (fase post-Small) |

---

## Perfiles de Distribución

### 🟢 Small — 1 máquina
- **Todo en uno**: Electron embebe Express + SQLite
- Sin dependencia de red
- Ideal para: bodegas, kioskos, pequeños comercios

### 🟡 Medium — 1 sucursal, N máquinas
- Servidor local Node.js standalone en LAN
- N POS clients (Electron) conectados al servidor local
- Servidor local sincroniza con cloud
- Ideal para: supermercados, tiendas departamentales

### 🔴 Big — Múltiples sucursales
- Cada sucursal con su servidor local
- Servidores sincronizan con cloud central
- Web client para gestión centralizada
- Transferencias entre sucursales
- Ideal para: cadenas de tiendas, distribuidoras

---

## Principios de Arquitectura

1. **Offline-first**: El core funciona 100% sin internet
2. **Misma lógica de negocio**: Small, Medium y Big comparten el mismo core
3. **Doble moneda nativa**: Cada transacción guarda USD y VES con tasa asociada
4. **Facturación fiscal completa**: Cumplimiento SENIAT desde el día 1
5. **Escalabilidad horizontal**: Small → Medium → Big sin reescribir
