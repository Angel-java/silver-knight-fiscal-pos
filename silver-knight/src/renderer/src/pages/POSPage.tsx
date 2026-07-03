import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Product, type Invoice } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface CartItem {
  productId: string
  productName: string
  quantity: number
  unitPriceUsd: number
  unitPriceVes: number
  ivaRate: number
}

export default function POSPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const searchRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD')
  const [exchangeRate, setExchangeRate] = useState(0)
  const [customer, setCustomer] = useState<{
    id: string
    name: string
    rif?: string | null
  } | null>(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<
    Array<{ id: string; name: string; rif: string | null }>
  >([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lastInvoice, setLastInvoice] = useState<Invoice | null>(null)
  const [message, setMessage] = useState('')

  const [payments, setPayments] = useState<
    Array<{ method: string; amount: string; currency: string }>
  >([{ method: 'cash', amount: '', currency: 'USD' }])

  const loadProducts = async () => {
    try {
      const res = await api.products.list({ search, page: 1 })
      setProducts(res.products)
    } catch {
      /* ignore */
    }
  }

  const loadExchangeRate = async () => {
    try {
      const res = await api.exchangeRates.getLatest()
      if (res.rate) setExchangeRate(res.rate.rate)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadExchangeRate()
    api.products
      .list({ page: 1 })
      .then((r) => setProducts(r.products))
      .catch(() => {})
    api.invoices
      .list()
      .then((r) => {
        if (r.invoices.length > 0) setLastInvoice(r.invoices[0])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const timer = setTimeout(loadProducts, 300)
    return () => clearTimeout(timer)
  }, [search])

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      setMessage(`"${product.name}" no tiene stock disponible`)
      setTimeout(() => setMessage(''), 3000)
      return
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        if (existing.quantity >= product.stock) {
          setMessage(`Stock insuficiente para "${product.name}"`)
          setTimeout(() => setMessage(''), 3000)
          return prev
        }
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPriceUsd: product.priceUsd,
          unitPriceVes: product.priceVes,
          ivaRate: product.ivaRate
        }
      ]
    })
  }

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.productId !== productId))
      return
    }
    setCart((prev) => prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i)))
  }

  const subtotalUsd = cart.reduce((s, i) => s + i.unitPriceUsd * i.quantity, 0)
  const subtotalVes = cart.reduce((s, i) => s + i.unitPriceVes * i.quantity, 0)
  const ivaUsd = cart.reduce((s, i) => s + i.unitPriceUsd * i.quantity * (i.ivaRate / 100), 0)
  const ivaVes = cart.reduce((s, i) => s + i.unitPriceVes * i.quantity * (i.ivaRate / 100), 0)
  const totalDisplay = currency === 'USD' ? subtotalUsd + ivaUsd : subtotalVes + ivaVes

  const openPayment = () => {
    if (cart.length === 0) return
    setPayments([{ method: 'cash', amount: String(totalDisplay), currency }])
    setShowPaymentModal(true)
  }

  const addPayment = () => {
    setPayments((prev) => [...prev, { method: 'transfer', amount: '', currency }])
  }

  const updatePayment = (i: number, field: string, value: string) => {
    setPayments((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)))
  }

  const removePayment = (i: number) => {
    setPayments((prev) => prev.filter((_, idx) => idx !== i))
  }

  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const change = totalPaid - totalDisplay

  const handleSubmitInvoice = async () => {
    if (cart.length === 0 || totalPaid < totalDisplay) return
    setSubmitting(true)
    try {
      const res = await api.invoices.create({
        customerId: customer?.id || null,
        currency,
        exchangeRate,
        items: cart.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unitPriceUsd: i.unitPriceUsd,
          unitPriceVes: i.unitPriceVes,
          ivaRate: i.ivaRate
        })),
        payments: payments.map((p) => ({
          method: p.method,
          amount: parseFloat(p.amount) || 0,
          currency: p.currency
        }))
      })
      setLastInvoice(res.invoice)
      setCart([])
      setCustomer(null)
      setShowPaymentModal(false)
      setMessage(`Factura ${res.invoice.number} creada exitosamente`)
      setTimeout(() => setMessage(''), 5000)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error al crear factura')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!showCustomerModal) return
    setCustomerSearch('')
    setCustomerResults([])
  }, [showCustomerModal])

  useEffect(() => {
    if (!showCustomerModal) return
    const timer = setTimeout(async () => {
      setLoadingCustomers(true)
      try {
        const res = await api.customers.list({ search: customerSearch })
        setCustomerResults(res.customers)
      } catch {
        /* ignore */
      } finally {
        setLoadingCustomers(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch, showCustomerModal])

  const selectCustomer = (c: { id: string; name: string; rif: string | null }) => {
    setCustomer(c)
    setShowCustomerModal(false)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white shadow-sm border-b px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700">
            ←
          </button>
          <span className="font-bold text-gray-800">POS</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {lastInvoice && (
            <button
              onClick={() => navigate(`/invoices/${lastInvoice.id}`)}
              className="text-gray-500 hover:text-primary underline"
            >
              Última: {lastInvoice.number}
            </button>
          )}
          <button onClick={logout} className="text-red-600 hover:text-red-800">
            Cerrar sesión
          </button>
        </div>
      </header>

      {message && lastInvoice && (
        <div className="bg-green-100 text-green-800 px-4 py-2 text-sm text-center shrink-0 flex items-center justify-center gap-3">
          <span>{message}</span>
          <button
            onClick={() => navigate(`/invoices/${lastInvoice.id}`)}
            className="underline font-medium hover:text-green-900"
          >
            Ver factura →
          </button>
        </div>
      )}
      {message && !lastInvoice && (
        <div className="bg-green-100 text-green-800 px-4 py-2 text-sm text-center shrink-0">
          {message}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          <div className="flex gap-2 mb-4 shrink-0">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto por nombre, código o código de barra..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-lg"
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.stock <= 0}
                className={`bg-white rounded-lg shadow p-4 text-left hover:shadow-md transition-shadow border ${
                  p.stock <= 0
                    ? 'border-red-200 opacity-50 cursor-not-allowed'
                    : 'border-transparent hover:border-primary/30'
                }`}
              >
                <p className="font-medium text-gray-800 truncate">{p.name}</p>
                <p className="text-lg font-bold text-primary mt-1">
                  {currency === 'USD' ? `$${p.priceUsd.toFixed(2)}` : `Bs.${p.priceVes.toFixed(2)}`}
                </p>
                <p className={`text-xs ${p.stock <= 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {p.stock <= 0 ? 'Agotado' : `Stock: ${p.stock}`}
                </p>
              </button>
            ))}
            {products.length === 0 && (
              <p className="col-span-full text-center text-gray-400 py-8">
                Escribe para buscar productos
              </p>
            )}
          </div>
        </div>

        <div className="w-96 bg-white shadow-lg flex flex-col">
          <div className="p-4 border-b shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-800">Carrito</h2>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setCurrency('USD')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${currency === 'USD' ? 'bg-primary text-white' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  USD
                </button>
                <button
                  onClick={() => setCurrency('VES')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${currency === 'VES' ? 'bg-primary text-white' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  VES
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowCustomerModal(true)}
              className="w-full text-left px-3 py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:border-primary hover:text-primary transition-colors"
            >
              {customer
                ? `👤 ${customer.name}${customer.rif ? ` — ${customer.rif}` : ''}`
                : '+ Agregar cliente'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">Carrito vacío</p>
            )}
            {cart.map((item) => (
              <div
                key={item.productId}
                className="flex items-center gap-2 bg-gray-50 rounded-lg p-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                  <p className="text-xs text-gray-400">
                    {currency === 'USD'
                      ? `$${item.unitPriceUsd.toFixed(2)}`
                      : `Bs.${item.unitPriceVes.toFixed(2)}`}{' '}
                    c/u
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQty(item.productId, item.quantity - 1)}
                    className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 text-gray-600 font-bold text-sm"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => updateQty(item.productId, item.quantity + 1)}
                    className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 text-gray-600 font-bold text-sm"
                  >
                    +
                  </button>
                </div>
                <p className="w-16 text-right text-sm font-bold text-gray-800">
                  {currency === 'USD'
                    ? `$${(item.unitPriceUsd * item.quantity).toFixed(2)}`
                    : `Bs.${(item.unitPriceVes * item.quantity).toFixed(2)}`}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t p-4 space-y-2 shrink-0">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>
                {currency === 'USD' ? `$${subtotalUsd.toFixed(2)}` : `Bs.${subtotalVes.toFixed(2)}`}
              </span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>IVA</span>
              <span>
                {currency === 'USD' ? `$${ivaUsd.toFixed(2)}` : `Bs.${ivaVes.toFixed(2)}`}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-800 border-t pt-2">
              <span>Total</span>
              <span>
                {currency === 'USD'
                  ? `$${totalDisplay.toFixed(2)}`
                  : `Bs.${totalDisplay.toFixed(2)}`}
              </span>
            </div>
            <button
              onClick={openPayment}
              disabled={cart.length === 0}
              className="w-full py-3 bg-primary text-white rounded-lg font-bold text-lg hover:bg-primary-dark disabled:opacity-50 transition-colors mt-2"
            >
              Cobrar
            </button>
          </div>
        </div>
      </div>

      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Seleccionar Cliente</h2>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Buscar por nombre, RIF o teléfono..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              autoFocus
            />
            <div className="max-h-60 overflow-y-auto space-y-1 mb-4">
              {loadingCustomers ? (
                <p className="text-gray-400 text-sm text-center py-4">Buscando...</p>
              ) : customerResults.length > 0 ? (
                customerResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCustomer(c)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <span className="font-medium text-gray-800">{c.name}</span>
                    {c.rif && <span className="text-sm text-gray-500 ml-2">{c.rif}</span>}
                  </button>
                ))
              ) : (
                <p className="text-gray-400 text-sm text-center py-4">
                  {customerSearch ? 'Sin resultados' : 'Escribe para buscar clientes'}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCustomerModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setCustomer(null)
                  setShowCustomerModal(false)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Sin cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Cobrar</h2>

            <div className="bg-gray-50 rounded-lg p-4 mb-4 text-center">
              <p className="text-sm text-gray-500">Total a cobrar</p>
              <p className="text-3xl font-bold text-gray-800">
                {currency === 'USD'
                  ? `$${totalDisplay.toFixed(2)}`
                  : `Bs.${totalDisplay.toFixed(2)}`}
              </p>
            </div>

            <div className="space-y-3 mb-4">
              {payments.map((p, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={p.method}
                    onChange={(e) => updatePayment(i, 'method', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Punto de venta</option>
                  </select>
                  <span className="text-sm text-gray-500">
                    {p.currency === 'USD' ? '$' : 'Bs.'}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={p.amount}
                    onChange={(e) => updatePayment(i, 'amount', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="0.00"
                  />
                  {payments.length > 1 && (
                    <button
                      onClick={() => removePayment(i)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addPayment} className="text-sm text-primary hover:text-primary-dark">
                + Agregar otro método de pago
              </button>
            </div>

            {totalPaid > 0 && (
              <div className="space-y-1 text-sm mb-4">
                <div className="flex justify-between">
                  <span>Recibido</span>
                  <span>
                    {currency === 'USD' ? `$${totalPaid.toFixed(2)}` : `Bs.${totalPaid.toFixed(2)}`}
                  </span>
                </div>
                {change >= 0 && (
                  <div className="flex justify-between text-green-600 font-bold">
                    <span>Vuelto</span>
                    <span>
                      {currency === 'USD' ? `$${change.toFixed(2)}` : `Bs.${change.toFixed(2)}`}
                    </span>
                  </div>
                )}
                {change < 0 && (
                  <p className="text-red-500 text-xs">
                    Faltan {(totalDisplay - totalPaid).toFixed(2)}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitInvoice}
                disabled={submitting || totalPaid < totalDisplay}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors font-bold"
              >
                {submitting
                  ? 'Procesando...'
                  : `Cobrar ${currency === 'USD' ? `$${totalDisplay.toFixed(2)}` : `Bs.${totalDisplay.toFixed(2)}`}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
