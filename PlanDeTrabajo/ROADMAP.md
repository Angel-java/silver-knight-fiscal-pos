# Roadmap de Desarrollo

---

## Fase 1 — Perfil Small (Single Machine)

| Etapa | Módulo                                              | Dependencias | Estado         |
| ----- | --------------------------------------------------- | ------------ | -------------- |
| 1.1   | Scaffolding del proyecto                            | —            | ✅ Completado   |
| 1.2   | Base de datos (Prisma SQLite)                       | 1.1          | ✅ Completado   |
| 1.3   | Autenticación local + Setup empresa                 | 1.2          | ✅ Completado   |
| 1.4   | Módulo de productos e inventario                    | 1.2, 1.3     | ✅ Completado   |
| 1.5   | POS (Punto de Venta)                                | 1.4          | 🔄 En progreso |
| 1.6   | Módulo de clientes                                  | 1.2          | ⏳ Pendiente    |
| 1.7   | Facturación fiscal (SENIAT)                         | 1.5, 1.6     | ⏳ Pendiente    |
| 1.8   | Reportes básicos + Dashboard                        | 1.5          | ⏳ Pendiente    |
| 1.9   | Configuración (tasa BCV, margen, impresora, perfil) | 1.2          | 🔄 En progreso |
| 1.10  | Sistema de impresión térmica                        | 1.5          | ⏳ Pendiente    |
|       |                                                     |              |                |

---

## Fase 2 — Perfil Medium (Multi-máquina + Servidor Local)

| Etapa | Módulo | Dependencias | Estado |
|-------|--------|-------------|--------|
| 2.1 | Servidor local standalone (Express + SQLite) | 1.1 | ⏳ Pendiente |
| 2.2 | Cliente POS remoto (API client) | 2.1 | ⏳ Pendiente |
| 2.3 | Gestión de sesiones multi-POS | 2.1 | ⏳ Pendiente |
| 2.4 | Cierres de caja consolidados | 1.5, 2.2 | ⏳ Pendiente |

---

## Fase 3 — Perfil Big (Multi-sucursal)

| Etapa | Módulo | Dependencias | Estado |
|-------|--------|-------------|--------|
| 3.1 | Cloud Server (API + PostgreSQL) | 2.1 | ⏳ Pendiente |
| 3.2 | Sync Engine (Local → Cloud) | 3.1 | ⏳ Pendiente |
| 3.3 | Web Client (React SPA) | 3.1 | ⏳ Pendiente |
| 3.4 | Gestión multi-sucursal | 3.1 | ⏳ Pendiente |
| 3.5 | Transferencias de inventario entre sucursales | 3.4 | ⏳ Pendiente |

---

## Fase 4 — Mobile + Features Avanzados

| Etapa | Módulo | Dependencias | Estado |
|-------|--------|-------------|--------|
| 4.1 | App Mobile (React Native) | 3.1 | ⏳ Pendiente |
| 4.2 | Escaneo de código de barras móvil | 4.1 | ⏳ Pendiente |
| 4.3 | Dashboard ejecutivo | 3.3 | ⏳ Pendiente |
| 4.4 | Módulo de compras y proveedores | 1.4 | ⏳ Pendiente |

---

## Leyenda

| Símbolo | Significado |
|---------|-------------|
| ⏳ Pendiente | No iniciado |
| 🔄 En progreso | Trabajando actualmente |
| ✅ Completado | Terminado y verificado |
| 🚧 Bloqueado | Esperando dependencia |

Ver resumen en la wiki: [[roadmap]]
