---
type: concept
tags: [seniat, fiscal, invoicing, venezuela, lvft]
created: 2026-06-30
updated: 2026-06-30
sources: [adr-005, db-schema, small-profile-phase]
---

# Fiscal Compliance (SENIAT)

Cumplimiento de la normativa fiscal venezolana del SENIAT (Servicio Nacional Integrado de Administración Aduanera y Tributaria).

## Requisitos clave

- **RIF**: Registro de Información Fiscal del emisor y receptor
- **NCF**: Número de Comprobante Fiscal (control number)
- **IVA**: Impuesto al Valor Agregado (porcentaje por producto)
- **Libros IVA**: Libro de Compras y Libro de Ventas
- **Documentos anulados**: trazabilidad completa de cancelaciones
- **Formato impreso**: formato fiscal aprobado por SENIAT

## ADR-005

Facturación fiscal desde el día 1 — todas las facturas son fiscalmente válidas. No existe una versión "no fiscal". Esto aplica incluso en el perfil Small.

## Estado

Pendiente de recibir ejemplos de factura fiscal actual del usuario para validar el formato.
