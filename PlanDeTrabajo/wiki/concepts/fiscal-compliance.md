---
type: concept
tags: [seniat, fiscal, invoicing, venezuela, lvft]
created: 2026-06-30
updated: 2026-06-30
sources: [adr-005, db-schema, small-profile-phase]
---

# Fiscal Compliance (SENIAT)

Cumplimiento de la normativa fiscal venezolana del SENIAT. Fuentes: [[architectural-decisions]], [[db-schema]], [[small-profile-phase]].

## ¿Qué entidades participan?

- La **[[company|Company]]** es el ente emisor (su RIF aparece en cada factura)
- El **[[customer|Customer]]** es el receptor (su RIF es obligatorio)
- La **[[invoice|Invoice]]** es el documento fiscal: lleva NCF, IVA, montos en ambas monedas
- El **[[product|Product]]** tiene IVA configurable por ítem
- Cada [[invoice-item|renglón de factura]] lleva su propio cálculo de IVA

## Requisitos clave

- **RIF**: Registro de Información Fiscal del emisor y receptor
- **NCF**: Número de Comprobante Fiscal (control number)
- **IVA**: Impuesto al Valor Agregado (porcentaje por producto)
- **Libros IVA**: Libro de Compras y Libro de Ventas
- **Documentos anulados**: trazabilidad completa de cancelaciones
- **Formato impreso**: formato fiscal aprobado por SENIAT

## Relación con otros conceptos

- [[fiscal-compliance]] requiere [[dual-currency]] (facturación en USD/VES)
- [[architectural-decisions|ADR-005]] formaliza: facturación fiscal desde el día 1
- [[offline-first]] aplica: la facturación fiscal funciona sin internet

## Estado

Pendiente de recibir ejemplos de factura fiscal actual del usuario para validar el formato.
