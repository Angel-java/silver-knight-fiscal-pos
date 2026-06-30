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

## Relaciones

- [[fiscal-compliance]] <-> [[invoice]]: toda factura es fiscalmente válida
- [[fiscal-compliance]] <-> [[product]]: IVA configurable por producto
- [[fiscal-compliance]] <-> [[customer]]: datos fiscales obligatorios
- [[fiscal-compliance]] <-> [[company]]: RIF de la empresa emisora
- [[fiscal-compliance]] <-> [[dual-currency]]: facturación en USD/VES
- [[fiscal-compliance]] <-> [[architectural-decision-003]]: ADR-005 formaliza esta decisión

## Estado

Pendiente de recibir ejemplos de factura fiscal actual del usuario para validar el formato.
