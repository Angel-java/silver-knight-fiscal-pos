# Tareas Pendientes — Fase 1: Perfil Small

> **Objetivo general**: Tener un POS funcional en una sola máquina con inventario,
> facturación fiscal, doble moneda e impresión, sin dependencia de red.

---

## 🔨 Etapa 1.1 — Scaffolding del Proyecto

**Objetivo**: Inicializar el proyecto con Electron + Vite + React + Express embebido + Prisma SQLite, asegurando que todo compile y corra.

| # | Tarea | Descripción | Prioridad | Estado |
|---|-------|-------------|-----------|--------|
| 1.1.1 | Inicializar proyecto con `electron-vite` | Crear estructura base con Electron + Vite + React + TypeScript | Alta | ✅ |
| 1.1.2 | Configurar TailwindCSS + PostCSS | Estilos utilitarios listos para usar | Alta | ✅ |
| 1.1.3 | Instalar y configurar Express embebido | Servidor HTTP dentro del proceso main de Electron | Alta | ✅ |
| 1.1.4 | Configurar Prisma con SQLite | Schema inicial, migración, cliente generado | Alta | ✅ |
| 1.1.5 | Verificar que la app corre en dev | `npm run dev` debe abrir ventana con React + Express funcionando | Alta | ✅ |
| 1.1.6 | Configurar carpetas del proyecto | `electron/`, `src/`, `prisma/`, `resources/` | Media | ✅ |

---

## 🔨 Etapa 1.2 — Base de Datos y Schema

**Objetivo**: Definir el schema completo de Prisma con todas las tablas necesarias para el perfil Small.

| # | Tarea | Descripción | Prioridad | Estado |
|-------|-------|-------------|-----------|--------|
| 1.2.1 | Crear modelo `Company` | Datos de la empresa (nombre, RIF, dirección, etc.) | Alta | ✅ |
| 1.2.2 | Crear modelo `User` | Operadores del sistema (username, PIN, rol) | Alta | ✅ |
| 1.2.3 | Crear modelo `ExchangeRate` | Histórico de tasas USD/VES (fecha, valor, fuente) | Alta | ✅ |
| 1.2.4 | Crear modelo `Category` | Categorías de productos | Alta | ✅ |
| 1.2.5 | Crear modelo `Product` | Productos con precio dual, stock, código de barra | Alta | ✅ |
| 1.2.6 | Crear modelo `Customer` | Clientes con RIF, datos de contacto, límite de crédito | Alta | ✅ |
| 1.2.7 | Crear modelo `Invoice` | Facturas, NC, ND con totales duales | Alta | ✅ |
| 1.2.8 | Crear modelo `InvoiceItem` | Líneas de detalle de factura | Alta | ✅ |
| 1.2.9 | Crear modelo `CashRegister` | Apertura/cierre de caja | Alta | ✅ |
| 1.2.10 | Crear modelo `Setting` | Configuraciones clave/valor del sistema | Alta | ✅ |
| 1.2.11 | Ejecutar migración inicial | `prisma migrate dev` para crear las tablas | Alta | ✅ |

---

## 🔨 Etapa 1.3 — Autenticación Local y Setup Inicial

**Objetivo**: Pantalla de login, creación del primer usuario, wizard de configuración inicial de la empresa.

| # | Tarea | Descripción | Prioridad |
|---|-------|-------------|-----------|
| 1.3.1 | Pantalla de login | Login con username + PIN/contraseña | Alta |
| 1.3.2 | Protección de rutas | Redirección si no hay sesión activa | Alta |
| 1.3.3 | Wizard de primer uso | Detectar si hay empresa creada, si no → wizard | Alta |
| 1.3.4 | Formulario de datos de empresa | Nombre, RIF, dirección, teléfono, moneda por defecto | Alta |
| 1.3.5 | Creación de usuario admin inicial | Primer usuario con rol admin | Alta |
| 1.3.6 | Página de Dashboard (placeholder) | Pantalla principal con menú de navegación | Media |

---

## 🔨 Etapa 1.4 — Módulo de Productos e Inventario

**Objetivo**: CRUD completo de productos, categorías, búsqueda y control de stock.

| # | Tarea | Descripción | Prioridad |
|---|-------|-------------|-----------|
| 1.4.1 | CRUD de categorías | Listar, crear, editar, eliminar categorías | Alta |
| 1.4.2 | CRUD de productos | Formulario completo con precio dual, costo, IVA, stock | Alta |
| 1.4.3 | Lista de productos con búsqueda | Buscar por nombre, código, código de barra | Alta |
| 1.4.4 | Asignar código de barra a producto | Campo opcional de código de barras | Media |
| 1.4.5 | Control de stock básico | Mostrar stock disponible, alerta de stock mínimo | Alta |
| 1.4.6 | Ajustes de inventario | Entrada/salida manual de productos (ajuste por conteo) | Media |
| 1.4.7 | API REST de productos | Endpoints CRUD en Express para productos | Alta |

---

## 🔨 Etapa 1.5 — POS (Punto de Venta)

**Objetivo**: Interfaz de facturación rápida que permita crear facturas con productos,
seleccionar cliente, elegir moneda, calcular totales, aplicar IVA e imprimir.

