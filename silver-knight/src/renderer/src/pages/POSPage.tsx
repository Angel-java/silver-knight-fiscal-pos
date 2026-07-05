import { useState, useEffect, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Product, type Invoice } from '../lib/api'
import { useAuth } from '../contexts/useAuth'
import ProductGrid from '../components/pos/ProductGrid'
import CartPanel from '../components/pos/CartPanel'
import CustomerModal from '../components/pos/CustomerModal'
import PaymentModal from '../components/pos/PaymentModal'
import type { CartItem } from '../components/pos/types'

export default function POSPage(): JSX.Element {
  const navigate = useNavigate()
  const { logout } = useAuth()

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
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [lastInvoice, setLastInvoice] = useState<Invoice | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        const [rateRes, prodRes, invRes] = await Promise.all([
          api.exchangeRates.getLatest(),
          api.products.list({ page: 1 }),
          api.invoices.list()
        ])
        if (rateRes.rate) setExchangeRate(rateRes.rate.rate)
        setProducts(prodRes.products)
        if (invRes.invoices.length > 0) setLastInvoice(invRes.invoices[0])
      } catch {
        /* ignore */
      }
    }
    init()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      api.products
        .list({ search, page: 1 })
        .then((r) => setProducts(r.products))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const addToCart = (product: Product): void => {
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

  const updateQty = (productId: string, qty: number): void => {
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

  const handleInvoiceCreated = (invoice: Invoice): void => {
    setLastInvoice(invoice)
    setCart([])
    setCustomer(null)
    setMessage(`Factura ${invoice.number} creada exitosamente`)
    setTimeout(() => setMessage(''), 5000)
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

      {message && (
        <div
          className={`px-4 py-2 text-sm text-center shrink-0 flex items-center justify-center gap-3 ${
            lastInvoice ? 'bg-green-100 text-green-800' : 'bg-green-100 text-green-800'
          }`}
        >
          <span>{message}</span>
          {lastInvoice && (
            <button
              onClick={() => navigate(`/invoices/${lastInvoice.id}`)}
              className="underline font-medium hover:text-green-900"
            >
              Ver factura →
            </button>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <ProductGrid
          products={products}
          search={search}
          onSearchChange={setSearch}
          onAddToCart={addToCart}
        />
        <CartPanel
          cart={cart}
          currency={currency}
          subtotalUsd={subtotalUsd}
          subtotalVes={subtotalVes}
          ivaUsd={ivaUsd}
          ivaVes={ivaVes}
          totalDisplay={totalDisplay}
          customer={customer}
          onUpdateQty={updateQty}
          onOpenCustomerModal={() => setShowCustomerModal(true)}
          onOpenPayment={() => {
            if (cart.length > 0) setShowPaymentModal(true)
          }}
        />
      </div>

      <CustomerModal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onSelect={(c) => {
          if (c.id) setCustomer(c)
          else setCustomer(null)
          setShowCustomerModal(false)
        }}
      />

      <PaymentModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        totalDisplay={totalDisplay}
        currency={currency}
        cart={cart}
        exchangeRate={exchangeRate}
        customer={customer}
        onSubmit={handleInvoiceCreated}
        onError={(msg) => setMessage(msg)}
      />
    </div>
  )
}
