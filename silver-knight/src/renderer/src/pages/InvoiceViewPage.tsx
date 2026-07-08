import { useState, useEffect } from 'react'
import type { JSX } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Invoice } from '../lib/api'
import TicketPreview from '../components/TicketPreview'

const DOC_LABELS: Record<string, string> = {
  FACT: 'Factura',
  NCR: 'Nota de Crédito',
  NDB: 'Nota de Débito'
}

export default function InvoiceViewPage(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (!id) return
    api.invoices
      .get(id)
      .then((r) => {
        setInvoice(r.invoice)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [id])

  const handleCancel = async (): Promise<void> => {
    if (!invoice || !cancelReason.trim()) return
    try {
      const res = await api.invoices.cancel(invoice.id, cancelReason)
      setInvoice(res.invoice)
      setShowCancelModal(false)
      setCancelReason('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al anular')
    }
  }

  const handlePrint = async (): Promise<void> => {
    if (!invoice) return
    setPrinting(true)
    try {
      await api.print.invoice(invoice.id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al imprimir')
    } finally {
      setPrinting(false)
    }
  }

  const handlePreview = (): void => {
    if (!invoice) return
    setShowPreview(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Cargando factura...</p>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 text-center">
          <p className="text-red-500 mb-4">{error || 'Factura no encontrada'}</p>
          <button onClick={() => navigate('/')} className="text-primary hover:underline">
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  const currency = invoice.currency
  const payments = invoice.payments ? JSON.parse(invoice.payments) : []

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            ← Volver
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreview}
              className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Vista previa
            </button>
            <button
              onClick={handlePrint}
              disabled={printing}
              className="px-3 py-1 text-sm text-primary border border-primary rounded-md hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              {printing ? 'Imprimiendo...' : 'Reimprimir'}
            </button>
            {invoice.status === 'active' && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
              >
                Anular
              </button>
            )}
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                invoice.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {invoice.status === 'active' ? 'Activa' : 'Anulada'}
            </span>
          </div>
        </div>

        <div className="border-b pb-6 mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800">
            {DOC_LABELS[invoice.documentType] || 'Factura'} Nº {invoice.number}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date(invoice.createdAt).toLocaleDateString('es-VE', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>

        {invoice.cancelReason && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 text-sm text-red-700">
            <span className="font-medium">Anulada:</span> {invoice.cancelReason}
            {invoice.cancelledAt && (
              <span className="text-red-500 ml-2">
                —{' '}
                {new Date(invoice.cancelledAt).toLocaleDateString('es-VE', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Documento
            </h3>
            <p className="text-gray-800 font-medium">
              {DOC_LABELS[invoice.documentType] || 'Factura'}
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Número CF
            </h3>
            <p className="text-gray-800 font-medium">{invoice.controlNumber || '—'}</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Moneda
            </h3>
            <p className="text-gray-800 font-medium">
              {invoice.currency === 'USD' ? 'USD (Dólar)' : 'VES (Bolívar)'}
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Tasa BCV
            </h3>
            <p className="text-gray-800 font-medium">
              Bs. {Number(invoice.exchangeRate).toFixed(2)} / USD
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Cliente
            </h3>
            <p className="text-gray-800 font-medium">
              {invoice.customer ? invoice.customer.name : 'Consumidor Final'}
            </p>
            {invoice.customer?.rif && (
              <p className="text-sm text-gray-500">RIF: {invoice.customer.rif}</p>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Control Fiscal
            </h3>
            <p className="text-gray-800 font-medium">{invoice.fiscalControl?.resolution || '—'}</p>
          </div>
        </div>

        <table className="w-full mb-6">
          <thead>
            <tr className="border-y bg-gray-50">
              <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase">
                Producto
              </th>
              <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 uppercase">
                Cant.
              </th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase">
                Precio
              </th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase">
                IVA
              </th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={item.id || i} className="border-b">
                <td className="py-2 px-2 text-gray-800">{item.productName}</td>
                <td className="text-center py-2 px-2 text-gray-600">{item.quantity}</td>
                <td className="text-right py-2 px-2 text-gray-800">
                  {currency === 'USD'
                    ? `$${item.unitPriceUsd.toFixed(2)}`
                    : `Bs.${item.unitPriceVes.toFixed(2)}`}
                </td>
                <td className="text-right py-2 px-2 text-gray-600">{item.ivaRate}%</td>
                <td className="text-right py-2 px-2 text-gray-800 font-medium">
                  {currency === 'USD'
                    ? `$${item.totalUsd.toFixed(2)}`
                    : `Bs.${item.totalVes.toFixed(2)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t pt-4 space-y-1 text-right">
          <div className="flex justify-end gap-8 text-sm text-gray-500">
            <span>Subtotal:</span>
              <span className="w-32 text-right">
                {currency === 'USD'
                  ? `$${invoice.totalUsd.toFixed(2)}`
                  : `Bs.${invoice.totalVes.toFixed(2)}`}
              </span>
          </div>
          <div className="flex justify-end gap-8 text-sm text-gray-500">
            <span>IVA:</span>
            <span className="w-32 text-right">
              {currency === 'USD'
                ? `$${invoice.ivaUsd.toFixed(2)}`
                : `Bs.${invoice.ivaVes.toFixed(2)}`}
            </span>
          </div>
          <div className="flex justify-end gap-8 text-lg font-bold text-gray-800 border-t pt-2">
            <span>Total:</span>
              <span className="w-32 text-right">
                {currency === 'USD'
                  ? `$${(invoice.totalUsd + invoice.ivaUsd).toFixed(2)}`
                  : `Bs.${(invoice.totalVes + invoice.ivaVes).toFixed(2)}`}
              </span>
            </div>
            {currency === 'USD' && (
            <div className="flex justify-end gap-8 text-sm text-gray-400">
              <span>Total en Bs.:</span>
              <span className="w-32 text-right">
                Bs.{((invoice.totalUsd + invoice.ivaUsd) * invoice.exchangeRate).toFixed(2)}
              </span>
            </div>
          )}
          {currency === 'VES' && (
            <div className="flex justify-end gap-8 text-sm text-gray-400">
              <span>Total en USD:</span>
              <span className="w-32 text-right">
                ${((invoice.totalVes + invoice.ivaVes) / (invoice.exchangeRate || 1)).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {payments.length > 0 && (
          <div className="border-t mt-4 pt-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Métodos de Pago
            </h3>
            <div className="space-y-1">
              {payments.map(
                (p: { method: string; amount: number; currency: string }, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {p.method === 'cash'
                        ? 'Efectivo'
                        : p.method === 'transfer'
                          ? 'Transferencia'
                          : 'Punto de venta'}
                    </span>
                    <span className="text-gray-800 font-medium">
                      {p.currency === 'USD'
                        ? `$${p.amount.toFixed(2)}`
                        : `Bs.${p.amount.toFixed(2)}`}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        <div className="border-t mt-6 pt-6 flex justify-center gap-4">
          <button
            onClick={() => navigate('/pos')}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium transition-colors"
          >
            Nueva Factura
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Ir al Dashboard
          </button>
        </div>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-2">Anular Factura</h2>
            <p className="text-sm text-gray-500 mb-4">
              Esta acción no se puede deshacer. El stock de los productos será restituido.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Motivo de la anulación *"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              rows={3}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false)
                  setCancelReason('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCancel}
                disabled={!cancelReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
              >
                Anular Factura
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold text-gray-800">Vista previa del ticket</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 text-sm bg-primary text-white rounded-md hover:bg-primary-dark"
                >
                  Imprimir
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="p-4">
              <TicketPreview invoice={invoice} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
