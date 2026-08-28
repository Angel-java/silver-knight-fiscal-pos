import { useState, useEffect, type FormEvent, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Reservation, type Product, type Customer } from '../lib/api'

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  finalized: 'Liquidado',
  cancelled: 'Cancelado',
  expired: 'Vencido'
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  pos: 'Punto de Venta',
  cash_usd: 'Efectivo USD',
  cash_ves: 'Efectivo Bs.',
  mixed: 'Mixto'
}

const round2 = (n: number): number => Math.round(n * 100) / 100

export default function ApartadosPage(): JSX.Element {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<string>('active')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState<Reservation | null>(null)
  const [showPayment, setShowPayment] = useState(false)

  const load = async (pageOverride = page): Promise<void> => {
    try {
      const res = await api.reservations.list({ status: filter || undefined, search, page: pageOverride })
      setReservations(res.reservations)
      setTotal(res.total)
      setPage(res.page)
      setPages(res.pages)
    } catch {
      setError('Error al cargar apartados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    api.reservations
      .list({ status: filter || undefined, search, page: 1 })
      .then((res) => {
        setReservations(res.reservations)
        setTotal(res.total)
        setPage(res.page)
        setPages(res.pages)
      })
      .catch(() => setError('Error al cargar apartados'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search])

  const openDetail = async (id: string): Promise<void> => {
    try {
      const res = await api.reservations.get(id)
      setDetail(res.reservation)
    } catch {
      alert('Error al cargar el apartado')
    }
  }

  const handleFinalize = async (r: Reservation): Promise<void> => {
    if (!confirm(`¿Liquidar el apartado ${r.number} y emitir la factura fiscal?`)) return
    try {
      const res = await api.reservations.finalize(r.id)
      setDetail(null)
      await load()
      navigate(`/invoices/${res.invoice.id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al liquidar')
    }
  }

  const handleCancel = async (r: Reservation): Promise<void> => {
    const reason = prompt(`Motivo de cancelación del apartado ${r.number}:`)
    if (reason === null) return
    if (!reason.trim()) {
      alert('Debes indicar un motivo')
      return
    }
    try {
      await api.reservations.cancel(r.id, reason.trim())
      setDetail(null)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cancelar')
    }
  }

  if (loading) return <p className="text-gray-500 p-4">Cargando...</p>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 text-lg">
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Apartados ({total})</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-colors"
        >
          + Nuevo Apartado
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex gap-2">
          {['active', 'finalized', 'cancelled', 'expired', ''].map((st) => (
            <button
              key={st || 'all'}
              onClick={() => setFilter(st)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                filter === st
                  ? 'bg-primary text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {st === '' ? 'Todos' : STATUS_LABELS[st]}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Buscar por nº o cliente..."
          className="flex-1 min-w-[200px] max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nº</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Cliente</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Total</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Abonado</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Saldo</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Vence</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => {
              const saldo = r.totalUsd - r.amountPaidUsd
              return (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-sm">{r.number}</td>
                  <td className="px-4 py-3 text-sm">{r.customer?.name || 'Consumidor Final'}</td>
                  <td className="px-4 py-3 text-right text-sm">${r.totalUsd.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-sm text-green-600">
                    ${r.amountPaidUsd.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    ${saldo.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {r.dueDate ? new Date(r.dueDate).toLocaleDateString('es-VE') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        r.status === 'active'
                          ? 'bg-blue-100 text-blue-700'
                          : r.status === 'finalized'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openDetail(r.id)}
                      className="text-purple-600 hover:text-purple-800 text-sm"
                    >
                      Ver
                    </button>
                    {r.status === 'active' && (
                      <>
                        <button
                          onClick={() => {
                            setDetail(r)
                            setShowPayment(true)
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Abono
                        </button>
                        <button
                          onClick={() => handleCancel(r)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
            {reservations.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No hay apartados
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
            onClick={() => load(page - 1)}
            className="px-3 py-1 border rounded-md disabled:opacity-30"
          >
            Anterior
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">
            Pág {page} de {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => load(page + 1)}
            className="px-3 py-1 border rounded-md disabled:opacity-30"
          >
            Siguiente
          </button>
        </div>
      )}

      {showCreate && <CreateReservationModal onClose={() => setShowCreate(false)} onCreated={() => load()} />}

      {detail && !showPayment && (
        <ReservationDetailModal
          reservation={detail}
          onClose={() => setDetail(null)}
          onFinalize={handleFinalize}
          onCancel={handleCancel}
          onAddPayment={() => setShowPayment(true)}
        />
      )}

      {showPayment && detail && (
        <PaymentModal
          reservation={detail}
          onClose={() => {
            setShowPayment(false)
            if (detail) openDetail(detail.id)
          }}
        />
      )}
    </div>
  )
}

function CreateReservationModal({
  onClose,
  onCreated
}: {
  onClose: () => void
  onCreated: () => void
}): JSX.Element {
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    rif: '',
    phone: '',
    email: '',
    address: ''
  })
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [deposit, setDeposit] = useState('')
  const [depositCurrency, setDepositCurrency] = useState('USD')
  const [rate, setRate] = useState(0)
  const [method, setMethod] = useState('cash')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [cart, setCart] = useState<
    Array<{ productId: string; productName: string; quantity: number; unitPriceUsd: number; ivaRate: number }>
  >([])

  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        const [p, c, er] = await Promise.all([
          api.products.list(),
          api.customers.list(),
          api.exchangeRates.getLatest()
        ])
        setProducts(p.products)
        setCustomers(c.customers)
        if (er.rate) setRate(er.rate.rate)
      } catch {
        setError('Error al cargar datos')
      }
    }
    init()
  }, [])

  const total = cart.reduce((s, it) => s + it.unitPriceUsd * it.quantity, 0)

  const addProduct = (productId: string): void => {
    const prod = products.find((p) => p.id === productId)
    if (!prod) return
    setCart((prev) => {
      const existing = prev.find((it) => it.productId === prod.id)
      if (existing) {
        return prev.map((it) =>
          it.productId === prod.id ? { ...it, quantity: it.quantity + 1 } : it
        )
      }
      return [
        ...prev,
        {
          productId: prod.id,
          productName: prod.name,
          quantity: 1,
          unitPriceUsd: prod.priceUsd,
          ivaRate: prod.ivaRate
        }
      ]
    })
  }

  const handleCreateCustomer = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newCustomer.name.trim()) {
      setError('El nombre del cliente es obligatorio')
      return
    }
    setSavingCustomer(true)
    setError('')
    try {
      const res = await api.customers.create({
        name: newCustomer.name.trim(),
        rif: newCustomer.rif.trim() || undefined,
        address: newCustomer.address.trim() || undefined,
        phone: newCustomer.phone.trim() || undefined,
        email: newCustomer.email.trim() || undefined
      })
      setCustomers((prev) => [...prev, res.customer])
      setCustomerId(res.customer.id)
      setNewCustomer({ name: '', rif: '', phone: '', email: '', address: '' })
      setShowNewCustomer(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear cliente')
    } finally {
      setSavingCustomer(false)
    }
  }

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (cart.length === 0) {
      setError('Debes agregar al menos un producto')
      return
    }
    setError('')
    try {
      await api.reservations.create({
        customerId: customerId || undefined,
        items: cart.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitPriceUsd: it.unitPriceUsd,
          ivaRate: it.ivaRate
        })),
        currency: 'USD',
        exchangeRate: rate,
        depositUsd: depositCurrency === 'USD' ? (deposit ? Number(deposit) : 0) : 0,
        depositVes: depositCurrency === 'VES' ? (deposit ? Number(deposit) : 0) : undefined,
        depositMethod: method,
        dueDate: dueDate || null,
        notes: notes || null
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear apartado')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl my-8">
        <h2 className="text-lg font-bold mb-4">Nuevo Apartado</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Consumidor Final</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {!showNewCustomer && (
                <button
                  type="button"
                  onClick={() => setShowNewCustomer(true)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm text-blue-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  + Nuevo cliente
                </button>
              )}
            </div>

            {showNewCustomer && (
              <form
                onSubmit={handleCreateCustomer}
                className="mt-3 p-3 border border-gray-200 rounded-md bg-gray-50 space-y-3"
              >
                <p className="text-sm font-medium text-gray-700">
                  Nuevo cliente
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) =>
                      setNewCustomer((prev) => ({ ...prev, name: e.target.value }))
                    }
                    autoFocus
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">RIF / Cédula</label>
                    <input
                      type="text"
                      value={newCustomer.rif}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({ ...prev, rif: e.target.value }))
                      }
                      placeholder="J-12345678-9 / V-12345678"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                    <input
                      type="text"
                      value={newCustomer.phone}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({ ...prev, email: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
                    <input
                      type="text"
                      value={newCustomer.address}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({ ...prev, address: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowNewCustomer(false)}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingCustomer}
                    className="px-3 py-1.5 bg-primary text-white rounded-md text-sm hover:bg-primary-dark disabled:opacity-40 transition-colors"
                  >
                    {savingCustomer ? 'Guardando...' : 'Guardar cliente'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Productos</label>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addProduct(e.target.value)
                  e.target.value = ''
                }
              }}
              value=""
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Seleccionar producto para agregar...</option>
              {products
                .filter((p) => p.isActive && p.stock > 0)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ${p.priceUsd.toFixed(2)} (stock {p.stock})
                  </option>
                ))}
            </select>
          </div>

          {cart.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between font-medium text-sm text-gray-600">
                <span>Producto</span>
                <span className="flex gap-4">
                  <span>Cant.</span>
                  <span>Total</span>
                  <span></span>
                </span>
              </div>
              {cart.map((it) => (
                <div key={it.productId} className="flex items-center justify-between text-sm">
                  <span>{it.productName}</span>
                  <span className="flex items-center gap-4">
                    <input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => {
                        const q = Math.max(1, Number(e.target.value))
                        setCart((prev) =>
                          prev.map((x) => (x.productId === it.productId ? { ...x, quantity: q } : x))
                        )
                      }}
                      className="w-16 px-2 py-1 border border-gray-300 rounded-md"
                    />
                    <span className="w-20 text-right font-medium">
                      ${(it.unitPriceUsd * it.quantity).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCart((prev) => prev.filter((x) => x.productId !== it.productId))}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 font-bold border-t border-gray-200">
                <span>Total a apartar</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="flex gap-2 mb-1">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">Apartado *</label>
                </div>
                <select
                  value={depositCurrency}
                  onChange={(e) => setDepositCurrency(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="USD">USD</option>
                  <option value="VES">Bs.</option>
                </select>
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {rate > 0 && Number(deposit) > 0 &&
                (depositCurrency === 'VES'
                  ? (
                    <p className="text-xs text-gray-600 mt-1">
                      Equivale a ${round2((Number(deposit) / rate)).toFixed(2)} USD
                    </p>
                  )
                  : (
                    <p className="text-xs text-gray-600 mt-1">
                      Equivale a Bs. {round2(Number(deposit) * rate).toFixed(2)}
                    </p>
                  ))
              }
              {rate <= 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Sin tasa configurada. Regístrala en Ajustes &gt; Tasa BCV.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Método apartado</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="pos">Punto de Venta</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha límite (opcional)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              rows={2}
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
            >
              Crear Apartado
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ReservationDetailModal({
  reservation,
  onClose,
  onFinalize,
  onCancel,
  onAddPayment
}: {
  reservation: Reservation
  onClose: () => void
  onFinalize: (r: Reservation) => void
  onCancel: (r: Reservation) => void
  onAddPayment: () => void
}): JSX.Element {
  const items = reservation.items || []
  const payments = reservation.payments || []
  const saldo = reservation.totalUsd - reservation.amountPaidUsd

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 py-8 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{reservation.number}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg text-sm">
          <div>
            <span className="font-medium text-gray-500">Cliente:</span>{' '}
            {reservation.customer?.name || 'Consumidor Final'}
          </div>
          <div>
            <span className="font-medium text-gray-500">Estado:</span>{' '}
            {STATUS_LABELS[reservation.status] || reservation.status}
          </div>
          <div>
            <span className="font-medium text-gray-500">Creado:</span>{' '}
            {new Date(reservation.createdAt).toLocaleString('es-VE')}
          </div>
          <div>
            <span className="font-medium text-gray-500">Vence:</span>{' '}
            {reservation.dueDate ? new Date(reservation.dueDate).toLocaleDateString('es-VE') : '—'}
          </div>
        </div>

        <h3 className="font-bold text-gray-700 mb-2">Productos</h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
          {items.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Producto</th>
                  <th className="text-right px-4 py-2 text-sm font-medium text-gray-600">Cant.</th>
                  <th className="text-right px-4 py-2 text-sm font-medium text-gray-600">Precio</th>
                  <th className="text-right px-4 py-2 text-sm font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b last:border-0">
                    <td className="px-4 py-2 text-sm">{it.productName}</td>
                    <td className="px-4 py-2 text-right text-sm">{it.quantity}</td>
                    <td className="px-4 py-2 text-right text-sm">${it.unitPriceUsd.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-sm">${it.totalUsd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">Sin productos</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-gray-50 rounded-lg text-center">
            <p className="text-xs text-gray-500">Total</p>
            <p className="font-bold">${reservation.totalUsd.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <p className="text-xs text-gray-500">Abonado</p>
            <p className="font-bold text-green-700">${reservation.amountPaidUsd.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-center">
            <p className="text-xs text-gray-500">Saldo</p>
            <p className="font-bold text-blue-700">${saldo.toFixed(2)}</p>
          </div>
        </div>

        <h3 className="font-bold text-gray-700 mb-2">Historial de Abonos</h3>
        {payments.length > 0 ? (
          <div className="space-y-2 mb-4">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                <span>
                  {METHOD_LABELS[p.method] || p.method} —{' '}
                  {new Date(p.createdAt).toLocaleString('es-VE')}
                </span>
                <span className="font-medium">${p.amountUsd.toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-2 mb-2">Sin abonos</p>
        )}

        {reservation.status === 'active' && (
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => onCancel(reservation)}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 transition-colors"
            >
              Cancelar Apartado
            </button>
            <button
              onClick={onAddPayment}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              + Abono
            </button>
            <button
              onClick={() => onFinalize(reservation)}
              disabled={saldo > 0}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-40 transition-colors"
              title={saldo > 0 ? `Falta saldo de $${saldo.toFixed(2)}` : 'Emitir factura'}
            >
              Liquidar y Facturar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function PaymentModal({
  reservation,
  onClose
}: {
  reservation: Reservation
  onClose: () => void
}): JSX.Element {
  const [currency, setCurrency] = useState('USD')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [error, setError] = useState('')

  const rate = reservation.exchangeRate || 0
  const saldoUsd = reservation.totalUsd - reservation.amountPaidUsd
  const saldoVes = round2(saldoUsd * rate)
  const numeric = Number(amount) || 0
  const equivalentUsd = currency === 'VES' && rate > 0 ? round2(numeric / rate) : numeric

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')
    try {
      await api.reservations.addPayment(reservation.id, {
        amountUsd: currency === 'USD' ? Number(amount) || 0 : 0,
        amountVes: currency === 'VES' ? Number(amount) || 0 : 0,
        method
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar abono')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-2">Registrar Abono</h2>
        <p className="text-sm text-gray-500 mb-1">
          {reservation.number} — Saldo:{' '}
          <span className="font-medium text-gray-700">
            ${saldoUsd.toFixed(2)}
            {rate > 0 && ` / Bs. ${saldoVes.toFixed(2)}`}
          </span>
        </p>
        <p className="text-xs text-gray-400 mb-4">
          Tasa de cambio congelada: {rate > 0 ? `Bs. ${rate.toFixed(2)} / $1` : 'No disponible'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value)
                setAmount('')
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="USD">Dólares (USD)</option>
              <option value="VES">Bolívares (Bs.)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto ({currency === 'USD' ? 'USD' : 'Bs.'}) *
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          {currency === 'VES' && rate > 0 && numeric > 0 && (
            <p className="text-xs text-gray-600">Equivale a ${equivalentUsd.toFixed(2)} USD</p>
          )}
          {currency === 'USD' && rate > 0 && numeric > 0 && (
            <p className="text-xs text-gray-600">Equivale a Bs. {round2(numeric * rate).toFixed(2)}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="pos">Punto de Venta</option>
            </select>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
            >
              Registrar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
