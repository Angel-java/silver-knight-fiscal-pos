import { useState, useEffect, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type InventoryMovement, type Product } from '../lib/api'

const TYPE_LABELS: Record<string, string> = {
  entry: 'Entrada',
  exit: 'Salida',
  sale: 'Venta',
  cancellation: 'Anulación'
}

const TYPE_COLORS: Record<string, string> = {
  entry: 'text-green-600 bg-green-50',
  exit: 'text-red-600 bg-red-50',
  sale: 'text-orange-600 bg-orange-50',
  cancellation: 'text-blue-600 bg-blue-50'
}

interface Props {
  embedded?: boolean
}

export default function InventoryEntriesPage({ embedded }: Props = {}): JSX.Element {
  const navigate = useNavigate()
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState({
    productId: '',
    type: 'entry' as 'entry' | 'exit',
    quantity: '',
    unitCostUsd: '',
    reference: '',
    notes: ''
  })

  const load = async (): Promise<void> => {
    try {
      const res = await api.inventoryEntries.list({ type: typeFilter || undefined, page })
      setMovements(res.movements)
      setTotal(res.total)
      setPage(res.page)
      setPages(res.pages)
    } catch {
      console.error('Error al cargar movimientos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [typeFilter, page])

  const openCreate = async (): Promise<void> => {
    try {
      const res = await api.products.list({ page: 1 })
      setProducts(res.products)
    } catch {
      console.error('Error al cargar productos')
    }
    setForm({ productId: '', type: 'entry', quantity: '', unitCostUsd: '', reference: '', notes: '' })
    setShowModal(true)
  }

  const handleCreate = async (): Promise<void> => {
    const qty = Number(form.quantity)
    if (!form.productId || !qty || qty <= 0) return
    try {
      await api.inventoryEntries.create({
        productId: form.productId,
        type: form.type,
        quantity: qty,
        unitCostUsd: form.unitCostUsd ? Number(form.unitCostUsd) : null,
        reference: form.reference || null,
        notes: form.notes || null
      })
      setShowModal(false)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al crear movimiento')
    }
  }

  if (loading) return <p className="text-gray-500 p-4">Cargando...</p>

  return (
    <div className={embedded ? 'p-4' : 'p-6'}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {!embedded && (
            <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 text-lg">←</button>
          )}
          <h1 className="text-2xl font-bold text-gray-800">Movimientos de Inventario ({total})</h1>
        </div>
        <button onClick={openCreate} className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-colors">
          + Nueva Entrada/Salida
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        {['', 'entry', 'exit', 'sale', 'cancellation'].map((t) => (
          <button
            key={t}
            onClick={() => { setTypeFilter(t); setPage(1) }}
            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
              typeFilter === t
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {t ? TYPE_LABELS[t] || t : 'Todos'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Producto</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Tipo</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Cantidad</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Ganancia</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Costo Prod.</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Referencia</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Notas</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(m.createdAt).toLocaleString('es-VE')}
                </td>
                <td className="px-4 py-3 font-medium">{m.product?.name || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[m.type] || ''}`}>
                    {TYPE_LABELS[m.type] || m.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {m.type === 'entry' || m.type === 'cancellation' ? '+' : '-'}{m.quantity}
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  {m.product ? `$${(m.product.priceUsd - (m.product.costUsd || 0)).toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  {m.product?.costUsd != null ? `$${m.product.costUsd.toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{m.reference || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{m.notes || '—'}</td>
              </tr>
            ))}
            {movements.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">No hay movimientos</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded-md disabled:opacity-30">
            Anterior
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">Pág {page} de {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded-md disabled:opacity-30">
            Siguiente
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Nueva Entrada / Salida</h2>
            <div className="space-y-3">
              <select
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Seleccionar producto...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>
                ))}
              </select>

              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as 'entry' | 'exit' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="entry">Entrada (+)</option>
                <option value="exit">Salida (-)</option>
              </select>

              <input
                type="text" inputMode="decimal"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Cantidad"
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text" inputMode="decimal"
                  value={form.unitCostUsd}
                  onChange={(e) => setForm({ ...form, unitCostUsd: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Costo USD (opcional)"
                />
                <input
                  type="text" inputMode="decimal"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Referencia / documento (opcional)"
                />
              </div>

              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Notas (opcional)"
                rows={2}
              />

              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-md">
                  Cancelar
                </button>
                <button onClick={handleCreate} className="px-4 py-2 bg-primary text-white rounded-md">
                  Registrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
