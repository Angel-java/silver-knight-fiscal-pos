import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(1, 'Username requerido'),
  pin: z.string().min(1, 'PIN requerido')
})

export const setupSchema = z.object({
  company: z.object({
    name: z.string().min(1, 'Nombre de empresa requerido'),
    rif: z.string().min(1, 'RIF requerido'),
    address: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().email('Email inválido').optional().nullable()
  }),
  adminUser: z.object({
    username: z.string().min(1, 'Username requerido'),
    fullName: z.string().optional().nullable(),
    pin: z.string().min(1, 'PIN requerido')
  })
})

export const updateCompanySchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  rif: z.string().min(1, 'RIF requerido'),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable()
})

const invoiceItemSchema = z.object({
  productId: z.string().optional().nullable(),
  productName: z.string().min(1, 'Nombre de producto requerido'),
  quantity: z.number().positive('Cantidad debe ser positiva'),
  unitPriceUsd: z.number().min(0),
  unitPriceVes: z.number().min(0),
  ivaRate: z.number().min(0).max(100).default(16)
})

export const createInvoiceSchema = z.object({
  customerId: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, 'La factura debe tener al menos un item'),
  currency: z.enum(['USD', 'VES']).default('USD'),
  exchangeRate: z.number().min(0).default(0),
  payments: z
    .array(
      z.object({
        method: z.string(),
        amount: z.number().min(0),
        currency: z.string(),
        approvalCode: z.string().optional().nullable()
      })
    )
    .optional()
    .nullable(),
  documentType: z.enum(['FACT', 'NCR', 'NDB']).default('FACT')
})

export const cancelInvoiceSchema = z.object({
  reason: z.string().min(1, 'Motivo de anulación requerido')
})

export const createProductSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  code: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  priceUsd: z.number().min(0, 'Precio USD requerido'),
  priceVes: z.number().min(0, 'Precio VES requerido'),
  costUsd: z.number().min(0).optional().nullable(),
  costVes: z.number().min(0).optional().nullable(),
  ivaRate: z.number().min(0).max(100).default(16),
  stock: z.number().min(0).default(0),
  minStock: z.number().min(0).default(0),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable()
})

export const updateProductSchema = createProductSchema
  .partial()
  .required({ name: true, priceUsd: true, priceVes: true })

export const stockAdjustSchema = z.object({
  quantity: z.number().positive('Cantidad debe ser positiva'),
  type: z.enum(['in', 'out'], { message: 'Tipo debe ser in o out' })
})

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  rif: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable(),
  creditLimitUsd: z.number().min(0).optional().nullable(),
  creditLimitVes: z.number().min(0).optional().nullable()
})

export const updateCustomerSchema = createCustomerSchema.partial().required({ name: true })

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional().nullable()
})

export const updateCategorySchema = createCategorySchema.partial().required({ name: true })

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  rif: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable(),
  address: z.string().optional().nullable()
})

export const updateSupplierSchema = createSupplierSchema.partial().required({ name: true })

export const createFiscalControlSchema = z.object({
  documentType: z.enum(['FACT', 'NCR', 'NDB'], { message: 'Tipo de documento inválido' }),
  resolution: z.string().min(1, 'Número de resolución requerido'),
  prefix: z.string().optional(),
  startNumber: z.number().int().positive().default(1),
  endNumber: z.number().int().positive().default(999999),
  issuedAt: z.string().optional()
})

export const updateFiscalControlSchema = z.object({
  resolution: z.string().optional(),
  prefix: z.string().optional(),
  startNumber: z.number().int().positive().optional(),
  endNumber: z.number().int().positive().optional(),
  issuedAt: z.string().optional(),
  isActive: z.boolean().optional()
})

const PERMISSION_MODULES = [
  'dashboard', 'pos', 'products', 'categories', 'inventory',
  'inventory-entries', 'customers', 'invoices', 'reports',
  'settings', 'exchange-rates', 'iva-books', 'fiscal-control', 'users'
] as const

export const permissionModules = PERMISSION_MODULES

export const createUserSchema = z.object({
  username: z.string().min(1, 'Username requerido'),
  fullName: z.string().optional().nullable(),
  pin: z.string().min(1, 'PIN requerido'),
  role: z.enum(['admin', 'gerente', 'operador']).default('operador'),
  permissions: z.array(z.enum(PERMISSION_MODULES)).optional().nullable()
})

export const updateUserSchema = z.object({
  username: z.string().optional(),
  fullName: z.string().optional().nullable(),
  pin: z.string().optional(),
  role: z.enum(['admin', 'gerente', 'operador']).optional(),
  isActive: z.boolean().optional(),
  permissions: z.array(z.enum(PERMISSION_MODULES)).optional().nullable()
})

export const createExchangeRateSchema = z.object({
  rate: z.number().positive('Tasa debe ser positiva'),
  source: z.string().default('manual'),
  date: z.string().optional()
})

export const createInventoryEntrySchema = z.object({
  productId: z.string().min(1, 'Producto requerido'),
  type: z.enum(['entry', 'exit'], { message: 'Tipo debe ser entry o exit' }),
  quantity: z.number().positive('Cantidad debe ser positiva'),
  unitCostUsd: z.number().min(0).optional().nullable(),
  unitCostVes: z.number().min(0).optional().nullable(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
})
