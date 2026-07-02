const API_BASE = 'http://localhost:3001/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error de conexión' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export interface User {
  id: string
  username: string
  role: string
}

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
  isActive: boolean
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
}

export interface Customer {
  id: string
  name: string
  rif: string | null
  address: string | null
  phone: string | null
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
}

export interface Invoice {
  id: string
  number: string
  controlNumber: string | null
  customerId: string | null
  customer: Customer | null
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
  payments?: Array<{ method: string; amount: number; currency: string }>
}

export const api = {
  login: (username: string, pin: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, pin })
    }),

  setup: (company: { name: string; rif: string; address?: string; phone?: string; email?: string }, adminUser: { username: string; pin: string }) =>
    request<{ token: string; user: User; company: Company }>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ company, adminUser })
    }),

  me: () => request<{ user: User }>('/auth/me'),

  getCompany: () => request<{ company: Company | null }>('/auth/company'),

  health: () => request<{ ok: boolean; service: string; companyCount: number }>('/health'),

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

    delete: (id: string) =>
      request<{ ok: boolean }>(`/categories/${id}`, { method: 'DELETE' })
  },

  products: {
    list: (params?: { search?: string; category?: string; page?: number }) => {
      const q = new URLSearchParams()
      if (params?.search) q.set('search', params.search)
      if (params?.category) q.set('category', params.category)
      if (params?.page) q.set('page', String(params.page))
      const qs = q.toString()
      return request<{ products: Product[]; total: number; page: number; pages: number }>(`/products${qs ? '?' + qs : ''}`)
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
      })
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
    list: () => request<{ invoices: Invoice[] }>('/invoices'),

    create: (data: InvoiceInput) =>
      request<{ invoice: Invoice }>('/invoices', {
        method: 'POST',
        body: JSON.stringify(data)
      })
  },

  exchangeRates: {
    getLatest: () => request<{ rate: { id: string; rate: number; source: string; date: string } | null }>('/exchange-rates?latest=true'),

    create: (rate: number, source?: string) =>
      request<{ rate: { id: string; rate: number; source: string; date: string } }>('/exchange-rates', {
        method: 'POST',
        body: JSON.stringify({ rate, source })
      })
  }
}
