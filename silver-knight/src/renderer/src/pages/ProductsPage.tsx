import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Product, type Category } from '../lib/api'
import ProductFormPage from './ProductFormPage'

export default function ProductsPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [stockModal, setStockModal] = useState<{ product: Product; open: boolean }>({ product: null!, open: false })
  const [stockQty, setStockQty] = useState('')
  const [stockType, setStockType] = useState<'in' | 'out'>('in')

  const load = useCallback(async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        api.products.list({ search, page }),
        api.categories.list()
      ])
      setProducts(prodRes.products)
      setTotal(prodRes.total)
      setPage(prodRes.page)
      setPages(prodRes.pages)
      setCategories(catRes.categories)
    } catch {
      console.error('Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (p: Product) => {
    setEditing(p)
    setShowForm(true)
  }

  const handleStockAdjust = async () => {
    const qty = Number(stockQty)
    if (!qty || qty <= 0) return
    try {
      await api.products.adjustStock(stockModal.product.id, qty, stockType)
      setStockModal({ product: null!, open: false })
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al ajustar stock')
    }
  }

  const lowStock = (p: Product) => p.minStock > 0 && p.stock <= p.minStock

  if (loading) return <p className="text-gray-500 p-4">Cargando...</p>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 text-lg">←</button>
          <h1 className="text-2xl font-bold text-gray-800">Productos ({total})</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/products/categories')} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm">
            Categorías
          </button>
          <button onClick={openCreate} className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-colors">
            + Nuevo Producto
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Buscar por nombre, código o código de barra..."
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nombre</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Código</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Precio USD</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Precio VES</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Stock</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className={`border-b last:border-0 hover:bg-gray-50 ${!p.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-400">{p.category?.name}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{p.code || p.barcode || '—'}</td>
                <td className="px-4 py-3 text-right">${p.priceUsd.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">Bs.{p.priceVes.toFixed(2)}</td>
                <td className={`px-4 py-3 text-right font-medium ${lowStock(p) ? 'text-red-600' : ''}`}>
                  {p.stock} {lowStock(p) && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => openEdit(p)} className="text-blue-600 hover:text-blue-800 text-sm">Editar</button>
                  <button onClick={() => { setStockModal({ product: p, open: true }); setStockQty('') }}
                    className="text-green-600 hover:text-green-800 text-sm">Stock</button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No hay productos</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="px-3 py-1 border rounded-md disabled:opacity-30">Anterior</button>
          <span className="px-3 py-1 text-sm text-gray-600">Pág {page} de {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)}
            className="px-3 py-1 border rounded-md disabled:opacity-30">Siguiente</button>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 py-8 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            <ProductFormPage
              product={editing}
              categories={categories}
              onSave={() => { setShowForm(false); load() }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {stockModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Ajustar Stock</h2>
            <p className="text-sm text-gray-500 mb-4">{stockModal.product.name} — Stock actual: {stockModal.product.stock}</p>
            <div className="space-y-3">
              <select value={stockType} onChange={(e) => setStockType(e.target.value as 'in' | 'out')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="in">Entrada (+)</option>
                <option value="out">Salida (-)</option>
              </select>
              <input type="text" inputMode="decimal" value={stockQty} onChange={(e) => setStockQty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Cantidad" />
              <div className="flex gap-3 justify-end">
                <button onClick={() => setStockModal({ product: null!, open: false })}
                  className="px-4 py-2 border border-gray-300 rounded-md">Cancelar</button>
                <button onClick={handleStockAdjust}
                  className="px-4 py-2 bg-primary text-white rounded-md">Aplicar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
