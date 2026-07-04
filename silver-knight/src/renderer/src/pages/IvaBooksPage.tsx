import { useState, useEffect, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Invoice } from '../lib/api'

type Tab = 'ventas' | 'compras'

export default function IvaBooksPage(): JSX.Element {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('ventas')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [summary, setSummary] = useState<{
    totalUsd?: number
    totalVes?: number
    ivaUsd?: number
    ivaVes?: number
    count: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0])

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      if (tab === 'ventas') {
        const res = await api.iva.ventas(from, to)
        setInvoices(res.invoices)
        setSummary(res.summary)
      } else {
        const res = await api.iva.compras(from, to)
        setInvoices(res.invoices)
        setSummary(res.summary)
      }
    } catch {
      setInvoices([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async (): Promise<void> => {
      setLoading(true)
      try {
        if (tab === 'ventas') {
          const res = await api.iva.ventas(from, to)
          setInvoices(res.invoices)
          setSummary(res.summary)
        } else {
          const res = await api.iva.compras(from, to)
          setInvoices(res.invoices)
          setSummary(res.summary)
        }
      } catch {
        setInvoices([])
        setSummary(null)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [tab, from, to])

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
          <h1 className="text-2xl font-bold text-gray-800">Libros IVA</h1>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('ventas')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'ventas'
              ? 'bg-primary text-white'
              : 'bg-white text-gray-600 border hover:bg-gray-50'
          }`}
        >
          Libro de Ventas
        </button>
        <button
          onClick={() => setTab('compras')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'compras'
              ? 'bg-primary text-white'
              : 'bg-white text-gray-600 border hover:bg-gray-50'
          }`}
        >
          Libro de Compras
        </button>
      </div>

      <div className="flex gap-4 mb-6 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary-dark transition-colors"
        >
          Consultar
        </button>
      </div>

      {summary && tab === 'ventas' && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-xs text-blue-600 font-medium">Facturas</p>
            <p className="text-xl font-bold text-blue-800">{summary.count}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-xs text-green-600 font-medium">Total USD</p>
            <p className="text-xl font-bold text-green-800">
              ${(summary.totalUsd || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-xs text-green-600 font-medium">Total VES</p>
            <p className="text-xl font-bold text-green-800">
              Bs.{(summary.totalVes || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-xs text-purple-600 font-medium">IVA USD</p>
            <p className="text-xl font-bold text-purple-800">${(summary.ivaUsd || 0).toFixed(2)}</p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Nº Factura
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Cliente</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">RIF</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Total</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">IVA</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-sm">{inv.number}</td>
                  <td className="px-4 py-3 text-sm">{inv.documentType}</td>
                  <td className="px-4 py-3 text-sm">{inv.customer?.name || 'Consumidor Final'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{inv.customer?.rif || '—'}</td>
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
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        inv.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {inv.status === 'active' ? 'Activa' : 'Anulada'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500">
                    {new Date(inv.createdAt).toLocaleDateString('es-VE')}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No hay documentos en este período
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
