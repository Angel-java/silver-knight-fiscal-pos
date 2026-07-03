import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [rate, setRate] = useState('')
  const [currentRate, setCurrentRate] = useState<{ rate: number; source: string; date: string } | null>(null)
  const [margin, setMargin] = useState('')
  const [savedMargin, setSavedMargin] = useState<number | null>(null)
  const [bcvLoading, setBcvLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const [profile, setProfile] = useState('small')
  const [printHeader, setPrintHeader] = useState('')
  const [printFooter, setPrintFooter] = useState('')
  const [paperWidth, setPaperWidth] = useState('80')
  const [printers, setPrinters] = useState<string[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [testPrinting, setTestPrinting] = useState(false)

  const [bcvAutoFetch, setBcvAutoFetch] = useState(false)
  const [bcvFetchTimes, setBcvFetchTimes] = useState<string[]>([])
  const [newBcvTime, setNewBcvTime] = useState('09:00')

  const [company, setCompany] = useState<{
    name: string; rif: string; address: string; phone: string; email: string
  } | null>(null)
  const [editCompany, setEditCompany] = useState(false)
  const [companyForm, setCompanyForm] = useState({ name: '', rif: '', address: '', phone: '', email: '' })

  const load = async () => {
    try {
      const [rateRes, settingsRes, companyRes] = await Promise.all([
        api.exchangeRates.getLatest(),
        api.settings.getAll(),
        api.company.get()
      ])
      if (rateRes.rate) setCurrentRate(rateRes.rate)
      const sett = settingsRes.settings
      const m = sett['profitMargin']
      if (m) { setSavedMargin(Number(m)); setMargin(m) }
      if (sett['profile']) setProfile(sett['profile'])
      if (sett['printHeader']) setPrintHeader(sett['printHeader'])
      if (sett['printFooter']) setPrintFooter(sett['printFooter'])
      if (sett['paperWidth']) setPaperWidth(sett['paperWidth'])
      if (sett['printerName']) setSelectedPrinter(sett['printerName'])
      if (sett['bcvAutoFetch']) setBcvAutoFetch(sett['bcvAutoFetch'] === 'true')
      if (sett['bcvFetchTimes']) {
        try { setBcvFetchTimes(JSON.parse(sett['bcvFetchTimes'])) } catch { setBcvFetchTimes([]) }
      }
      if (companyRes.company) {
        const c = companyRes.company
        setCompany({ name: c.name, rif: c.rif, address: c.address || '', phone: c.phone || '', email: c.email || '' })
        setCompanyForm({ name: c.name, rif: c.rif, address: c.address || '', phone: c.phone || '', email: c.email || '' })
      }
    } catch { /* ignore */ }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    api.print.listPrinters().then((r) => setPrinters(r.printers)).catch(() => {})
  }, [])

  const showError = (msg: string) => { setError(msg); setSuccess('') }
  const showSuccess = (msg: string) => { setSuccess(msg); setError('') }

  const handleRateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    showError('')
    if (!rate || parseFloat(rate) <= 0) { showError('Ingrese una tasa válida'); return }
    setSaving(true)
    try {
      await api.exchangeRates.create(parseFloat(rate))
      setRate('')
      await load()
      showSuccess('Tasa guardada')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handleBcvFetch = async () => {
    setBcvLoading(true)
    showError('')
    try {
      const res = await api.exchangeRates.fetchBcv()
      setCurrentRate(res.rate)
      showSuccess(`Tasa BCV obtenida: Bs. ${res.rate.rate.toFixed(2)}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al obtener tasa BCV')
    } finally { setBcvLoading(false) }
  }

  const handleMarginSubmit = async (e: FormEvent) => {
    e.preventDefault()
    showError('')
    const m = parseFloat(margin)
    if (isNaN(m) || m < 0) { showError('Ingrese un porcentaje válido'); return }
    setSaving(true)
    try {
      await api.settings.set('profitMargin', String(m))
      setSavedMargin(m)
      showSuccess('Margen guardado')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handlePrinterSubmit = async (e: FormEvent) => {
    e.preventDefault()
    showError('')
    setSaving(true)
    try {
      await Promise.all([
        api.settings.set('printHeader', printHeader),
        api.settings.set('printFooter', printFooter),
        api.settings.set('paperWidth', paperWidth)
      ])
      showSuccess('Configuración de impresión guardada')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handlePrinterChange = async (name: string) => {
    setSelectedPrinter(name)
    try {
      await api.settings.set('printerName', name)
      showSuccess('Impresora seleccionada')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  const handleTestPrint = async () => {
    setTestPrinting(true)
    showError('')
    try {
      const invs = await api.invoices.list({ status: 'active' })
      if (invs.invoices.length === 0) {
        showError('No hay facturas activas para imprimir. Crea una desde el POS.')
        return
      }
      await api.print.invoice(invs.invoices[0].id)
      showSuccess('Impresión de prueba enviada')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al imprimir')
    } finally { setTestPrinting(false) }
  }

  const handleBcvAutoFetchToggle = async () => {
    const newVal = !bcvAutoFetch
    setBcvAutoFetch(newVal)
    try {
      await api.settings.set('bcvAutoFetch', String(newVal))
      showSuccess(newVal ? 'Auto-actualización activada' : 'Auto-actualización desactivada')
    } catch (err) {
      setBcvAutoFetch(!newVal)
      showError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  const handleAddBcvTime = async () => {
    if (bcvFetchTimes.includes(newBcvTime)) { showError('Esa hora ya está agregada'); return }
    const updated = [...bcvFetchTimes, newBcvTime].sort()
    setBcvFetchTimes(updated)
    try {
      await api.settings.set('bcvFetchTimes', JSON.stringify(updated))
      showSuccess(`Hora ${newBcvTime} agregada`)
    } catch (err) {
      setBcvFetchTimes(bcvFetchTimes)
      showError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  const handleRemoveBcvTime = async (time: string) => {
    const updated = bcvFetchTimes.filter((t) => t !== time)
    setBcvFetchTimes(updated)
    try {
      await api.settings.set('bcvFetchTimes', JSON.stringify(updated))
      showSuccess(`Hora ${time} eliminada`)
    } catch (err) {
      setBcvFetchTimes(bcvFetchTimes)
      showError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  const handleProfileChange = async (value: string) => {
    setProfile(value)
    try {
      await api.settings.set('profile', value)
      showSuccess(`Perfil cambiado a ${value}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  const handleCompanySubmit = async (e: FormEvent) => {
    e.preventDefault()
    showError('')
    if (!companyForm.name || !companyForm.rif) { showError('Nombre y RIF requeridos'); return }
    setSaving(true)
    try {
      await api.company.update(companyForm)
      setEditCompany(false)
      await load()
      showSuccess('Datos de empresa actualizados')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al actualizar')
    } finally { setSaving(false) }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 text-lg">←</button>
        <h1 className="text-2xl font-bold text-gray-800">Configuración</h1>
      </div>

      {error && <p className="text-red-600 text-sm mb-4 bg-red-50 rounded p-3">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-4 bg-green-50 rounded p-3">{success}</p>}

      <div className="space-y-6">
        {/* 1.9.1 + 1.9.2 — Tasa de Cambio */}
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
              <p className="text-sm text-yellow-700">No hay tasa registrada.</p>
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
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors">
                {saving ? 'Guardando...' : 'Guardar Tasa'}
              </button>
              <button type="button" onClick={handleBcvFetch} disabled={bcvLoading}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm">
                {bcvLoading ? 'Consultando...' : 'Obtener del BCV'}
              </button>
            </div>
          </form>
        </div>

        {/* Auto-actualización BCV */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Auto-actualización BCV</h2>
            <button
              onClick={handleBcvAutoFetchToggle}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                bcvAutoFetch ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  bcvAutoFetch ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Obtén la tasa del BCV automáticamente al iniciar la aplicación y en horarios programados.
          </p>

          {bcvAutoFetch && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Horarios programados</label>
              <div className="flex flex-wrap gap-2">
                {bcvFetchTimes.map((time) => (
                  <span key={time}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                    {time}
                    <button onClick={() => handleRemoveBcvTime(time)}
                      className="text-blue-400 hover:text-blue-600 ml-1">&times;</button>
                  </span>
                ))}
              </div>
              {bcvFetchTimes.length === 0 && (
                <p className="text-xs text-gray-400">Sin horarios. La tasa se obtendrá solo al iniciar la app.</p>
              )}
              <div className="flex gap-2 items-center">
                <input type="time" value={newBcvTime}
                  onChange={(e) => setNewBcvTime(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm" />
                <button onClick={handleAddBcvTime}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
                  + Agregar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 1.9.5 — Datos de la Empresa */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Datos de la Empresa</h2>
            <button onClick={() => setEditCompany(!editCompany)}
              className="text-sm text-primary hover:text-primary-dark font-medium">
              {editCompany ? 'Cancelar' : 'Editar'}
            </button>
          </div>

          {company && !editCompany && (
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">Nombre:</span> {company.name}</p>
              <p><span className="text-gray-500">RIF:</span> {company.rif}</p>
              {company.address && <p><span className="text-gray-500">Dirección:</span> {company.address}</p>}
              {company.phone && <p><span className="text-gray-500">Teléfono:</span> {company.phone}</p>}
              {company.email && <p><span className="text-gray-500">Email:</span> {company.email}</p>}
            </div>
          )}

          {editCompany && (
            <form onSubmit={handleCompanySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RIF *</label>
                <input type="text" value={companyForm.rif}
                  onChange={(e) => setCompanyForm({ ...companyForm, rif: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input type="text" value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input type="text" value={companyForm.phone}
                  onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={companyForm.email}
                  onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <button type="submit" disabled={saving}
                className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors">
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          )}
        </div>

        {/* 1.9.4 — Perfil del Sistema */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Perfil del Sistema</h2>
          <p className="text-sm text-gray-500 mb-4">Define el alcance del sistema. Actualmente solo el perfil Small está disponible.</p>
          <div className="flex gap-4">
            {[
              { value: 'small', label: 'Small', desc: 'Una máquina' },
              { value: 'medium', label: 'Medium', desc: 'Red local (próximamente)' },
              { value: 'big', label: 'Big', desc: 'Multi-sucursal (próximamente)' }
            ].map((p) => (
              <button key={p.value} onClick={() => handleProfileChange(p.value)}
                className={`flex-1 p-4 rounded-lg border-2 text-center transition-colors ${
                  profile === p.value ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <p className="font-bold text-lg">{p.label}</p>
                <p className="text-xs text-gray-500 mt-1">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 1.9.3 + 1.10 — Impresión Térmica */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Configuración de Impresión</h2>
          <p className="text-sm text-gray-500 mb-4">Personaliza el formato de impresión para tickets y facturas.</p>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Impresora térmica</label>
              <select value={selectedPrinter} onChange={(e) => handlePrinterChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                <option value="">Seleccionar impresora...</option>
                {printers.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {printers.length === 0 && (
                <p className="text-xs text-yellow-600 mt-1">No se detectaron impresoras. Asegúrate de tener una conectada.</p>
              )}
            </div>
            <button onClick={handleTestPrint} disabled={testPrinting || !selectedPrinter}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors">
              {testPrinting ? 'Imprimiendo...' : 'Imprimir prueba'}
            </button>
          </div>

          <form onSubmit={handlePrinterSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ancho del papel (mm)</label>
              <select value={paperWidth} onChange={(e) => setPaperWidth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                <option value="58">58 mm (ticket pequeño)</option>
                <option value="80">80 mm (ticket estándar)</option>
                <option value="216">216 mm (carta)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Encabezado personalizado</label>
              <textarea value={printHeader} onChange={(e) => setPrintHeader(e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                placeholder="Nombre del negocio&#10;Dirección&#10;Teléfono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pie de página</label>
              <textarea value={printFooter} onChange={(e) => setPrintFooter(e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                placeholder="Gracias por su compra&#10;RIF: J-XXXXXXXX-X" />
            </div>
            <button type="submit" disabled={saving}
              className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </form>
        </div>

        {/* Navegación a secciones existentes */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Control Fiscal</h2>
            <button onClick={() => navigate('/settings/fiscal-control')}
              className="text-sm text-primary hover:text-primary-dark font-medium">
              Gestionar talonarios →
            </button>
          </div>
          <p className="text-sm text-gray-500">Configura los talonarios de numeración fiscal autorizados por el SENIAT.</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Libros IVA</h2>
            <button onClick={() => navigate('/iva')}
              className="text-sm text-primary hover:text-primary-dark font-medium">
              Ver libros →
            </button>
          </div>
          <p className="text-sm text-gray-500">Consulta el Libro de Ventas y Libro de Compras para la declaración del IVA.</p>
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
              <p className="text-sm text-yellow-700">No hay margen configurado.</p>
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
            </div>
            <button type="submit" disabled={saving}
              className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {saving ? 'Guardando...' : 'Guardar Margen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