| # | Tarea | Descripción | Prioridad |
|---|-------|-------------|-----------|
| 1.5.1 | Interfaz POS principal | Layout tipo POS: productos a la izquierda, carrito a la derecha | Alta |
| 1.5.2 | Buscador rápido de productos | Buscar por código, nombre o escáner (input enfocado) | Alta |
| 1.5.3 | Carrito de compras | Agregar/quitar items, modificar cantidad, ver subtotal | Alta |
| 1.5.4 | Selector de moneda (USD/VES) | Elegir moneda de la factura, mostrar totales en ambas | Alta |
| 1.5.5 | Cálculo de IVA | Porcentaje de IVA por producto, subtotal IVA 0 e IVA | Alta |
| 1.5.6 | Selector rápido de cliente | Buscar cliente o crear uno rápido desde el POS | Alta |
| 1.5.7 | Métodos de pago | Efectivo (USD/VES), transferencia, punto de venta, mixto | Alta |
| 1.5.8 | Cálculo de vuelto | Calcular vuelto en la moneda de la factura | Alta |
| 1.5.9 | Finalizar factura | Guardar factura, generar número de control, imprimir | Alta |
| 1.5.10 | Historial de facturas del POS | Últimas facturas creadas, opción de reimprimir | Media |

---

## 🔨 Etapa 1.6 — Módulo de Clientes

**Objetivo**: Gestión de clientes con datos fiscales (RIF) e historial de compras.

| # | Tarea | Descripción | Prioridad |
|---|-------|-------------|-----------|
| 1.6.1 | CRUD de clientes | Lista, crear, editar, buscar clientes | Alta |
| 1.6.2 | Datos fiscales del cliente | RIF, tipo de contribuyente, dirección fiscal | Alta |
| 1.6.3 | Historial de compras por cliente | Ver facturas de un cliente específico | Media |
| 1.6.4 | Límite de crédito | Control de crédito en USD/VES por cliente | Baja |

---

## 🔨 Etapa 1.7 — Facturación Fiscal Venezolana (SENIAT)

**Objetivo**: Implementar los requisitos fiscales venezolanos: numeración de control, CF, Libros IVA.

> *Nota: Pendiente de recibir ejemplos de factura fiscal actual del usuario.*

| # | Tarea | Descripción | Prioridad |
|---|-------|-------------|-----------|
| 1.7.1 | Numeración de facturas por talonario | Secuencia por establecimiento y máquina | Alta |
| 1.7.2 | Generar número CF (Comprobante Fiscal) | Formato de control SENIAT | Alta |
| 1.7.3 | Mostrar datos fiscales en factura | RIF empresa, RIF cliente, CF, control, notas | Alta |
| 1.7.4 | Tipos de documentos fiscales | Factura, Nota de Crédito, Nota de Débito | Alta |
| 1.7.5 | Anulación de facturas | Anular con registro de motivo y fecha | Alta |
| 1.7.6 | Libro IVA de Ventas | Reporte con todas las ventas del período | Alta |
| 1.7.7 | Libro IVA de Compras | Reporte de compras (para contribuyentes formales) | Alta |
| 1.7.8 | Formato de factura fiscal imprimible | Diseño de factura con todos los requisitos legales | Alta |
| 1.7.9 | Control de talonarios | Gestión de secuencias por máquina | Media |

---

## 🔨 Etapa 1.8 — Reportes y Dashboard

**Objetivo**: Dashboard de inicio con indicadores clave y reportes exportables.

| # | Tarea | Descripción | Prioridad |
|---|-------|-------------|-----------|
| 1.8.1 | Dashboard principal | Tarjetas con ventas del día, productos vendidos, tickets | Alta |
| 1.8.2 | Reporte de ventas diarias | Ventas del día desglosadas por moneda y método de pago | Alta |
| 1.8.3 | Reporte de ventas por período | Selección de fechas, totales, gráficos | Alta |
| 1.8.4 | Reporte de inventario actual | Listado de productos con stock actual y valorizado | Media |
| 1.8.5 | Reporte de productos más vendidos | Top productos por cantidad y monto | Media |
| 1.8.6 | Cierre de caja | Resumen de apertura, ventas, ingresos/egresos, cierre | Alta |
| 1.8.7 | Exportar reportes a PDF | Generar PDF imprimible de cualquier reporte | Media |

---

## 🔨 Etapa 1.9 — Configuración del Sistema

**Objetivo**: Pantallas de configuración para tasa de cambio, impresora, perfil y empresa.

| # | Tarea | Descripción | Prioridad |
|---|-------|-------------|-----------|
| 1.9.1 | Gestión de tasa de cambio | Ingreso manual de tasa USD/VES | Alta |
| 1.9.2 | Auto-obtener tasa BCV | Fetch automático desde el portal del BCV | Alta |
| 1.9.3 | Configuración de impresora térmica | Seleccionar impresora, ancho de papel, encabezado/pie | Alta |
| 1.9.4 | Configuración del perfil | Seleccionar Small/Medium/Big (solo Small por ahora) | Media |
| 1.9.5 | Editar datos de la empresa | Modificar datos ingresados en el wizard inicial | Media |
| 1.9.6 | Gestión de usuarios | Crear/editar/desactivar operadores del sistema | Alta |

---

## 🔨 Etapa 1.10 — Impresión Térmica

**Objetivo**: Imprimir facturas en impresoras térmicas de tickets (ESC/POS).

| # | Tarea | Descripción | Prioridad |
|---|-------|-------------|-----------|
| 1.10.1 | Comunicación con impresora térmica | Node.js → child process → lp/usb (ESC/POS) | Alta |
| 1.10.2 | Template de factura térmica | Diseño de ticket: encabezado, items, totales, firma fiscal | Alta |
| 1.10.3 | Vista previa de impresión | Mostrar cómo se verá el ticket antes de imprimir | Media |
| 1.10.4 | Reimpresión de facturas | Reimprimir facturas desde el historial | Media |
| 1.10.5 | Prueba de impresión | Botón de prueba en configuración | Baja |

---

## Totales

| Estado | Cantidad |
|--------|----------|
| ⏳ Pendiente | 43 |
| 🔄 En progreso | 0 |
| ✅ Completado | 17 |
| **Total** | **60** |

Ver resumen en la wiki: [[tasks]]
