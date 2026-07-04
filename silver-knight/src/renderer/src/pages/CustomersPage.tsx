import { useState, useEffect, type FormEvent, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Customer, type Invoice } from '../lib/api'

export default function CustomersPage(): JSX.Element {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [detail, setDetail] = useState<Customer | null>(null)

  const [name, setName] = useState('')
  const [rif, setRif] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [creditLimitUsd, setCreditLimitUsd] = useState('')
  const [creditLimitVes, setCreditLimitVes] = useState('')
  const [error, setError] = useState('')

  const load = async (): Promise<void> => {
    try {
      const res = await api.customers.list({ search, page })
      setCustomers(res.customers)
      setTotal(res.total)
      setPage(res.page)
      setPages(res.pages)
    } catch {
      setError('Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        const res = await api.customers.list({ search, page })
        setCustomers(res.customers)
        setTotal(res.total)
        setPage(res.page)
        setPages(res.pages)
      } catch {
        setError('Error al cargar clientes')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [search, page])

  const openCreate = (): void => {
    setEditing(null)
    setName('')
    setRif('')
    setAddress('')
    setPhone('')
    setEmail('')
    setCreditLimitUsd('')
    setCreditLimitVes('')
    setError('')
    setShowModal(true)
  }

  const openEdit = (c: Customer): void => {
    setEditing(c)
    setName(c.name)
    setRif(c.rif || '')
    setAddress(c.address || '')
    setPhone(c.phone || '')
    setEmail(c.email || '')
    setCreditLimitUsd(c.creditLimitUsd != null ? String(c.creditLimitUsd) : '')
    setCreditLimitVes(c.creditLimitVes != null ? String(c.creditLimitVes) : '')
    setError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')
    try {
      if (editing) {
        await api.customers.update(editing.id, {
          name,
          rif: rif || null,
          address: address || null,
          phone: phone || null,
          email: email || null,
          creditLimitUsd: creditLimitUsd ? Number(creditLimitUsd) : null,
          creditLimitVes: creditLimitVes ? Number(creditLimitVes) : null
        })
      } else {
        await api.customers.create({
          name,
          rif: rif || undefined,
          address: address || undefined,
          phone: phone || undefined,
          email: email || undefined,
          creditLimitUsd: creditLimitUsd ? Number(creditLimitUsd) : undefined,
          creditLimitVes: creditLimitVes ? Number(creditLimitVes) : undefined
        })
      }
      setShowModal(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm('¿Eliminar este cliente?')) return
    try {
      await api.customers.delete(id)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  const openDetail = async (id: string): Promise<void> => {
    try {
      const res = await api.customers.get(id)
      setDetail(res.customer)
    } catch {
      alert('Error al cargar detalle del cliente')
    }
  }

  if (loading) return <p className="text-gray-500 p-4">Cargando...</p>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-gray-500 hover:text-gray-700 text-lg"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Clientes ({total})</h1>
        </div>
        <button
          onClick={openCreate}
          className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-colors"
        >
          + Nuevo Cliente
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Buscar por nombre, RIF o teléfono..."
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nombre</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">RIF</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Teléfono</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Email</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Límite USD</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{c.rif || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{c.phone || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{c.email || '—'}</td>
                <td className="px-4 py-3 text-right text-sm">
                  {c.creditLimitUsd != null ? `$${c.creditLimitUsd.toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => openDetail(c.id)}
                    className="text-purple-600 hover:text-purple-800 text-sm"
                  >
                    Ver
                  </button>
                  <button
                    onClick={() => openEdit(c)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No hay clientes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 border rounded-md disabled:opacity-30"
          >
            Anterior
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">
            Pág {page} de {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 border rounded-md disabled:opacity-30"
          >
            Siguiente
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-4">
              {editing ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RIF</label>
                  <input
                    type="text"
                    value={rif}
                    onChange={(e) => setRif(e.target.value)}
                    placeholder="J-12345678-9"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Límite de Crédito USD
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={creditLimitUsd}
                    onChange={(e) => setCreditLimitUsd(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Límite de Crédito VES
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={creditLimitVes}
                    onChange={(e) => setCreditLimitVes(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
                >
                  {editing ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 py-8 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{detail.name}</h2>
              <button
                onClick={() => setDetail(null)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg text-sm">
              <div>
                <span className="font-medium text-gray-500">RIF:</span> {detail.rif || '—'}
              </div>
              <div>
                <span className="font-medium text-gray-500">Teléfono:</span> {detail.phone || '—'}
              </div>
              <div>
                <span className="font-medium text-gray-500">Email:</span> {detail.email || '—'}
              </div>
              <div>
                <span className="font-medium text-gray-500">Dirección:</span>{' '}
                {detail.address || '—'}
              </div>
              <div>
                <span className="font-medium text-gray-500">Límite USD:</span>{' '}
                {detail.creditLimitUsd != null ? `$${detail.creditLimitUsd.toFixed(2)}` : '—'}
              </div>
              <div>
                <span className="font-medium text-gray-500">Límite VES:</span>{' '}
                {detail.creditLimitVes != null ? `Bs.${detail.creditLimitVes.toFixed(2)}` : '—'}
              </div>
            </div>

            <h3 className="font-bold text-gray-700 mb-3">Historial de Facturas</h3>
            {detail.invoices && detail.invoices.length > 0 ? (
              <div className="space-y-2">
                {detail.invoices.map((inv: Invoice) => (
                  <div
                    key={inv.id}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{inv.number}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(inv.createdAt).toLocaleDateString('es-VE')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">
                        {inv.currency === 'USD'
                          ? `$${inv.totalUsd.toFixed(2)}`
                          : `Bs.${inv.totalVes.toFixed(2)}`}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          inv.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {inv.status === 'active' ? 'Activa' : 'Anulada'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-4">
                Este cliente no tiene facturas
              </p>
            )}

            <div className="mt-4 text-right">
              <button
                onClick={() => setDetail(null)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
