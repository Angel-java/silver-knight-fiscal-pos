---
type: source
tags: [plan, database, schema, prisma]
created: 2026-06-30
updated: 2026-06-30
source: raw/planning-snapshots/db-schema.md
---

# Plan — Database Schema

Fuente original: `raw/planning-snapshots/db-schema.md`

Schema completo de base de datos con 9 modelos Prisma.

## Modelos y sus páginas wiki

| Modelo | Página wiki |
|--------|-------------|
| Company | [[company]] |
| User | [[user]] |
| ExchangeRate | [[exchange-rate]] |
| Category | [[category]] |
| Product | [[product]] |
| Customer | [[customer]] |
| Invoice | [[invoice]] |
| InvoiceItem | [[invoice-item]] |
| CashRegister | [[cash-register]] |
| Setting | [[setting]] |

## Conceptos reflejados en el schema

- [[dual-currency]] — todas las tablas financieras tienen columnas USD/VES
- [[fiscal-compliance]] — RIF, NCF, IVA en las entidades fiscales
