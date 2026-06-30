# Decisiones Técnicas — Registro (ADR)

## ADR-001: Electron + Express embebido para Small

**Contexto**: En el perfil Small, todo corre en una sola máquina. Necesitamos
una app de escritorio que maneje interfaz de usuario + lógica de negocio + base
de datos local.

**Decisión**: Electron con Express embebido en el proceso main. El renderer
(React) se comunica con Express via HTTP en `localhost`. Esto permite:
- Separar UI de lógica (como si fuera cliente-servidor real)
- En Medium/Big, el POS se conecta a un servidor remoto sin cambios en la UI
- La lógica de negocio vive en Express, reutilizable en todos los perfiles

**Consecuencias**: 
- El POS en Medium apunta a la IP del servidor local en vez de localhost
- Fácil migración: misma API, diferente conexión
- Más开销 inicial vs. IPC directo, pero scalable

---

## ADR-002: Prisma ORM con SQLite local

**Contexto**: Necesitamos una base de datos local ligera, sin servidor, que
soporte migraciones y tipado fuerte.

**Decisión**: Prisma con adaptador SQLite (better-sqlite3).
- Migraciones automáticas con `prisma migrate`
- Tipado TypeScript generado desde el schema
- Mismo schema reusable con PostgreSQL en Medium/Big cloud
- SQLite perfecto para single-machine

**Consecuencias**:
- Cambio a PostgreSQL en cloud = solo cambiar provider en schema.prisma
- Las queries son las mismas gracias a Prisma

---

## ADR-003: Doble moneda como concepto nativo

**Contexto**: Venezuela opera con USD y VES simultáneamente. Cada transacción
debe registrar ambas monedas con la tasa de cambio del momento.

**Decisión**: Cada tabla financiera (`Product`, `Invoice`, `InvoiceItem`) guarda
**ambos valores** (price_usd, price_ves, total_usd, total_ves) más la tasa de
cambio referencial. No hay conversión en tiempo real — se congela la tasa al
momento de la transacción.

**Consecuencias**:
- Los reportes pueden mostrar en la moneda que se desee
- Las facturas fiscales (SENIAT) requieren VES — siempre disponible
- La tasa histórica queda preservada en cada transacción

---

## ADR-004: API REST idéntica en todos los perfiles

**Contexto**: La UI del POS no debe cambiar entre Small, Medium y Big.

**Decisión**: Todos los perfiles exponen la misma API REST. En Small es
localhost, en Medium es la IP del servidor local, en Big es la URL del cloud.
El frontend cambia la URL base según la configuración.

**Consecuencias**:
- Un solo frontend para todos los perfiles
- El switch de perfil solo cambia la configuración de conexión
- Las pruebas unitarias sirven para todos los perfiles

---

## ADR-005: Facturación fiscal desde el inicio

**Contexto**: El sistema debe emitir facturas fiscales venezolanas válidas
según SENIAT.

**Decisión**: La estructura fiscal (numeración CF, RIF, control de talonarios,
Libros IVA) se implementa desde la primera factura. No hay versión "no fiscal".
Toda factura generada es fiscalmente válida.

**Consecuencias**:
- Más complejidad inicial, pero cero deuda técnica fiscal
- El cliente Small tiene un sistema 100% legal desde el día 1
- No hay que migrar datos de facturas no-fiscales a fiscales después

Ver resumen en la wiki: [[architectural-decisions]]
