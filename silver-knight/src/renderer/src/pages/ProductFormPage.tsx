import { useState, useEffect, type FormEvent } from 'react'
import type { JSX } from 'react'
import { api, type Product, type Category, type Supplier } from '../lib/api'

interface ProductFormProps {
  product?: Product | null
  categories: Category[]
  onSave: () => void
  onCancel: () => void
}

export default function ProductFormPage({
  product,
  categories,
  onSave,
  onCancel
}: ProductFormProps): JSX.Element {
  const [exchangeRate, setExchangeRate] = useState(0)
  const [profitMargin, setProfitMargin] = useState(0)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [form, setForm] = useState({
    name: product?.name || '',
    code: product?.code || '',
    barcode: product?.barcode || '',
    description: product?.description || '',
    priceUsd: product?.priceUsd != null ? String(product.priceUsd) : '',
    costUsd: product?.costUsd != null ? String(product.costUsd) : '',
    ivaRate: product?.ivaRate ?? 16,
    stock: product?.stock ?? 0,
    minStock: product?.minStock ?? 0,
    categoryId: product?.categoryId || '',
    supplierId: product?.supplierId || ''
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([api.exchangeRates.getLatest(), api.settings.getAll(), api.suppliers.list()])
      .then(([rateRes, settingsRes, suppliersRes]) => {
        if (rateRes.rate) setExchangeRate(rateRes.rate.rate)
        const m = settingsRes.settings['profitMargin']
        if (m) setProfitMargin(Number(m))
        setSuppliers(suppliersRes.suppliers)
      })
      .catch(() => {})
  }, [])

  const set = (field: string, value: string | number): void => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (!product && field === 'costUsd') {
        const cost = Number(value)
        if (cost > 0 && profitMargin > 0) {
          next.priceUsd = String(Math.round(cost * (1 + profitMargin / 100) * 100) / 100)
        }
      }
      return next
    })
  }

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const data = {
        name: form.name,
        code: form.code || null,
        barcode: form.barcode || null,
        description: form.description || null,
        priceUsd: Number(form.priceUsd),
        costUsd: form.costUsd !== '' ? Number(form.costUsd) : null,
        ivaRate: Number(form.ivaRate),
        stock: Number(form.stock),
        minStock: Number(form.minStock),
        categoryId: form.categoryId || null,
        supplierId: form.supplierId || null
      }
      if (product) {
        await api.products.update(product.id, data)
      } else {
        await api.products.create(data)
      }
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-md">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Código interno</label>
          <input
            type="text"
            value={form.code}
            onChange={(e) => set('code', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Código de barra</label>
          <input
            type="text"
            value={form.barcode}
            onChange={(e) => set('barcode', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            rows={2}
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium text-gray-700 mb-3">Costos y Precios</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Costo USD *</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.costUsd}
              onChange={(e) => set('costUsd', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            {exchangeRate > 0 && form.costUsd && Number(form.costUsd) > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                ≈ Bs. {(Number(form.costUsd) * exchangeRate).toFixed(2)}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio USD *</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.priceUsd}
              onChange={(e) => set('priceUsd', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            {exchangeRate > 0 && form.priceUsd && Number(form.priceUsd) > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                ≈ Bs. {(Number(form.priceUsd) * exchangeRate).toFixed(2)}
              </p>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Tasa de referencia: Bs. {exchangeRate > 0 ? exchangeRate.toFixed(2) : '—'} / USD. El
          equivalente en Bs. se calcula al facturar con la tasa vigente.
        </p>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium text-gray-700 mb-3">IVA e Inventario</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IVA (%)</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.ivaRate}
              onChange={(e) => set('ivaRate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stock inicial</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.stock}
              onChange={(e) => set('stock', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.minStock}
              onChange={(e) => set('minStock', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
          <select
            value={form.categoryId}
            onChange={(e) => set('categoryId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Sin categoría</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
          <select
            value={form.supplierId}
            onChange={(e) => set('supplierId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Sin proveedor</option>
            {suppliers.map((sup) => (
              <option key={sup.id} value={sup.id}>
                {sup.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Guardando...' : product ? 'Actualizar Producto' : 'Crear Producto'}
        </button>
      </div>
    </form>
  )
}
