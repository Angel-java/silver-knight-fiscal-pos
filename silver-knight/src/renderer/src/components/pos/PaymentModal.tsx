import { useState, useEffect, type JSX } from 'react'
import { api, type Invoice, type ActiveExchangeRateResponse } from '../../lib/api'

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
    ivaRate: number
  }>
  exchangeRate: number
  customer: { id: string; name: string; rif?: string | null } | null
  onSubmit: (invoice: Invoice) => void
  onError: (msg: string) => void
}

const fmtDay = (iso?: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' })
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
  const [payCurrency, setPayCurrency] = useState<'USD' | 'VES'>(currency)
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

  // Panel de tasa activa (regla de fecha: vigente hasta el fin del día de la tasa)
  const [rateInfo, setRateInfo] = useState<ActiveExchangeRateResponse | null>(null)
  const [rateLoading, setRateLoading] = useState(false)
  const [rateBusy, setRateBusy] = useState(false)
  const [manualRate, setManualRate] = useState('')
  const [manualEffectiveDate, setManualEffectiveDate] = useState(() => {
    const d = new Date()
    return d.toLocaleDateString('en-CA') // YYYY-MM-DD (zona local)
  })
  const [showManual, setShowManual] = useState(false)
  const [confirmOldRate, setConfirmOldRate] = useState(false)
  const [rateMsg, setRateMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  const refreshActiveRate = async (): Promise<void> => {
    setRateLoading(true)
    try {
      const r = await api.exchangeRates.active()
      setRateInfo(r)
      setRateMsg(null)
    } catch {
      setRateInfo(null)
    } finally {
      setRateLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setPayCurrency(currency)
      setPayments([
        { method: 'cash', amount: String(Math.round(totalDisplay * 100) / 100), currency }
      ])
      setPosResult(null)
      setShowManual(false)
      setManualRate('')
      setConfirmOldRate(false)
      setRateMsg(null)
      void refreshActiveRate()
      api.puntoVenta
        .status()
        .then((r) => setPosConnected(r.connected))
        .catch(() => setPosConnected(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const rate = (rateInfo?.rate?.rate ?? exchangeRate) || 0
  const rateBlocked = !rateInfo?.rate && !rateLoading

  const handleBcvUpdate = async (): Promise<void> => {
    setRateBusy(true)
    setRateMsg(null)
    try {
      await api.exchangeRates.fetchBcv()
      await refreshActiveRate()
      setRateMsg({ text: 'Tasa actualizada desde el BCV.', kind: 'ok' })
    } catch (err) {
      setRateMsg({
        text: err instanceof Error ? err.message : 'No se pudo obtener la tasa del BCV.',
        kind: 'err'
      })
    } finally {
      setRateBusy(false)
    }
  }

  const handleManualSave = async (): Promise<void> => {
    const v = parseFloat(manualRate)
    if (isNaN(v) || v <= 0) {
      setRateMsg({ text: 'Ingresa una tasa válida', kind: 'err' })
      return
    }
    setRateBusy(true)
    setRateMsg(null)
    try {
      await api.exchangeRates.create(v, 'manual', manualEffectiveDate || undefined)
      setManualRate('')
      setShowManual(false)
      setConfirmOldRate(false)
      await refreshActiveRate()
      setRateMsg({ text: `Tasa registrada: Bs. ${v.toFixed(2)}.`, kind: 'ok' })
    } catch (err) {
      setRateMsg({
        text: err instanceof Error ? err.message : 'Error al guardar la tasa',
        kind: 'err'
      })
    } finally {
      setRateBusy(false)
    }
  }

  const displayTotal = payCurrency === 'USD' ? totalDisplay : totalDisplay * rate
  const totalPaid = Math.round(payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) * 100) / 100
  const roundedDisplay = Math.round(displayTotal * 100) / 100
  const change = Math.round((totalPaid - roundedDisplay) * 100) / 100

  const addPayment = (): void => {
    setPayments((prev) => [...prev, { method: 'transfer', amount: '', currency: payCurrency }])
  }

  const changeCurrency = (next: 'USD' | 'VES'): void => {
    setPayCurrency(next)
    setPayments((prev) => prev.map((p) => ({ ...p, currency: next })))
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
    if (cart.length === 0 || rateBlocked || totalPaid < roundedDisplay) return
    if (rateInfo?.old && !confirmOldRate) return
    setSubmitting(true)
    try {
      // Se envía la tasa confirmada en el panel: la que el operador vio y aprobó.
      const res = await api.invoices.create({
        customerId: customer?.id || null,
        currency: payCurrency,
        exchangeRate: rate,
        items: cart.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unitPriceUsd: i.unitPriceUsd,
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
            {payCurrency === 'USD'
              ? `$${displayTotal.toFixed(2)}`
              : `Bs.${displayTotal.toFixed(2)}`}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {payCurrency === 'USD'
              ? `Bs. ${(displayTotal * rate).toFixed(2)}`
              : `$ ${(displayTotal / (rate || 1)).toFixed(2)}`}
          </p>
        </div>

        {/* Panel de tasa activa — solicita al usuario cuando falta */}
        <div
          className={`rounded-lg p-3 mb-4 text-sm border ${
            rateBlocked
              ? 'bg-red-50 border-red-200'
              : rateInfo?.old
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-green-50 border-green-200'
          }`}
        >
          {rateLoading ? (
            <p className="text-gray-500">Consultando tasa activa...</p>
          ) : rateBlocked ? (
            <>
              <p className="font-semibold text-red-700">No hay una tasa de cambio activa.</p>
              <p className="text-red-600 text-xs mt-1">
                Para cobrar debes registrar una tasa: consúltala al BCV o ingrésala
                manualmente (funciona sin internet).
              </p>
            </>
          ) : rateInfo?.rate ? (
            <>
              <div className="flex items-center justify-between">
                <p className="font-semibold">Tasa: Bs. {rateInfo.rate.rate.toFixed(2)} USD</p>
                <span className="text-xs text-gray-500">
                  Capturada {fmtDay(rateInfo.rate.date)}
                </span>
              </div>
              {rateInfo.old ? (
                <>
                  <p className="text-xs mt-1 opacity-80">
                    Corresponde al{' '}
                    <span className="font-medium">
                      {fmtDay(rateInfo.rate.effectiveDate ?? rateInfo.rate.date)}
                    </span>{' '}
                    y ya venció su día.
                  </p>
                  <p className="text-xs mt-1 font-medium text-yellow-700">
                    Actualízala con <span className="font-semibold">Consultar BCV</span> o{' '}
                    <span className="font-semibold">Ingresar manual</span>, o confirma para
                    cobrar con ella.
                  </p>
                  <label className="flex items-center gap-2 mt-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={confirmOldRate}
                      onChange={(e) => setConfirmOldRate(e.target.checked)}
                      className="w-4 h-4"
                    />
                    Cobrar con esta tasa de todos modos
                  </label>
                </>
              ) : (
                <p className="text-xs mt-1 opacity-80">
                  Válida hasta{' '}
                  <span className="font-medium">{fmtDay(rateInfo.rate.validUntil)}</span> (fin
                  del día de su fecha)
                </p>
              )}
            </>
          ) : (
            <p className="text-gray-500">No se pudo consultar la tasa activa.</p>
          )}

          {!rateLoading && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => void handleBcvUpdate()}
                disabled={rateBusy}
                className="px-3 py-1.5 bg-primary text-white rounded-md text-xs hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                {rateBusy ? 'Consultando...' : 'Consultar BCV'}
              </button>
              <button
                onClick={() => {
                  setShowManual((v) => !v)
                  setRateMsg(null)
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-xs hover:bg-gray-50"
              >
                {showManual ? 'Ocultar' : 'Ingresar manual'}
              </button>
            </div>
          )}

          {showManual && !rateLoading && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2 items-center">
                <span className="text-xs text-gray-600">1 USD = Bs.</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={manualRate}
                  onChange={(e) => setManualRate(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm"
                />
                <button
                  onClick={() => void handleManualSave()}
                  disabled={rateBusy}
                  className="px-3 py-1.5 bg-primary text-white rounded-md text-xs hover:bg-primary-dark disabled:opacity-50 transition-colors"
                >
                  Guardar
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <label className="text-xs text-gray-600 whitespace-nowrap">Fecha de la tasa</label>
                <input
                  type="date"
                  value={manualEffectiveDate}
                  onChange={(e) => setManualEffectiveDate(e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <p className="text-xs text-gray-400">
                La tasa se considera válida hasta que se acabe el día de esta fecha.
              </p>
            </div>
          )}

          {rateMsg && !rateLoading && (
            <p className={`text-xs mt-2 ${rateMsg.kind === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
              {rateMsg.text}
            </p>
          )}
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
          <button
            onClick={() => changeCurrency('USD')}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
              payCurrency === 'USD'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            USD
          </button>
          <button
            onClick={() => changeCurrency('VES')}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
              payCurrency === 'VES'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Bs.
          </button>
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
                {payCurrency === 'USD'
                  ? `$${totalPaid.toFixed(2)}`
                  : `Bs.${totalPaid.toFixed(2)}`}
              </span>
            </div>
            {change >= 0 && (
              <div className="flex justify-between text-green-600 font-bold">
                <span>Vuelto</span>
                <span>
                  {payCurrency === 'USD'
                    ? `$${change.toFixed(2)}`
                    : `Bs.${change.toFixed(2)}`}
                </span>
              </div>
            )}
            {change < 0 && (
              <p className="text-red-500 text-xs">
                Faltan {(displayTotal - totalPaid).toFixed(2)}
              </p>
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
            onClick={() => void handleSubmit()}
            disabled={
              submitting || rateBlocked || (rateInfo?.old && !confirmOldRate) || totalPaid < roundedDisplay
            }
            className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors font-bold"
          >
            {submitting
              ? 'Procesando...'
              : rateBlocked
                ? 'Registra una tasa para cobrar'
                : rateInfo?.old && !confirmOldRate
                  ? 'Confirma la tasa vieja para cobrar'
                  : `Cobrar ${payCurrency === 'USD' ? `$${displayTotal.toFixed(2)}` : `Bs.${displayTotal.toFixed(2)}`}`}
          </button>
        </div>
      </div>
    </div>
  )
}