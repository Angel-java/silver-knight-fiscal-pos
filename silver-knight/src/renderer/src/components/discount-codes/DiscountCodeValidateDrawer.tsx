import { useEffect, useState, type JSX } from 'react'
import { api, type Customer, type Product, type ValidatedDiscount } from '../../lib/api'
import { useDebounceValue } from '../../hooks/useDebounce'

interface TestItem {
  productId: string | null
  categoryId: string | null
  productName: string
  quantity: number
  subtotalLine: number
}

interface DiscountCodeValidateDrawerProps {
  open: boolean
  code?: string
  onClose: () => void
}

export default function DiscountCodeValidateDrawer({
  open,
  code: initialCode = '',
  onClose
}: DiscountCodeValidateDrawerProps): JSX.Element | null {
  const [code, setCode] = useState(initialCode)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [currency, setCurrency] = useState<'USD' | 'VES'>('VES')
  const [subtotal, setSubtotal] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [items, setItems] = useState<TestItem[]>([])

  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const debouncedCustomer = useDebounceValue(customerSearch, 300)

  const [productSearch, setProductSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const debouncedProduct = useDebounceValue(productSearch, 300)

  const [result, setResult] = useState<ValidatedDiscount | null>(null)
  const [error, setError] = useState('')
  const [validating, setValidating] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      void (async (): Promise<void> => {
        if (!debouncedCustomer.trim()) {
          setCustomers([])
          return
        }
        setCustomersLoading(true)
        try {
          const res = await api.customers.list({ search: debouncedCustomer, page: 1 })
          setCustomers(res.customers)
        } catch {
          setCustomers([])
        } finally {
          setCustomersLoading(false)
        }
      })()
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCustomer])

  useEffect(() => {
    const t = setTimeout(() => {
      void (async (): Promise<void> => {
        if (!debouncedProduct.trim()) {
          setProducts([])
          return
        }
        setProductsLoading(true)
        try {
          const res = await api.products.list({ search: debouncedProduct, page: 1 })
          setProducts(res.products)
        } catch {
          setProducts([])
        } finally {
          setProductsLoading(false)
        }
      })()
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedProduct])

  const handleAddItem = (p: Product): void => {
    if (items.find((i) => i.productId === p.id)) return
    setItems((prev) => [
      ...prev,
      {
        productId: p.id,
        categoryId: p.categoryId,
        productName: p.name,
        quantity: 1,
        subtotalLine: p.priceUsd
      }
    ])
  }

  const handleRemoveItem = (idx: number): void => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleUpdateItem = (idx: number, field: keyof TestItem, value: number): void => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    )
  }

  const handleValidate = async (): Promise<void> => {
    setError('')
    setResult(null)
    setValidating(true)
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        customerId,
        currency,
        subtotal: parseFloat(subtotal) || 0,
        quantity: parseFloat(quantity) || 0,
        items: items.map((it) => ({
          productId: it.productId,
          categoryId: it.categoryId,
          quantity: it.quantity,
          subtotalLine: it.subtotalLine
        }))
      }
      const res = await api.discountCodes.validate(payload)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al validar')
    } finally {
      setValidating(false)
    }
  }

  const handleReset = (): void => {
    setResult(null)
    setError('')
    setItems([])
    setCustomerId(null)
    setCustomerSearch('')
    setProductSearch('')
    setSubtotal('')
    setQuantity('1')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-lg flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Probar Código de Descuento</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono"
              placeholder="PROMO20"
            />
          </div>

          <div className="border border-gray-200 rounded-md p-3 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Cliente (opcional)</h3>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Buscar cliente por nombre/RIF..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            {customerId && (
              <div className="flex items-center justify-between bg-primary/5 px-2 py-1 rounded text-xs">
                <span>Cliente seleccionado</span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerId(null)
                    setCustomerSearch('')
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  Quitar
                </button>
              </div>
            )}
            {customersLoading && <p className="text-xs text-gray-400">Buscando...</p>}
            {!customersLoading && customers.length > 0 && !customerId && (
              <div className="max-h-40 overflow-y-auto border rounded divide-y">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCustomerId(c.id)
                      setCustomerSearch(c.name)
                      setCustomers([])
                    }}
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.rif && <span className="text-gray-400 ml-2">{c.rif}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-md p-3 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Carrito de prueba</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Moneda</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'USD' | 'VES')}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                >
                  <option value="VES">VES</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Cantidad total</label>
                <input
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Subtotal ({currency})</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={subtotal}
                  onChange={(e) => setSubtotal(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Ítems (para scope PRODUCTS/CATEGORIES)</label>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar producto para agregar..."
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm mb-2"
              />
              {productsLoading && <p className="text-xs text-gray-400 mb-2">Buscando...</p>}
              {!productsLoading && products.length > 0 && (
                <div className="max-h-32 overflow-y-auto border rounded divide-y mb-2">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddItem(p)}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50"
                    >
                      <span className="font-medium">{p.name}</span>
                      {p.code && <span className="text-gray-400 ml-1">({p.code})</span>}
                    </button>
                  ))}
                </div>
              )}
              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="border rounded p-2 bg-gray-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium truncate">{it.productName}</span>
                        <button type="button" onClick={() => handleRemoveItem(idx)} className="text-red-600 hover:text-red-700 text-xs">
                          Eliminar
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">Cantidad</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.quantity}
                            onChange={(e) => handleUpdateItem(idx, 'quantity', Number(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">Subtotal línea ({currency})</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.subtotalLine}
                            onChange={(e) => handleUpdateItem(idx, 'subtotalLine', Number(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">{error}</div>}
          {result && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-green-800">✓ Código válido</h4>
                <span className="text-xs font-mono bg-green-100 px-2 py-0.5 rounded">{result.code}</span>
              </div>
              {result.description && <p className="text-xs text-green-700">{result.description}</p>}
              <div className="grid grid-cols-2 gap-2 text-xs text-green-800">
                <div>
                  <span className="text-green-600">Descuento:</span> <strong>{result.discountValue}%</strong>
                </div>
                <div>
                  <span className="text-green-600">Moneda contexto:</span> {currency}
                </div>
                {result.discountAmountUsd > 0 && (
                  <div>
                    <span className="text-green-600">Desc. USD:</span> ${result.discountAmountUsd.toFixed(2)}
                  </div>
                )}
                {result.discountAmountVes > 0 && (
                  <div>
                    <span className="text-green-600">Desc. VES:</span> Bs. {result.discountAmountVes.toFixed(2)}
                  </div>
                )}
                <div>
                  <span className="text-green-600">Subtotal después (USD):</span> ${result.subtotalAfterDiscountUsd.toFixed(2)}
                </div>
                <div>
                  <span className="text-green-600">Subtotal después (VES):</span> Bs. {result.subtotalAfterDiscountVes.toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-3 flex items-center justify-between bg-white">
          <button type="button" onClick={handleReset} className="px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50" disabled={validating}>
            Limpiar
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50" disabled={validating}>
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleValidate}
              disabled={validating || !code.trim()}
              className="px-4 py-1.5 bg-primary text-white rounded-md text-sm hover:bg-primary-dark disabled:opacity-50"
            >
              {validating ? 'Validando...' : 'Probar Código'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
