import { useState, useEffect, type FormEvent, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { api } from '../lib/api'

export default function SettingsPage(): JSX.Element {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const isAdmin = hasPermission('settings')
  const [rate, setRate] = useState('')
  const [currentRate, setCurrentRate] = useState<{
    rate: number
    source: string
    date: string
  } | null>(null)
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

  const [posEnabled, setPosEnabled] = useState(false)
  const [posPort, setPosPort] = useState('')
  const [posBaudRate, setPosBaudRate] = useState('9600')
  const [posConnected, setPosConnected] = useState(false)
  const [posConnecting, setPosConnecting] = useState(false)
  const [availablePorts, setAvailablePorts] = useState<
    Array<{ path: string; manufacturer?: string }>
  >([])

  const [syncEnabled, setSyncEnabled] = useState(false)
  const [syncUrl, setSyncUrl] = useState('')
  const [syncApiKey, setSyncApiKey] = useState('')
  const [syncInterval, setSyncInterval] = useState(60)
  const [syncing, setSyncing] = useState(false)
  const [syncLastSync, setSyncLastSync] = useState<string | null>(null)
  const [syncLastResult, setSyncLastResult] = useState<{
    success: boolean
    entitiesSynced: number
    errors: string[]
    duration: number
  } | null>(null)
  const [syncLogs, setSyncLogs] = useState<
    Array<{
      id: string
      entity: string
      action: string
      status: string
      error: string | null
      createdAt: string
    }>
  >([])
  const [showSyncLogs, setShowSyncLogs] = useState(false)
  const [apiUrl, setApiUrl] = useState(
    () => localStorage.getItem('apiBase') || 'http://localhost:3001/api'
  )

  const [company, setCompany] = useState<{
    name: string
    rif: string
    address: string
    phone: string
    email: string
  } | null>(null)
  const [editCompany, setEditCompany] = useState(false)

  const [appVersion, setAppVersion] = useState('dev')

  useEffect(() => {
    window.api
      .getVersionAsync()
      .then((v) => setAppVersion(v))
      .catch(() => {})
  }, [])
  const [dockerStatus, setDockerStatus] = useState<{
    installed: boolean
    running: boolean
    version?: string
  }>({ installed: false, running: false })
  const [dockerLoading, setDockerLoading] = useState(false)
  const [dockerMsg, setDockerMsg] = useState('')
  const [companyForm, setCompanyForm] = useState({
    name: '',
    rif: '',
    address: '',
    phone: '',
    email: ''
  })

  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'checking' | 'available' | 'downloading' | 'downloaded'
  >('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updateProgress, setUpdateProgress] = useState(0)

  const load = async (): Promise<void> => {
    try {
      const [rateRes, settingsRes, companyRes] = await Promise.all([
        api.exchangeRates.getLatest(),
        api.settings.getAll(),
        api.company.get()
      ])
      if (rateRes.rate) setCurrentRate(rateRes.rate)
      const sett = settingsRes.settings
      const m = sett['profitMargin']
      if (m) {
        setSavedMargin(Number(m))
        setMargin(m)
      }
      if (sett['profile']) setProfile(sett['profile'])
      if (sett['printHeader']) setPrintHeader(sett['printHeader'])
      if (sett['printFooter']) setPrintFooter(sett['printFooter'])
      if (sett['paperWidth']) setPaperWidth(sett['paperWidth'])
      if (sett['printerName']) setSelectedPrinter(sett['printerName'])
      if (sett['bcvAutoFetch']) setBcvAutoFetch(sett['bcvAutoFetch'] === 'true')
      if (sett['bcvFetchTimes']) {
        try {
          setBcvFetchTimes(JSON.parse(sett['bcvFetchTimes']))
        } catch {
          setBcvFetchTimes([])
        }
      }
      if (sett['posTerminalEnabled']) setPosEnabled(sett['posTerminalEnabled'] === 'true')
      if (sett['posTerminalPort']) setPosPort(sett['posTerminalPort'])
      if (sett['posTerminalBaudRate']) setPosBaudRate(sett['posTerminalBaudRate'])
      if (companyRes.company) {
        const c = companyRes.company
        setCompany({
          name: c.name,
          rif: c.rif,
          address: c.address || '',
          phone: c.phone || '',
          email: c.email || ''
        })
        setCompanyForm({
          name: c.name,
          rif: c.rif,
          address: c.address || '',
          phone: c.phone || '',
          email: c.email || ''
        })
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        const [rateRes, settingsRes, companyRes] = await Promise.all([
          api.exchangeRates.getLatest(),
          api.settings.getAll(),
          api.company.get()
        ])
        if (rateRes.rate) setCurrentRate(rateRes.rate)
        const sett = settingsRes.settings
        const m = sett['profitMargin']
        if (m) {
          setSavedMargin(Number(m))
          setMargin(m)
        }
        if (sett['profile']) setProfile(sett['profile'])
        if (sett['printHeader']) setPrintHeader(sett['printHeader'])
        if (sett['printFooter']) setPrintFooter(sett['printFooter'])
        if (sett['paperWidth']) setPaperWidth(sett['paperWidth'])
        if (sett['printerName']) setSelectedPrinter(sett['printerName'])
        if (sett['bcvAutoFetch']) setBcvAutoFetch(sett['bcvAutoFetch'] === 'true')
        if (sett['bcvFetchTimes']) {
          try {
            setBcvFetchTimes(JSON.parse(sett['bcvFetchTimes']))
          } catch {
            setBcvFetchTimes([])
          }
        }
        if (sett['posTerminalEnabled']) setPosEnabled(sett['posTerminalEnabled'] === 'true')
        if (sett['posTerminalPort']) setPosPort(sett['posTerminalPort'])
        if (sett['posTerminalBaudRate']) setPosBaudRate(sett['posTerminalBaudRate'])
        if (companyRes.company) {
          const c = companyRes.company
          setCompany({
            name: c.name,
            rif: c.rif,
            address: c.address || '',
            phone: c.phone || '',
            email: c.email || ''
          })
          setCompanyForm({
            name: c.name,
            rif: c.rif,
            address: c.address || '',
            phone: c.phone || '',
            email: c.email || ''
          })
        }
      } catch {
        /* ignore */
      }
    }
    init()
  }, [])

  useEffect(() => {
    api.print
      .listPrinters()
      .then((r) => setPrinters(r.printers))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const cleanups = [
      window.api.onUpdateAvailable((version) => {
        setUpdateStatus('available')
        setUpdateVersion(version)
      }),
      window.api.onUpdateNotAvailable(() => {
        setUpdateStatus('idle')
      }),
      window.api.onUpdateProgress((percent) => {
        setUpdateStatus('downloading')
        setUpdateProgress(percent)
      }),
      window.api.onUpdateDownloaded(() => {
        setUpdateStatus('downloaded')
      })
    ]
    return () => {
      cleanups.forEach((fn) => fn())
    }
  }, [])

  useEffect(() => {
    Promise.all([
      api.puntoVenta.status().catch(() => null),
      api.puntoVenta.ports().catch(() => null)
    ]).then(([status, ports]) => {
      if (status) {
        setPosConnected(status.connected)
        setPosConnecting(status.connecting)
      }
      if (ports) setAvailablePorts(ports.ports)
    })

    api.sync
      .status()
      .then((st) => {
        setSyncEnabled(st.config.enabled)
        setSyncUrl(st.config.url)
        setSyncInterval(st.config.interval)
        setSyncLastSync(st.config.lastSyncAt)
        setSyncLastResult(st.lastResult)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    window.api.docker
      .status()
      .then((st) => setDockerStatus(st))
      .catch(() => {})
  }, [])

  const handleDockerRestart = async (): Promise<void> => {
    setDockerLoading(true)
    setDockerMsg('')
    try {
      const result = await window.api.docker.restart()
      if (result.success) {
        setDockerMsg('Servidor reiniciado correctamente')
        const st = await window.api.docker.status()
        setDockerStatus(st)
      } else {
        setDockerMsg(`Error: ${result.error || 'No se pudo reiniciar'}`)
      }
    } catch (err) {
      setDockerMsg(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    } finally {
      setDockerLoading(false)
    }
  }

  const handleDockerRebuild = async (): Promise<void> => {
    setDockerLoading(true)
    setDockerMsg('Reconstruyendo imagen del servidor...')
    try {
      const result = await window.api.docker.rebuild()
      if (result.success) {
        setDockerMsg('Servidor reconstruido y reiniciado')
        const st = await window.api.docker.status()
        setDockerStatus(st)
      } else {
        setDockerMsg(`Error: ${result.error || 'No se pudo reconstruir'}`)
      }
    } catch (err) {
      setDockerMsg(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    } finally {
      setDockerLoading(false)
    }
  }

  const showError = (msg: string): void => {
    setError(msg)
    setSuccess('')
  }
  const showSuccess = (msg: string): void => {
    setSuccess(msg)
    setError('')
  }

  const handleRateSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    showError('')
    if (!rate || parseFloat(rate) <= 0) {
      showError('Ingrese una tasa válida')
      return
    }
    setSaving(true)
    try {
      await api.exchangeRates.create(parseFloat(rate))
      setRate('')
      await load()
      showSuccess('Tasa guardada')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleBcvFetch = async (): Promise<void> => {
    setBcvLoading(true)
    showError('')
    try {
      const res = await api.exchangeRates.fetchBcv()
      setCurrentRate(res.rate)
      showSuccess(`Tasa BCV obtenida: Bs. ${res.rate.rate.toFixed(2)}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al obtener tasa BCV')
    } finally {
      setBcvLoading(false)
    }
  }

  const handleMarginSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    showError('')
    const m = parseFloat(margin)
    if (isNaN(m) || m < 0) {
      showError('Ingrese un porcentaje válido')
      return
    }
    setSaving(true)
    try {
      await api.settings.set('profitMargin', String(m))
      setSavedMargin(m)
      showSuccess('Margen guardado')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handlePrinterSubmit = async (e: FormEvent): Promise<void> => {
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
    } finally {
      setSaving(false)
    }
  }

  const handlePrinterChange = async (name: string): Promise<void> => {
    setSelectedPrinter(name)
    try {
      await api.settings.set('printerName', name)
      showSuccess('Impresora seleccionada')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  const handleTestPrint = async (): Promise<void> => {
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
    } finally {
      setTestPrinting(false)
    }
  }

  const handleBcvAutoFetchToggle = async (): Promise<void> => {
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

  const handleAddBcvTime = async (): Promise<void> => {
    if (bcvFetchTimes.includes(newBcvTime)) {
      showError('Esa hora ya está agregada')
      return
    }
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

  const handleRemoveBcvTime = async (time: string): Promise<void> => {
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

  const handleProfileChange = async (value: string): Promise<void> => {
    setProfile(value)
    try {
      await api.settings.set('profile', value)
      showSuccess(`Perfil cambiado a ${value}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  const handleCompanySubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    showError('')
    if (!companyForm.name || !companyForm.rif) {
      showError('Nombre y RIF requeridos')
      return
    }
    setSaving(true)
    try {
      await api.company.update(companyForm)
      setEditCompany(false)
      await load()
      showSuccess('Datos de empresa actualizados')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 text-lg">
          ←
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Configuración</h1>
      </div>

      {error && <p className="text-red-600 text-sm mb-4 bg-red-50 rounded p-3">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-4 bg-green-50 rounded p-3">{success}</p>}

      <div className="space-y-6">
        {/* Actualizaciones */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Actualizaciones</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Versión actual: <span className="font-mono">v{appVersion || 'dev'}</span>
              </p>
              {updateStatus === 'available' && (
                <p className="text-sm text-blue-600 mt-1">
                  Nueva versión disponible: v{updateVersion}
                </p>
              )}
              {updateStatus === 'downloading' && (
                <p className="text-sm text-blue-600 mt-1">
                  Descargando... {Math.round(updateProgress)}%
                </p>
              )}
              {updateStatus === 'downloaded' && (
                <p className="text-sm text-green-600 mt-1">Actualización lista para instalar</p>
              )}
            </div>
            <div className="flex gap-2">
              {updateStatus === 'idle' && (
                <button
                  onClick={() => {
                    setUpdateStatus('checking')
                    window.api.checkForUpdates()
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
                >
                  Buscar actualizaciones
                </button>
              )}
              {updateStatus === 'available' && (
                <button
                  onClick={() => window.api.downloadUpdate()}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark text-sm"
                >
                  Descargar
                </button>
              )}
              {updateStatus === 'downloading' && (
                <div className="w-32 bg-gray-200 rounded-full h-2 self-center">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${updateProgress}%` }}
                  />
                </div>
              )}
              {updateStatus === 'downloaded' && (
                <button
                  onClick={() => window.api.installUpdate()}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                >
                  Instalar y reiniciar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sistema y Docker */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Sistema</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Versión del cliente</span>
              <span className="text-sm font-mono font-medium">{appVersion || 'dev'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Docker</span>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                    dockerStatus.installed && dockerStatus.running
                      ? 'text-green-700'
                      : dockerStatus.installed
                        ? 'text-yellow-600'
                        : 'text-red-600'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      dockerStatus.installed && dockerStatus.running
                        ? 'bg-green-500'
                        : dockerStatus.installed
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`}
                  />
                  {!dockerStatus.installed
                    ? 'No instalado'
                    : dockerStatus.running
                      ? `Activo${dockerStatus.version ? ` v${dockerStatus.version}` : ''}`
                      : 'Detenido'}
                </span>
              </div>
            </div>
            {dockerStatus.installed && dockerStatus.running && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleDockerRestart}
                  disabled={dockerLoading}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  {dockerLoading ? 'Procesando...' : 'Reiniciar servidor'}
                </button>
                <button
                  onClick={handleDockerRebuild}
                  disabled={dockerLoading}
                  className="px-4 py-2 border border-orange-300 text-orange-700 rounded-md text-sm hover:bg-orange-50 disabled:opacity-50"
                >
                  {dockerLoading ? 'Procesando...' : 'Reconstruir imagen'}
                </button>
              </div>
            )}
            {dockerMsg && (
              <p
                className={`text-sm mt-2 ${
                  dockerMsg.startsWith('Error') ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {dockerMsg}
              </p>
            )}
          </div>
        </div>

        {/* 1.9.1 + 1.9.2 — Tasa de Cambio */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Tasa de Cambio USD/VES</h2>

          {currentRate && (
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-600">Tasa actual</p>
              <p className="text-2xl font-bold text-blue-800">Bs. {currentRate.rate.toFixed(2)}</p>
              <p className="text-xs text-blue-500">
                {currentRate.source === 'bcv' ? 'Fuente: BCV' : 'Fuente: Manual'} —{' '}
                {new Date(currentRate.date).toLocaleDateString()}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nueva tasa de cambio
              </label>
              <div className="flex gap-2">
                <span className="flex items-center text-gray-500">1 USD = Bs.</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar Tasa'}
              </button>
              <button
                type="button"
                onClick={handleBcvFetch}
                disabled={bcvLoading}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm"
              >
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
            Obtén la tasa del BCV automáticamente al iniciar la aplicación y en horarios
            programados.
          </p>

          {bcvAutoFetch && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Horarios programados
              </label>
              <div className="flex flex-wrap gap-2">
                {bcvFetchTimes.map((time) => (
                  <span
                    key={time}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                  >
                    {time}
                    <button
                      onClick={() => handleRemoveBcvTime(time)}
                      className="text-blue-400 hover:text-blue-600 ml-1"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              {bcvFetchTimes.length === 0 && (
                <p className="text-xs text-gray-400">
                  Sin horarios. La tasa se obtendrá solo al iniciar la app.
                </p>
              )}
              <div className="flex gap-2 items-center">
                <input
                  type="time"
                  value={newBcvTime}
                  onChange={(e) => setNewBcvTime(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <button
                  onClick={handleAddBcvTime}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                >
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
            <button
              onClick={() => setEditCompany(!editCompany)}
              className="text-sm text-primary hover:text-primary-dark font-medium"
            >
              {editCompany ? 'Cancelar' : 'Editar'}
            </button>
          </div>

          {company && !editCompany && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-500">Nombre:</span> {company.name}
              </p>
              <p>
                <span className="text-gray-500">RIF:</span> {company.rif}
              </p>
              {company.address && (
                <p>
                  <span className="text-gray-500">Dirección:</span> {company.address}
                </p>
              )}
              {company.phone && (
                <p>
                  <span className="text-gray-500">Teléfono:</span> {company.phone}
                </p>
              )}
              {company.email && (
                <p>
                  <span className="text-gray-500">Email:</span> {company.email}
                </p>
              )}
            </div>
          )}

          {editCompany && (
            <form onSubmit={handleCompanySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RIF *</label>
                <input
                  type="text"
                  value={companyForm.rif}
                  onChange={(e) => setCompanyForm({ ...companyForm, rif: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={companyForm.phone}
                  onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={companyForm.email}
                  onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          )}
        </div>

        {/* 1.9.4 — Perfil del Sistema */}
        {isAdmin && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">Perfil del Sistema</h2>
            <p className="text-sm text-gray-500 mb-4">
              Define el alcance del sistema. Actualmente solo el perfil Small está disponible.
            </p>
            <div className="flex gap-4">
              {[
                { value: 'small', label: 'Small', desc: 'Una máquina' },
                { value: 'medium', label: 'Medium', desc: 'Red local (próximamente)' },
                { value: 'big', label: 'Big', desc: 'Multi-sucursal (próximamente)' }
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => handleProfileChange(p.value)}
                  className={`flex-1 p-4 rounded-lg border-2 text-center transition-colors ${
                    profile === p.value
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-bold text-lg">{p.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 1.9.3 + 1.10 — Impresión Térmica */}
        {isAdmin && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">Configuración de Impresión</h2>
            <p className="text-sm text-gray-500 mb-4">
              Personaliza el formato de impresión para tickets y facturas.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Impresora térmica
                </label>
                <select
                  value={selectedPrinter}
                  onChange={(e) => handlePrinterChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Seleccionar impresora...</option>
                  {printers.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {printers.length === 0 && (
                  <p className="text-xs text-yellow-600 mt-1">
                    No se detectaron impresoras. Asegúrate de tener una conectada.
                  </p>
                )}
              </div>
              <button
                onClick={handleTestPrint}
                disabled={testPrinting || !selectedPrinter}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {testPrinting ? 'Imprimiendo...' : 'Imprimir prueba'}
              </button>
            </div>

            <form onSubmit={handlePrinterSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ancho del papel (mm)
                </label>
                <select
                  value={paperWidth}
                  onChange={(e) => setPaperWidth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="58">58 mm (ticket pequeño)</option>
                  <option value="80">80 mm (ticket estándar)</option>
                  <option value="216">216 mm (carta)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Encabezado personalizado
                </label>
                <textarea
                  value={printHeader}
                  onChange={(e) => setPrintHeader(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                  placeholder="Nombre del negocio&#10;Dirección&#10;Teléfono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pie de página
                </label>
                <textarea
                  value={printFooter}
                  onChange={(e) => setPrintFooter(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                  placeholder="Gracias por su compra&#10;RIF: J-XXXXXXXX-X"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </form>
          </div>
        )}

        {/* Configuración de Terminal POS */}
        {isAdmin && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">Terminal Punto de Venta</h2>
            <p className="text-sm text-gray-500 mb-4">
              Configura la conexión con el terminal POS (pinpad) para procesar pagos con tarjeta de
              débito/crédito de forma automática.
            </p>

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-700">Terminal habilitado</span>
              <button
                onClick={async () => {
                  const newVal = !posEnabled
                  setPosEnabled(newVal)
                  try {
                    await api.puntoVenta.saveSettings({ enabled: newVal })
                    if (!newVal) {
                      setPosConnected(false)
                      await api.puntoVenta.disconnect().catch(() => {})
                    }
                    showSuccess(newVal ? 'Terminal POS habilitado' : 'Terminal POS deshabilitado')
                  } catch (err) {
                    setPosEnabled(!newVal)
                    showError(err instanceof Error ? err.message : 'Error al guardar')
                  }
                }}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  posEnabled ? 'bg-primary' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    posEnabled ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>

            {posEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Puerto de conexión
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={posPort}
                      onChange={(e) => setPosPort(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Seleccionar puerto...</option>
                      {availablePorts.map((p) => (
                        <option key={p.path} value={p.path}>
                          {p.path}
                          {p.manufacturer ? ` (${p.manufacturer})` : ''}
                        </option>
                      ))}
                      {availablePorts.length === 0 && (
                        <option value="/dev/ttyUSB0">/dev/ttyUSB0</option>
                      )}
                      {availablePorts.length === 0 && (
                        <option value="/dev/ttyS0">/dev/ttyS0</option>
                      )}
                      {availablePorts.length === 0 && <option value="COM1">COM1</option>}
                    </select>
                    {availablePorts.length === 0 && (
                      <button
                        onClick={async () => {
                          try {
                            const ports = await api.puntoVenta.ports()
                            setAvailablePorts(ports.ports)
                            showSuccess(`Puertos actualizados (${ports.ports.length} encontrados)`)
                          } catch (err) {
                            showError(err instanceof Error ? err.message : 'Error al escanear')
                          }
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                      >
                        Escanear
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Conecta el terminal POS por USB/serial y selecciona el puerto.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Baud rate</label>
                  <select
                    value={posBaudRate}
                    onChange={(e) => setPosBaudRate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="9600">9600</option>
                    <option value="19200">19200</option>
                    <option value="38400">38400</option>
                    <option value="57600">57600</option>
                    <option value="115200">115200</option>
                  </select>
                </div>

                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        posConnecting
                          ? 'bg-yellow-400 animate-pulse'
                          : posConnected
                            ? 'bg-green-500'
                            : 'bg-gray-400'
                      }`}
                    />
                    <span className="text-sm text-gray-600">
                      {posConnecting
                        ? 'Conectando...'
                        : posConnected
                          ? 'Conectado'
                          : 'Desconectado'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!posPort) {
                          showError('Selecciona un puerto primero')
                          return
                        }
                        setPosConnecting(true)
                        try {
                          await api.puntoVenta.saveSettings({
                            port: posPort,
                            baudRate: parseInt(posBaudRate)
                          })
                          const res = await api.puntoVenta.connect({
                            port: posPort,
                            baudRate: parseInt(posBaudRate)
                          })
                          setPosConnected(res.connected)
                          showSuccess('Conectado al terminal POS')
                        } catch (err) {
                          setPosConnected(false)
                          showError(err instanceof Error ? err.message : 'Error al conectar')
                        } finally {
                          setPosConnecting(false)
                        }
                      }}
                      disabled={posConnecting || !posPort}
                      className="px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary-dark disabled:opacity-50 transition-colors"
                    >
                      {posConnecting ? 'Conectando...' : 'Conectar'}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await api.puntoVenta.disconnect()
                          setPosConnected(false)
                          showSuccess('Desconectado')
                        } catch (err) {
                          showError(err instanceof Error ? err.message : 'Error al desconectar')
                        }
                      }}
                      disabled={!posConnected}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Desconectar
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!posPort) {
                        showError('Selecciona un puerto primero')
                        return
                      }
                      try {
                        await api.puntoVenta.saveSettings({
                          port: posPort,
                          baudRate: parseInt(posBaudRate)
                        })
                        const res = await api.puntoVenta.test()
                        showSuccess(res.message)
                      } catch (err) {
                        showError(err instanceof Error ? err.message : 'Error en prueba')
                      }
                    }}
                    disabled={!posPort}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Probar conexión
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await api.puntoVenta.saveSettings({
                          port: posPort,
                          baudRate: parseInt(posBaudRate)
                        })
                        showSuccess('Configuración guardada')
                      } catch (err) {
                        showError(err instanceof Error ? err.message : 'Error al guardar')
                      }
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors"
                  >
                    Guardar configuración
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sincronización en la Nube */}
        {isAdmin && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">Sincronización en la Nube</h2>
            <p className="text-sm text-gray-500 mb-4">
              Configura la sincronización automática de tus datos con un servidor en la nube para
              respaldo y acceso remoto.
            </p>

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-700">Sync habilitado</span>
              <button
                onClick={async () => {
                  const newVal = !syncEnabled
                  setSyncEnabled(newVal)
                  try {
                    await api.sync.saveConfig({ enabled: newVal })
                    showSuccess(newVal ? 'Sync habilitado' : 'Sync deshabilitado')
                  } catch (err) {
                    setSyncEnabled(!newVal)
                    showError(err instanceof Error ? err.message : 'Error al guardar')
                  }
                }}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  syncEnabled ? 'bg-primary' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    syncEnabled ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>

            {syncEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL del servidor cloud
                  </label>
                  <input
                    type="url"
                    value={syncUrl}
                    onChange={(e) => setSyncUrl(e.target.value)}
                    onBlur={async () => {
                      try {
                        await api.sync.saveConfig({ url: syncUrl })
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="https://tu-servidor.com"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    URL base del servidor cloud (ej: https://api.silverknight.app)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <input
                    type="password"
                    value={syncApiKey}
                    onChange={(e) => setSyncApiKey(e.target.value)}
                    onBlur={async () => {
                      try {
                        await api.sync.saveConfig({ apiKey: syncApiKey })
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="Clave de API del servidor cloud"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Intervalo de sincronización
                  </label>
                  <select
                    value={syncInterval}
                    onChange={async (e) => {
                      const val = parseInt(e.target.value)
                      setSyncInterval(val)
                      try {
                        await api.sync.saveConfig({ interval: val })
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value={5}>Cada 5 minutos</option>
                    <option value={15}>Cada 15 minutos</option>
                    <option value={30}>Cada 30 minutos</option>
                    <option value={60}>Cada 1 hora</option>
                    <option value={360}>Cada 6 horas</option>
                    <option value={1440}>Cada 24 horas</option>
                  </select>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        syncing
                          ? 'bg-yellow-400 animate-pulse'
                          : syncLastResult?.success
                            ? 'bg-green-500'
                            : syncLastResult
                              ? 'bg-red-500'
                              : 'bg-gray-400'
                      }`}
                    />
                    <span className="text-sm text-gray-600">
                      {syncing
                        ? 'Sincronizando...'
                        : syncLastSync
                          ? `Último sync: ${new Date(syncLastSync).toLocaleString()}`
                          : 'Sin sincronizar'}
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      setSyncing(true)
                      try {
                        const res = await api.sync.now()
                        setSyncLastResult(res.result)
                        if (res.result.success) {
                          showSuccess(`${res.result.entitiesSynced} registro(s) sincronizado(s)`)
                        } else {
                          showError(res.result.errors.join('; '))
                        }
                      } catch (err) {
                        showError(err instanceof Error ? err.message : 'Error de sincronización')
                      } finally {
                        setSyncing(false)
                      }
                    }}
                    disabled={syncing}
                    className="px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary-dark disabled:opacity-50 transition-colors"
                  >
                    {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                  </button>
                </div>

                {syncLastResult && (
                  <div
                    className={`rounded-lg p-3 text-sm ${
                      syncLastResult.success
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    <p className="font-medium">
                      {syncLastResult.success
                        ? 'Última sincronización exitosa'
                        : 'Errores en última sincronización'}
                    </p>
                    {syncLastResult.success && (
                      <p>{syncLastResult.entitiesSynced} registro(s) sincronizado(s)</p>
                    )}
                    {syncLastResult.duration > 0 && (
                      <p className="text-xs opacity-75">Duración: {syncLastResult.duration}ms</p>
                    )}
                    {syncLastResult.errors.length > 0 && (
                      <ul className="list-disc pl-4 mt-1 text-xs">
                        {syncLastResult.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div>
                  <button
                    onClick={async () => {
                      setShowSyncLogs(!showSyncLogs)
                      if (!showSyncLogs) {
                        try {
                          const res = await api.sync.logs(20)
                          setSyncLogs(res.logs)
                        } catch {
                          /* ignore */
                        }
                      }
                    }}
                    className="text-sm text-primary hover:text-primary-dark font-medium"
                  >
                    {showSyncLogs ? 'Ocultar historial' : 'Ver historial de sincronización'}
                  </button>

                  {showSyncLogs && (
                    <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                      {syncLogs.length === 0 && (
                        <p className="text-xs text-gray-400 py-2">Sin registros</p>
                      )}
                      {syncLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center gap-2 text-xs p-2 bg-gray-50 rounded"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              log.status === 'synced' ? 'bg-green-500' : 'bg-red-500'
                            }`}
                          />
                          <span className="text-gray-500 shrink-0">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                          <span className="font-medium text-gray-700">{log.entity}</span>
                          <span className="text-gray-400">{log.action}</span>
                          {log.error && <span className="text-red-500 ml-auto">{log.error}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Configuración de conexión API */}
        {isAdmin && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">Conexión al Servidor</h2>
            <p className="text-sm text-gray-500 mb-4">
              URL base de la API del backend. Por defecto es{' '}
              <code>http://localhost:3001/api</code> (perfil Small, backend Docker local). Para
              perfil Medium, usa la IP del servidor en la LAN (ej.{' '}
              <code>http://192.168.1.10:3001/api</code>). Para perfil Big, usa la URL cloud (ej.{' '}
              <code>https://api.miapp.com/api</code>).
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                placeholder="http://localhost:3001/api"
              />
              <button
                onClick={async () => {
                  try {
                    api.setApiBase(apiUrl)
                    showSuccess('URL de API actualizada')
                  } catch (err) {
                    showError(err instanceof Error ? err.message : 'Error al guardar')
                  }
                }}
                className="px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary-dark transition-colors"
              >
                Aplicar
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              El cambio se aplica inmediatamente. Asegúrate de que el servidor sea accesible.
            </p>
          </div>
        )}

        {/* Navegación a secciones existentes */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Control Fiscal</h2>
            <button
              onClick={() => navigate('/settings/fiscal-control')}
              className="text-sm text-primary hover:text-primary-dark font-medium"
            >
              Gestionar talonarios →
            </button>
          </div>
          <p className="text-sm text-gray-500">
            Configura los talonarios de numeración fiscal autorizados por el SENIAT.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Migración de Datos</h2>
            <button
              onClick={() => navigate('/settings/data-migration')}
              className="text-sm text-primary hover:text-primary-dark font-medium"
            >
              Exportar / Importar →
            </button>
          </div>
          <p className="text-sm text-gray-500">
            Exporta respaldos o migra datos entre sistemas Silver Knight.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Libros IVA</h2>
            <button
              onClick={() => navigate('/iva')}
              className="text-sm text-primary hover:text-primary-dark font-medium"
            >
              Ver libros →
            </button>
          </div>
          <p className="text-sm text-gray-500">
            Consulta el Libro de Ventas y Libro de Compras para la declaración del IVA.
          </p>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Porcentaje de ganancia sobre el costo
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={margin}
                  onChange={(e) => setMargin(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="30"
                />
                <span className="flex items-center text-gray-500">%</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar Margen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
