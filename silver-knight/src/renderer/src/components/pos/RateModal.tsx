import { useState, type JSX } from 'react'
import { api } from '../../lib/api'

interface RateModalProps {
  open: boolean
  reason: 'missing' | 'expired' | null
  initialRate?: number
  onClose: () => void
  onSave: (rate: number) => void
}

export default function RateModal({
  open,
  reason,
  initialRate = 0,
  onClose,
  onSave
}: RateModalProps): JSX.Element | null {
  const [rate, setRate] = useState(initialRate > 0 ? String(initialRate) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const title =
    reason === 'expired'
      ? 'La tasa de cambio ya no está en vigencia'
      : 'Se requiere una tasa de cambio'

  const description =
    reason === 'expired'
      ? 'La tasa de cambio registrada venció. Ingresa la nueva tasa vigente para poder emitir la factura en bolívares.'
      : 'No hay una tasa de cambio registrada. Ingresa la tasa vigente (Bs. por USD) para poder emitir la factura en bolívares.'

  const handleSave = async (): Promise<void> => {
    const parsed = parseFloat(rate)
    if (isNaN(parsed) || parsed <= 0) {
      setError('Ingresa un valor válido mayor que cero')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.exchangeRates.create(parsed, 'manual')
      onSave(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la tasa')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-2">{title}</h2>
        <p className="text-sm text-gray-600 mb-4">{description}</p>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tasa (Bs. por USD)
        </label>
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSave()
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md mb-1"
          placeholder="0.00"
        />
        <p className="text-xs text-gray-500 mb-4">
          Esta operación se guarda localmente y funciona sin conexión a internet.
        </p>

        {error && <p className="text-red-600 text-sm mb-3 bg-red-50 rounded p-2">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors font-bold"
          >
            {saving ? 'Guardando...' : 'Guardar y Continuar'}
          </button>
        </div>
      </div>
    </div>
  )
}
