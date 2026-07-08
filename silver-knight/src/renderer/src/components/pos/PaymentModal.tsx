import { useState, useEffect, type JSX } from 'react'
import { api, type Invoice } from '../../lib/api'

interface PaymentModalProps {
  open: boolean
  onClose: () => void
  totalDisplay: number
  currency: 'USD' | 'VES'
  cart: Array<{
    productId: string
    productName: string
    quantity: number
    unitPriceUsd: number
    unitPriceVes: number
    ivaRate: number
  }>
  exchangeRate: number
  customer: { id: string; name: string; rif?: string | null } | null
  onSubmit: (invoice: Invoice) => void
  onError: (msg: string) => void
}

export default function PaymentModal({
  open,
  onClose,
  totalDisplay,
  currency,
  cart,
  exchangeRate,
  customer,
  onSubmit,
  onError
}: PaymentModalProps): JSX.Element | null {
  const [payments, setPayments] = useState<
    Array<{ method: string; amount: string; currency: string; approvalCode?: string }>
  >([{ method: 'cash', amount: String(Math.round(totalDisplay * 100) / 100), currency }])
  const [submitting, setSubmitting] = useState(false)
  const [posConnected, setPosConnected] = useState(false)
  const [posProcessing, setPosProcessing] = useState(false)
  const [posResult, setPosResult] = useState<{
    methodIndex: number
    approvalCode?: string
    cardNumber?: string
    message?: string
  } | null>(null)

  useEffect(() => {
    if (open) {
      setPayments([
        { method: 'cash', amount: String(Math.round(totalDisplay * 100) / 100), currency }
      ])
      setPosResult(null)
      api.puntoVenta
        .status()
        .then((r) => setPosConnected(r.connected))
        .catch(() => setPosConnected(false))
    }
  }, [open])

  const totalPaid = Math.round(payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) * 100) / 100
  const roundedDisplay = Math.round(totalDisplay * 100) / 100
  const change = Math.round((totalPaid - roundedDisplay) * 100) / 100

  const addPayment = (): void => {
    setPayments((prev) => [...prev, { method: 'transfer', amount: '', currency }])
  }

  const updatePayment = (i: number, field: string, value: string): void => {
    setPayments((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)))
  }

  const removePayment = (i: number): void => {
    setPayments((prev) => prev.filter((_, idx) => idx !== i))
  }

  const handleTerminalPay = async (methodIndex: number): Promise<void> => {
    const payment = payments[methodIndex]
    const amount = parseFloat(payment.amount)
    if (isNaN(amount) || amount <= 0) {
      setPosResult({ methodIndex, message: 'Ingresa un monto válido' })
      return
    }
    setPosProcessing(true)
    setPosResult(null)
    try {
      const res = await api.puntoVenta.pay(amount, payment.currency)
      if (res.result.success) {
        setPayments((prev) =>
          prev.map((p, idx) =>
            idx === methodIndex ? { ...p, approvalCode: res.result.approvalCode || '' } : p
          )
        )
        setPosResult({
          methodIndex,
          approvalCode: res.result.approvalCode,
          cardNumber: res.result.cardNumber,
          message: res.result.message || 'Aprobado'
        })
      } else {
        setPosResult({
          methodIndex,
          message: res.result.error || 'Transacción rechazada'
        })
      }
    } catch (err) {
      setPosResult({
        methodIndex,
        message: err instanceof Error ? err.message : 'Error de conexión con el terminal'
      })
    } finally {
      setPosProcessing(false)
    }
  }

  const handleSubmit = async (): Promise<void> => {
    if (cart.length === 0 || totalPaid < roundedDisplay) return
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
          currency: p.currency,
          approvalCode: p.approvalCode
        }))
      })
      onSubmit(res.invoice)
      onClose()
      setPosResult(null)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error al crear factura')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">Cobrar</h2>

        <div className="bg-gray-50 rounded-lg p-4 mb-4 text-center">
          <p className="text-sm text-gray-500">Total a cobrar</p>
          <p className="text-3xl font-bold text-gray-800">
            {currency === 'USD' ? `$${totalDisplay.toFixed(2)}` : `Bs.${totalDisplay.toFixed(2)}`}
          </p>
        </div>

        <div className="space-y-3 mb-4">
          {payments.map((p, i) => (
            <div key={i} className="space-y-2">
              <div className="flex gap-2 items-center">
                <select
                  value={p.method}
                  onChange={(e) => updatePayment(i, 'method', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Punto de venta</option>
                </select>
                <span className="text-sm text-gray-500">{p.currency === 'USD' ? '$' : 'Bs.'}</span>
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
              {p.method === 'card' && (
                <div className="flex gap-2 items-center ml-1">
                  {posConnected ? (
                    <button
                      onClick={() => handleTerminalPay(i)}
                      disabled={posProcessing}
                      className="px-3 py-1.5 bg-primary text-white rounded-md text-xs hover:bg-primary-dark disabled:opacity-50 transition-colors"
                    >
                      {posProcessing ? 'Procesando...' : 'Pagar con terminal'}
                    </button>
                  ) : (
                    <span className="text-xs text-yellow-600">
                      Terminal no conectado — ingresa el código de aprobación manualmente
                    </span>
                  )}
                  {p.approvalCode && (
                    <span className="text-xs text-green-600 font-medium">
                      Código: {p.approvalCode}
                    </span>
                  )}
                  {!posConnected && !p.approvalCode && (
                    <input
                      type="text"
                      value={p.approvalCode || ''}
                      onChange={(e) =>
                        setPayments((prev) =>
                          prev.map((pm, idx) =>
                            idx === i ? { ...pm, approvalCode: e.target.value } : pm
                          )
                        )
                      }
                      className="flex-1 max-w-[140px] px-2 py-1 border border-gray-300 rounded-md text-xs"
                      placeholder="Código aprobación"
                    />
                  )}
                </div>
              )}
              {posResult && posResult.methodIndex === i && (
                <div
                  className={`text-xs ml-1 ${
                    posResult.approvalCode ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {posResult.message}
                  {posResult.cardNumber && ` — Tarjeta: ${posResult.cardNumber}`}
                </div>
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
              <p className="text-red-500 text-xs">Faltan {(totalDisplay - totalPaid).toFixed(2)}</p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || totalPaid < roundedDisplay}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors font-bold"
          >
            {submitting
              ? 'Procesando...'
              : `Cobrar ${currency === 'USD' ? `$${totalDisplay.toFixed(2)}` : `Bs.${totalDisplay.toFixed(2)}`}`}
          </button>
        </div>
      </div>
    </div>
  )
}
