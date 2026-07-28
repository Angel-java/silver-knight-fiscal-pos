function getApiBase(): string {
  return localStorage.getItem('apiBase') || 'http://localhost:3001/api'
}

export function setApiBase(url: string): void {
  localStorage.setItem('apiBase', url.replace(/\/+$/, ''))
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${getApiBase()}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error de conexión' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export interface User {
  id: string
  username: string
  fullName: string | null
  role: string
  permissions: string[] | null
  isActive?: boolean
  createdAt?: string
}

export const PERMISSION_MODULES = [
  'dashboard', 'pos', 'products', 'categories', 'inventory',
  'inventory-entries', 'customers', 'invoices', 'reports',
  'settings', 'exchange-rates', 'iva-books', 'fiscal-control', 'users'
] as const

export type PermissionModule = (typeof PERMISSION_MODULES)[number]

export interface Company {
  id: string
  name: string
  rif: string
  address?: string | null
  phone?: string | null
  email?: string | null
}

export interface Category {
  id: string
  name: string
  description: string | null
}

export interface Supplier {
  id: string
  name: string
  rif: string | null
  phone: string | null
  email: string | null
  address: string | null
}

export interface Product {
  id: string
  name: string
  code: string | null
  barcode: string | null
  description: string | null
  priceUsd: number
  priceVes: number
  costUsd: number | null
  costVes: number | null
  ivaRate: number
  stock: number
  minStock: number
  categoryId: string | null
  category: { id: string; name: string } | null
  supplierId: string | null
  supplier: { id: string; name: string } | null
  isActive: boolean
}

export interface InventoryMovement {
  id: string
  productId: string
  product: { id: string; name: string; code: string | null; costUsd: number | null; costVes: number | null; priceUsd: number; priceVes: number } | null
  type: string
  quantity: number
  unitCostUsd: number | null
  unitCostVes: number | null
  reference: string | null
  notes: string | null
  userId: string | null
  createdAt: string
}

export interface ProductInput {
  name: string
  code?: string | null
  barcode?: string | null
  description?: string | null
  priceUsd: number
  priceVes: number
  costUsd?: number | null
  costVes?: number | null
  ivaRate?: number
  stock?: number
  minStock?: number
  categoryId?: string | null
  supplierId?: string | null
}

export interface Customer {
  id: string
  name: string
  rif: string | null
  address: string | null
  phone: string | null
  email: string | null
  creditLimitUsd: number | null
  creditLimitVes: number | null
  invoices?: Invoice[]
  createdAt: string
}

export interface InvoiceItem {
  id: string
  productId: string | null
  productName: string
  quantity: number
  unitPriceUsd: number
  unitPriceVes: number
  ivaRate: number
  totalUsd: number
  totalVes: number
  product?: { id: string; name: string; costUsd: number; costVes: number } | null
}

export interface FiscalControl {
  id: string
  documentType: string
  resolution: string
  prefix: string
  startNumber: number
  endNumber: number
  currentNumber: number
  isActive: boolean
  issuedAt: string
}

export interface Invoice {
  id: string
  number: string
  documentType: string
  controlNumber: string | null
  fiscalControlId: string | null
  fiscalControl: FiscalControl | null
  customerId: string | null
  customer: Customer | null
  cancelReason: string | null
  cancelledAt: string | null
  items: InvoiceItem[]
  totalUsd: number
  totalVes: number
  ivaUsd: number
  ivaVes: number
  currency: string
  exchangeRate: number
  status: string
  payments: string | null
  createdAt: string
}

export interface InvoiceInput {
  customerId?: string | null
  items: Array<{
    productId?: string
    productName: string
    quantity: number
    unitPriceUsd: number
    unitPriceVes: number
    ivaRate: number
  }>
  currency: string
  exchangeRate: number
  documentType?: string
  payments?: Array<{ method: string; amount: number; currency: string }>
}

