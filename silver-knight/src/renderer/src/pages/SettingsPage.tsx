import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [rate, setRate] = useState('')
  const [currentRate, setCurrentRate] = useState<{ rate: number; source: string; date: string } | null>(null)
  const [margin, setMargin] = useState('')
  const [savedMargin, setSavedMargin] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const [rateRes, settingsRes] = await Promise.all([
        api.exchangeRates.getLatest(),
        api.settings.getAll()
      ])
      if (rateRes.rate) setCurrentRate(rateRes.rate)
      const m = settingsRes.settings['profitMargin']
      if (m) {
        setSavedMargin(Number(m))
        setMargin(m)
      }
    } catch { /* ignore */ }
  }

  useEffect(() => { load() }, [])

  const handleRateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!rate || parseFloat(rate) <= 0) {
      setError('Ingrese una tasa válida')
      return
    }
    setSaving(true)
    try {
      await api.exchangeRates.create(parseFloat(rate))
      setRate('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleMarginSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const m = parseFloat(margin)
    if (isNaN(m) || m < 0) {
      setError('Ingrese un porcentaje válido')
      return
    }
    setSaving(true)
    try {
      await api.settings.set('profitMargin', String(m))
      setSavedMargin(m)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 text-lg">←</button>
        <h1 className="text-2xl font-bold text-gray-800">Configuración</h1>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Tasa de Cambio USD/VES</h2>

          {currentRate && (
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-600">Tasa actual</p>
              <p className="text-2xl font-bold text-blue-800">Bs. {currentRate.rate.toFixed(2)}</p>
              <p className="text-xs text-blue-500">
                {currentRate.source === 'bcv' ? 'Fuente: BCV' : 'Fuente: Manual'} — {new Date(currentRate.date).toLocaleDateString()}
              </p>
            </div>
          )}

          {!currentRate && (
            <div className="bg-yellow-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-700">No hay tasa registrada. Los precios en VES no se calcularán automáticamente.</p>
            </div>
          )}

          <form onSubmit={handleRateSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva tasa de cambio</label>
              <div className="flex gap-2">
                <span className="flex items-center text-gray-500">1 USD = Bs.</span>
                <input type="text" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" placeholder="0.00" />
              </div>
            </div>
            <button type="submit" disabled={saving}
              className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Guardando...' : 'Guardar Tasa'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Margen de Ganancia</h2>

          {savedMargin !== null && (
            <div className="bg-green-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-600">Margen actual</p>
              <p className="text-2xl font-bold text-green-800">{savedMargin}%</p>
            </div>
          )}

          {savedMargin === null && (
            <div className="bg-yellow-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-700">No hay margen configurado. El precio de venta no se calculará automáticamente desde el costo.</p>
            </div>
          )}

          <form onSubmit={handleMarginSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje de ganancia sobre el costo</label>
              <div className="flex gap-2">
                <input type="text" inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" placeholder="30" />
                <span className="flex items-center text-gray-500">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Al ingresar el costo de un producto, el precio de venta se calculará como: costo × (1 + margen/100). Siempre podrás ajustarlo manualmente.</p>
            </div>
            <button type="submit" disabled={saving}
              className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Guardando...' : 'Guardar Margen'}
            </button>
          </form>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
    </div>
  )
}
