import { useState, useEffect, useCallback, useRef, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Invoice, type Product } from '../lib/api'

type Tab = 'daily' | 'range' | 'inventory' | 'top' | 'cashclose'

const tabs: { key: Tab; label: string }[] = [
  { key: 'daily', label: 'Ventas del Día' },
  { key: 'range', label: 'Ventas por Período' },
  { key: 'top', label: 'Top Productos' },
  { key: 'inventory', label: 'Inventario' },
  { key: 'cashclose', label: 'Cierre de Caja' }
]

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Punto de Venta'
}

export default function ReportsPage(): JSX.Element {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('daily')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dailyData, setDailyData] = useState<{
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
  } | null>(null)

  const [rangeFrom, setRangeFrom] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [rangeTo, setRangeTo] = useState(() => new Date().toISOString().split('T')[0])
  const [rangeData, setRangeData] = useState<{
    invoices: Invoice[]
    summary: {
      totalUsd: number
      totalVes: number
      count: number
      cancelledCount: number
    }
  } | null>(null)

  const [inventoryData, setInventoryData] = useState<{
    products: Product[]
    summary: {
      totalProducts: number
      totalValueUsd: number
      lowStockCount: number
      outOfStockCount: number
    }
  } | null>(null)

  const [topData, setTopData] = useState<{
    top: Array<{ productName: string; quantity: number; totalUsd: number; totalVes: number; costUsd: number }>
    summary: { totalQty: number; totalUsd: number; totalCost: number; count: number }
  } | null>(null)

  const [cashDate, setCashDate] = useState(() => new Date().toISOString().split('T')[0])
  const [cashData, setCashData] = useState<{
    invoices: Invoice[]
    summary: {
      totalUsd: number
      totalVes: number
      count: number
      cancelledCount: number
      paymentsBreakdown: Record<string, { usd: number; ves: number; count: number }>
    }
  } | null>(null)

  const loadSeq = useRef(0)

  const loadData = useCallback(async (): Promise<void> => {
    const seq = ++loadSeq.current
    setLoading(true)
    setError('')
    try {
      switch (tab) {
        case 'daily': {
          const res = await api.reports.salesDaily()
          if (seq !== loadSeq.current) return
          setDailyData(res)
          break
        }
        case 'range': {
          const res = await api.reports.salesRange(rangeFrom, rangeTo)
          if (seq !== loadSeq.current) return
          setRangeData(res)
          break
        }
        case 'inventory': {
          const res = await api.reports.inventory()
          if (seq !== loadSeq.current) return
          setInventoryData(res)
          break
        }
        case 'top': {
          const res = await api.reports.topProducts()
          if (seq !== loadSeq.current) return
          setTopData(res)
          break
        }
        case 'cashclose': {
          const res = await api.reports.cashClose(cashDate)
          if (seq !== loadSeq.current) return
          setCashData(res)
          break
        }
      }
    } catch (err) {
      if (seq !== loadSeq.current) return
      setError(err instanceof Error ? err.message : 'Error al cargar reporte')
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
  }, [tab, rangeFrom, rangeTo, cashDate])

  const loadDataRef = useRef(loadData)
  useEffect(() => {
    loadDataRef.current = loadData
  }, [loadData])

  useEffect(() => {
    loadDataRef.current()
  }, [tab])

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
          <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm"
        >
          Imprimir / PDF
        </button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-primary text-white'
                : 'bg-white text-gray-600 border hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {/* Ventas del Día */}
      {tab === 'daily' && (
        <div>
          {dailyData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs text-blue-600 font-medium">Facturas</p>
                <p className="text-xl font-bold text-blue-800">{dailyData.summary.count}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-xs text-green-600 font-medium">Total USD</p>
                <p className="text-xl font-bold text-green-800">
                  ${dailyData.summary.totalUsd.toFixed(2)}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-xs text-green-600 font-medium">Total VES</p>
                <p className="text-xl font-bold text-green-800">
                  Bs.{dailyData.summary.totalVes.toFixed(2)}
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-xs text-purple-600 font-medium">Productos</p>
                <p className="text-xl font-bold text-purple-800">
                  {dailyData.summary.productsSold}
                </p>
              </div>
            </div>
          )}

          {dailyData && Object.keys(dailyData.summary.paymentsBreakdown).length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <h3 className="font-bold text-gray-700 mb-3">Métodos de Pago</h3>
              <div className="space-y-2">
                {Object.entries(dailyData.summary.paymentsBreakdown).map(([method, amounts]) => (
                  <div key={method} className="flex justify-between text-sm">
                    <span className="text-gray-600">{PAYMENT_LABELS[method] || method}</span>
                    <span className="font-medium">
                      {amounts.usd > 0 && `$${amounts.usd.toFixed(2)} `}
                      {amounts.ves > 0 && `Bs.${amounts.ves.toFixed(2)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {renderInvoiceTable(dailyData?.invoices || [], navigate)}
        </div>
      )}

      {/* Ventas por Período */}
      {tab === 'range' && (
        <div>
          <div className="flex gap-4 mb-6 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
              <input
                type="date"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
              <input
                type="date"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary-dark"
            >
              Consultar
            </button>
          </div>

          {rangeData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs text-blue-600 font-medium">Facturas</p>
                <p className="text-xl font-bold text-blue-800">{rangeData.summary.count}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-xs text-red-600 font-medium">Anuladas</p>
                <p className="text-xl font-bold text-red-800">{rangeData.summary.cancelledCount}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-xs text-green-600 font-medium">Total USD</p>
                <p className="text-xl font-bold text-green-800">
                  ${rangeData.summary.totalUsd.toFixed(2)}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-xs text-green-600 font-medium">Total VES</p>
                <p className="text-xl font-bold text-green-800">
                  Bs.{rangeData.summary.totalVes.toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {renderInvoiceTable(rangeData?.invoices || [], navigate)}
        </div>
      )}

      {/* Top Productos */}
      {tab === 'top' && (
        <div>
          <div className="flex gap-4 mb-6 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
              <input
                type="date"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
              <input
                type="date"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <button
              onClick={async () => {
                setLoading(true)
                try {
                  const res = await api.reports.topProducts(rangeFrom, rangeTo)
                  setTopData(res)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Error')
                } finally {
                  setLoading(false)
                }
              }}
              className="px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary-dark"
            >
              Consultar
            </button>
          </div>

          {topData && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs text-blue-600 font-medium">Productos diferentes</p>
                <p className="text-xl font-bold text-blue-800">{topData.summary.count}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-xs text-green-600 font-medium">Unidades vendidas</p>
                <p className="text-xl font-bold text-green-800">{topData.summary.totalQty}</p>
              </div>
            </div>
          )}

          {topData && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">#</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                      Producto
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                      Cantidad
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                      Costo USD
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                      Total USD
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                      Ganancia
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topData.top.map((p, i) => (
                    <tr key={p.productName + i} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3 font-medium">{p.productName}</td>
                      <td className="px-4 py-3 text-right">{p.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-500">${p.costUsd.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">${p.totalUsd.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">
                        ${(p.totalUsd - p.costUsd).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Inventario */}
      {tab === 'inventory' && (
        <div>
          {inventoryData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs text-blue-600 font-medium">Total Productos</p>
                <p className="text-xl font-bold text-blue-800">
                  {inventoryData.summary.totalProducts}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-xs text-green-600 font-medium">Valor Costo USD</p>
                <p className="text-xl font-bold text-green-800">
                  ${inventoryData.summary.totalValueUsd.toFixed(2)}
                </p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-xs text-orange-600 font-medium">Stock Bajo</p>
                <p className="text-xl font-bold text-orange-800">
                  {inventoryData.summary.lowStockCount}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-xs text-red-600 font-medium">Sin Stock</p>
                <p className="text-xl font-bold text-red-800">
                  {inventoryData.summary.outOfStockCount}
                </p>
              </div>
            </div>
          )}

          {inventoryData && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                      Producto
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                      Categoría
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                      Stock
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                      Costo USD
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                      Precio USD
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                      Valor Total USD
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryData.products.map((p) => {
                    const lowStock = p.minStock > 0 && p.stock <= p.minStock
                    return (
                      <tr
                        key={p.id}
                        className={`border-b last:border-0 hover:bg-gray-50 ${lowStock || p.stock <= 0 ? 'bg-red-50' : ''}`}
                      >
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {p.category?.name || '—'}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-medium ${lowStock ? 'text-red-600' : ''}`}
                        >
                          {p.stock}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.costUsd ? `$${p.costUsd.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">${p.priceUsd.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          ${((p.costUsd || 0) * p.stock).toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cierre de Caja */}
      {tab === 'cashclose' && (
        <div>
          <div className="flex gap-4 mb-6 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fecha</label>
              <input
                type="date"
                value={cashDate}
                onChange={(e) => setCashDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary-dark"
            >
              Consultar
            </button>
            <span className="text-sm text-gray-400 italic">
              Los totales reflejan solo facturas activas
            </span>
          </div>

          {cashData && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs text-blue-600 font-medium">Facturas</p>
                  <p className="text-xl font-bold text-blue-800">{cashData.summary.count}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-xs text-red-600 font-medium">Anuladas</p>
                  <p className="text-xl font-bold text-red-800">
                    {cashData.summary.cancelledCount}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-xs text-green-600 font-medium">Efectivo USD</p>
                  <p className="text-xl font-bold text-green-800">
                    ${(cashData.summary.paymentsBreakdown.cash?.usd || 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-xs text-green-600 font-medium">Efectivo VES</p>
                  <p className="text-xl font-bold text-green-800">
                    Bs.{(cashData.summary.paymentsBreakdown.cash?.ves || 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-xs text-purple-600 font-medium">Total USD</p>
                  <p className="text-xl font-bold text-purple-800">
                    ${cashData.summary.totalUsd.toFixed(2)}
                  </p>
                </div>
              </div>

              {Object.keys(cashData.summary.paymentsBreakdown).length > 0 && (
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                  <h3 className="font-bold text-gray-700 mb-3">Resumen por Método de Pago</h3>
                  <div className="space-y-2">
                    {Object.entries(cashData.summary.paymentsBreakdown).map(([method, data]) => (
                      <div key={method} className="flex justify-between items-center py-1">
                        <span className="text-gray-600 font-medium">
                          {PAYMENT_LABELS[method] || method}
                        </span>
                        <div className="text-right">
                          <span className="text-sm text-gray-500 mr-2">
                            ({data.count} transacciones)
                          </span>
                          {data.usd > 0 && (
                            <span className="font-medium mr-2">${data.usd.toFixed(2)}</span>
                          )}
                          {data.ves > 0 && (
                            <span className="font-medium">Bs.{data.ves.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between font-bold text-gray-800">
                      <span>Totales</span>
                      <span>
                        ${cashData.summary.totalUsd.toFixed(2)} | Bs.
                        {cashData.summary.totalVes.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {loading && <p className="text-gray-500 text-center py-8">Cargando...</p>}

      {!loading && !error && tab === 'daily' && dailyData?.invoices.length === 0 && (
        <p className="text-gray-400 text-center py-8">No hay ventas hoy</p>
      )}
      {!loading && !error && tab === 'range' && rangeData?.invoices.length === 0 && (
        <p className="text-gray-400 text-center py-8">No hay facturas en este período</p>
      )}
      {!loading && !error && tab === 'inventory' && inventoryData?.products.length === 0 && (
        <p className="text-gray-400 text-center py-8">No hay productos en el inventario</p>
      )}
    </div>
  )
}

function renderInvoiceTable(
  invoices: Invoice[],
  navigate: ReturnType<typeof useNavigate>
): JSX.Element | null {
  if (invoices.length === 0) return null
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden print:shadow-none">
      <table className="w-full">
        <thead className="bg-gray-50 border-b print:bg-gray-100">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nº</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Cliente</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Total</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">IVA</th>
            <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Moneda</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Hora</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr
              key={inv.id}
              className="border-b last:border-0 hover:bg-gray-50 cursor-pointer print:cursor-default"
              onClick={() => navigate(`/invoices/${inv.id}`)}
            >
              <td className="px-4 py-3 font-medium text-sm">{inv.number}</td>
              <td className="px-4 py-3 text-sm">{inv.customer?.name || 'Consumidor Final'}</td>
              <td className="px-4 py-3 text-right text-sm">
                {inv.currency === 'USD'
                  ? `$${inv.totalUsd.toFixed(2)}`
                  : `Bs.${inv.totalVes.toFixed(2)}`}
              </td>
              <td className="px-4 py-3 text-right text-sm">
                {inv.currency === 'USD'
                  ? `$${inv.ivaUsd.toFixed(2)}`
                  : `Bs.${inv.ivaVes.toFixed(2)}`}
              </td>
              <td className="px-4 py-3 text-center text-sm">{inv.currency}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-500">
                {new Date(inv.createdAt).toLocaleTimeString('es-VE', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