export const api = {
  login: (username: string, pin: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, pin })
    }),

  setup: (
    profile: 'small' | 'medium' | 'big',
    company: { name: string; rif: string; address?: string; phone?: string; email?: string },
    adminUser: { username: string; fullName?: string; pin: string }
  ) =>
    request<{ token: string; user: User; company: Company }>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ profile, company, adminUser })
    }),

  me: () => request<{ user: User }>('/auth/me'),

  getCompany: () => request<{ company: Company | null }>('/auth/company'),

  health: () => request<{ ok: boolean; service: string; companyCount: number }>('/health'),

  deploy: () =>
    request<{ success: boolean; output: string }>('/deploy', { method: 'POST' }),

  categories: {
    list: () => request<{ categories: Category[] }>('/categories'),

    create: (data: { name: string; description?: string }) =>
      request<{ category: Category }>('/categories', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    update: (id: string, data: { name: string; description?: string }) =>
      request<{ category: Category }>(`/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),

    delete: (id: string) => request<{ ok: boolean }>(`/categories/${id}`, { method: 'DELETE' })
  },

  suppliers: {
    list: (params?: { search?: string }) => {
      const q = new URLSearchParams()
      if (params?.search) q.set('search', params.search)
      const qs = q.toString()
      return request<{ suppliers: (Supplier & { _count?: { products: number } })[] }>(
        `/suppliers${qs ? '?' + qs : ''}`
      )
    },

    get: (id: string) => request<{ supplier: Supplier & { products?: { id: string; name: string; code: string | null }[] } }>(`/suppliers/${id}`),

    create: (data: { name: string; rif?: string; phone?: string; email?: string; address?: string }) =>
      request<{ supplier: Supplier }>('/suppliers', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    update: (id: string, data: { name: string; rif?: string | null; phone?: string | null; email?: string | null; address?: string | null }) =>
      request<{ supplier: Supplier }>(`/suppliers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),

    delete: (id: string) => request<{ ok: boolean }>(`/suppliers/${id}`, { method: 'DELETE' })
  },

  products: {
    list: (params?: { search?: string; category?: string; page?: number }) => {
      const q = new URLSearchParams()
      if (params?.search) q.set('search', params.search)
      if (params?.category) q.set('category', params.category)
      if (params?.page) q.set('page', String(params.page))
      const qs = q.toString()
      return request<{ products: Product[]; total: number; page: number; pages: number }>(
        `/products${qs ? '?' + qs : ''}`
      )
    },

    get: (id: string) => request<{ product: Product }>(`/products/${id}`),

    create: (data: ProductInput) =>
      request<{ product: Product }>('/products', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    update: (id: string, data: Partial<ProductInput>) =>
      request<{ product: Product }>(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),

    adjustStock: (id: string, quantity: number, type: 'in' | 'out') =>
      request<{ product: Product }>(`/products/${id}/stock`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity, type })
      }),

    deactivate: (id: string) =>
      request<{ product: Product }>(`/products/${id}/deactivate`, { method: 'PATCH' }),

    delete: (id: string) =>
      request<{ ok: boolean }>(`/products/${id}`, { method: 'DELETE' })
  },

  settings: {
    getAll: () => request<{ settings: Record<string, string> }>('/settings'),

    set: (key: string, value: string) =>
      request<{ setting: { id: string; key: string; value: string } }>(`/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value })
      })
  },

  invoices: {
    list: (params?: { documentType?: string; status?: string; search?: string; page?: number }) => {
      const q = new URLSearchParams()
      if (params?.documentType) q.set('documentType', params.documentType)
      if (params?.status) q.set('status', params.status)
      if (params?.search) q.set('search', params.search)
      if (params?.page) q.set('page', String(params.page))
      const qs = q.toString()
      return request<{ invoices: Invoice[]; total: number; page: number; pages: number }>(
        `/invoices${qs ? '?' + qs : ''}`
      )
    },

    get: (id: string) => request<{ invoice: Invoice }>(`/invoices/${id}`),

    create: (data: InvoiceInput) =>
      request<{ invoice: Invoice }>('/invoices', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    cancel: (id: string, reason: string) =>
      request<{ invoice: Invoice }>(`/invoices/${id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason })
      })
  },

  fiscalControl: {
    list: () => request<{ controls: FiscalControl[] }>('/fiscal-control'),

    create: (data: {
      documentType: string
      resolution: string
      prefix?: string
      startNumber?: number
      endNumber?: number
      issuedAt?: string
    }) =>
      request<{ control: FiscalControl }>('/fiscal-control', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    update: (
      id: string,
      data: Partial<{
        resolution: string
        prefix: string
        startNumber: number
        endNumber: number
        issuedAt: string
        isActive: boolean
      }>
    ) =>
      request<{ control: FiscalControl }>(`/fiscal-control/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
  },

  iva: {
    ventas: (from?: string, to?: string) => {
      const q = new URLSearchParams()
      if (from) q.set('from', from)
      if (to) q.set('to', to)
      const qs = q.toString()
      return request<{
        invoices: Invoice[]
        summary: {
          totalUsd: number
          totalVes: number
          ivaUsd: number
          ivaVes: number
          count: number
        }
      }>(`/iva/ventas${qs ? '?' + qs : ''}`)
    },

    compras: (from?: string, to?: string) => {
      const q = new URLSearchParams()
      if (from) q.set('from', from)
      if (to) q.set('to', to)
      const qs = q.toString()
      return request<{ invoices: Invoice[]; summary: { count: number } }>(
        `/iva/compras${qs ? '?' + qs : ''}`
      )
    }
  },

  dashboard: {
    summary: () =>
      request<{
        summary: {
          invoicesCount: number
          totalUsd: number
          totalVes: number
          ivaUsd: number
          ivaVes: number
          productsSold: number
        }
      }>('/dashboard/summary')
  },

  customers: {
    list: (params?: { search?: string; page?: number }) => {
      const q = new URLSearchParams()
      if (params?.search) q.set('search', params.search)
      if (params?.page) q.set('page', String(params.page))
      const qs = q.toString()
      return request<{ customers: Customer[]; total: number; page: number; pages: number }>(
        `/customers${qs ? '?' + qs : ''}`
      )
    },

    get: (id: string) => request<{ customer: Customer }>(`/customers/${id}`),

    create: (data: {
      name: string
      rif?: string
      address?: string
      phone?: string
      email?: string
      creditLimitUsd?: number
      creditLimitVes?: number
    }) =>
      request<{ customer: Customer }>('/customers', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    update: (
      id: string,
      data: {
        name: string
        rif?: string | null
        address?: string | null
        phone?: string | null
        email?: string | null
        creditLimitUsd?: number | null
        creditLimitVes?: number | null
      }
    ) =>
      request<{ customer: Customer }>(`/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),

    delete: (id: string) => request<{ ok: boolean }>(`/customers/${id}`, { method: 'DELETE' })
  },

  reports: {
    salesDaily: () =>
      request<{
        invoices: Invoice[]
        summary: {
          totalUsd: number
          totalVes: number
          ivaUsd: number
          ivaVes: number
          productsSold: number
          count: number
          paymentsBreakdown: Record<string, { usd: number; ves: number }>
        }
      }>('/reports/sales-daily'),

    salesRange: (from: string, to: string) => {
      const q = new URLSearchParams()
      q.set('from', from)
      q.set('to', to)
      return request<{
        invoices: Invoice[]
        summary: {
          totalUsd: number
          totalVes: number
          ivaUsd: number
          ivaVes: number
          productsSold: number
          count: number
          cancelledCount: number
          usdInvoices: number
          vesInvoices: number
        }
      }>(`/reports/sales-range?${q.toString()}`)
    },

    inventory: () =>
      request<{
        products: Product[]
        summary: {
          totalProducts: number
          totalValueUsd: number
          totalValueVes: number
          totalPriceUsd: number
          totalPriceVes: number
          lowStockCount: number
          outOfStockCount: number
        }
      }>('/reports/inventory'),

    topProducts: (from?: string, to?: string, limit?: number) => {
      const q = new URLSearchParams()
      if (from) q.set('from', from)
      if (to) q.set('to', to)
      if (limit) q.set('limit', String(limit))
      const qs = q.toString()
      return request<{
        top: Array<{
          productId: string | null
          productName: string
          quantity: number
          totalUsd: number
          totalVes: number
          costUsd: number
        }>
        summary: { totalQty: number; totalUsd: number; totalCost: number; count: number }
      }>(`/reports/top-products${qs ? '?' + qs : ''}`)
    },

    cashClose: (date?: string) =>
      request<{
        date: string
        invoices: Invoice[]
        summary: {
          totalUsd: number
          totalVes: number
          count: number
          cancelledCount: number
          paymentsBreakdown: Record<string, { usd: number; ves: number; count: number }>
        }
      }>(`/reports/cash-close${date ? '?date=' + date : ''}`)
  },

  exchangeRates: {
    getLatest: () =>
      request<{
        rate: { id: string; rate: number; source: string; date: string } | null
      }>('/exchange-rates?latest=true'),

    create: (rate: number, source?: string) =>
      request<{ rate: { id: string; rate: number; source: string; date: string } }>(
        '/exchange-rates',
        {
          method: 'POST',
          body: JSON.stringify({ rate, source })
        }
      ),

    fetchBcv: () =>
      request<{ rate: { id: string; rate: number; source: string; date: string } }>(
        '/exchange-rates/bcv',
        { method: 'POST' }
      )
  },

  company: {
    get: () => request<{ company: Company | null }>('/auth/company'),

    update: (data: {
      name: string
      rif: string
      address?: string | null
      phone?: string | null
      email?: string | null
    }) =>
      request<{ company: Company }>('/auth/company', {
        method: 'PUT',
        body: JSON.stringify(data)
      })
  },

  users: {
    list: () =>
      request<{ users: User[] }>('/users'),

    create: (data: { username: string; fullName?: string | null; pin: string; role?: string; permissions?: string[] | null }) =>
      request<{ user: User }>('/users', { method: 'POST', body: JSON.stringify(data) }),

    update: (
      id: string,
      data: { username?: string; fullName?: string | null; pin?: string; role?: string; isActive?: boolean; permissions?: string[] | null }
    ) =>
      request<{ user: User }>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  },

  inventoryEntries: {
    list: (params?: { productId?: string; type?: string; from?: string; to?: string; page?: number }) => {
      const q = new URLSearchParams()
      if (params?.productId) q.set('productId', params.productId)
      if (params?.type) q.set('type', params.type)
      if (params?.from) q.set('from', params.from)
      if (params?.to) q.set('to', params.to)
      if (params?.page) q.set('page', String(params.page))
      const qs = q.toString()
      return request<{ movements: InventoryMovement[]; total: number; page: number; pages: number }>(
        `/inventory-entries${qs ? '?' + qs : ''}`
      )
    },

    create: (data: {
      productId: string
      type: 'entry' | 'exit'
      quantity: number
      unitCostUsd?: number | null
      unitCostVes?: number | null
      reference?: string | null
      notes?: string | null
    }) =>
      request<{ product: Product; movement: InventoryMovement }>('/inventory-entries', {
        method: 'POST',
        body: JSON.stringify(data)
      })
  },

  sync: {
    config: () =>
      request<{
        config: {
          url: string
          apiKey: string
          enabled: boolean
          interval: number
          lastSyncAt: string | null
        }
      }>('/sync/config'),

    saveConfig: (data: { url?: string; apiKey?: string; enabled?: boolean; interval?: number }) =>
      request<{
        config: {
          url: string
          apiKey: string
          enabled: boolean
          interval: number
          lastSyncAt: string | null
        }
      }>('/sync/config', { method: 'PUT', body: JSON.stringify(data) }),

    now: () =>
      request<{
        result: {
          success: boolean
          entitiesSynced: number
          errors: string[]
          duration: number
        }
      }>('/sync/now', { method: 'POST' }),

    status: () =>
      request<{
        syncing: boolean
        config: {
          url: string
          enabled: boolean
          interval: number
          lastSyncAt: string | null
        }
        lastResult: {
          success: boolean
          entitiesSynced: number
          errors: string[]
          duration: number
        } | null
      }>('/sync/status'),

    logs: (limit?: number) =>
      request<{
        logs: Array<{
          id: string
          entity: string
          action: string
          status: string
          error: string | null
          createdAt: string
        }>
      }>(`/sync/logs${limit ? '?limit=' + limit : ''}`)
  },

  puntoVenta: {
    status: () =>
      request<{
        connected: boolean
        connecting: boolean
        config: { port: string; baudRate: number; enabled: boolean }
      }>('/punto-venta/status'),

    ports: () =>
      request<{ ports: Array<{ path: string; manufacturer?: string }> }>('/punto-venta/ports'),

    connect: (data: { port: string; baudRate?: number }) =>
      request<{ connected: boolean; config: { port: string; baudRate: number; enabled: boolean } }>(
        '/punto-venta/connect',
        { method: 'POST', body: JSON.stringify(data) }
      ),

    disconnect: () =>
      request<{ connected: boolean }>('/punto-venta/disconnect', { method: 'POST' }),

    test: () => request<{ ok: boolean; message: string }>('/punto-venta/test', { method: 'POST' }),

    pay: (amount: number, currency?: string) =>
      request<{
        result: {
          success: boolean
          approvalCode?: string
          cardNumber?: string
          message?: string
          error?: string
        }
      }>('/punto-venta/pay', {
        method: 'POST',
        body: JSON.stringify({ amount, currency })
      }),

    saveSettings: (data: { port?: string; baudRate?: number; enabled?: boolean }) =>
      request<{ config: { port: string; baudRate: number; enabled: boolean } }>(
        '/punto-venta/settings',
        { method: 'PUT', body: JSON.stringify(data) }
      )
  },

  print: {
    listPrinters: () => request<{ printers: string[] }>('/print/printers'),

    invoice: (id: string) => request<{ ok: boolean }>(`/print/invoice/${id}`, { method: 'POST' })
  },

  getApiBase,
  setApiBase
}
