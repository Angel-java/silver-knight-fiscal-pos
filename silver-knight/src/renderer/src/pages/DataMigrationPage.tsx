import { useState, useEffect, type ChangeEvent, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  api,
  type MigrationImportResult,
  type MigrationLogEntry,
  type MigrationPreview,
  type MigrationScopes,
  type MigrationStrategy
} from '../lib/api'
import { useAuth } from '../contexts/useAuth'

const ENTITY_LABELS: Record<string, string> = {
  company: 'Empresa',
  users: 'Usuarios',
  categories: 'Categorías',
  suppliers: 'Proveedores',
  products: 'Productos',
  customers: 'Clientes',
  fiscalControls: 'Talonarios fiscales',
  invoices: 'Facturas',
  inventoryMovements: 'Movimientos de inventario',
  exchangeRates: 'Tasas de cambio',
  settings: 'Configuración',
  'exchange-rates': 'Tasas de cambio'
}

const ENTITY_ORDER = [
  'company',
  'users',
  'categories',
  'suppliers',
  'products',
  'customers',
  'fiscalControls',
  'exchangeRates',
  'invoices',
  'inventoryMovements',
  'settings'
]

const STRATEGY_HINTS: Record<MigrationStrategy, string> = {
  skip: 'Los registros que ya existen se omiten. Los nuevos se agregan.',
  overwrite: 'Los registros existentes se reemplazan por los del archivo.'
}

function Spinner(): JSX.Element {
  return (
    <svg className="animate-spin h-4 w-4 inline-block ml-1" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function StepIndicator({ currentStep, steps }: { currentStep: number; steps: string[] }): JSX.Element {
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((label, i) => {
        const isActive = i === currentStep
        const isDone = i < currentStep
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  isDone
                    ? 'bg-green-500 border-green-500 text-white'
                    : isActive
                      ? 'bg-primary border-primary text-white'
                      : 'bg-gray-100 border-gray-300 text-gray-400'
                }`}
              >
                {isDone ? '✓' : i + 1}
              </div>
              <span
                className={`text-xs mt-1 whitespace-nowrap ${
                  isActive ? 'text-primary font-medium' : isDone ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-1 mt-[-14px] ${
                  isDone ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function DataMigrationPage(): JSX.Element {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isRoot = user?.role === 'root'
  const isRootOrAdmin = isRoot || user?.role === 'admin'

  const [meta, setMeta] = useState<MigrationScopes | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json')
  const [exportScope, setExportScope] = useState('all')
  const [exportEntity, setExportEntity] = useState('categories')
  const [exporting, setExporting] = useState(false)

  const [fileName, setFileName] = useState('')
  const [payload, setPayload] = useState<unknown>(null)
  const [csvEntity, setCsvEntity] = useState('categories')
  const [preview, setPreview] = useState<MigrationPreview | null>(null)
  const [strategy, setStrategy] = useState<MigrationStrategy>('skip')
  const [result, setResult] = useState<MigrationImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  const [logs, setLogs] = useState<MigrationLogEntry[]>([])

  const importStep = !payload ? 0 : !preview ? 1 : !result ? 2 : 3

  useEffect(() => {
    api.migration
      .scopes()
      .then(setMeta)
      .catch(() => setError('Error al cargar opciones de migración'))
  }, [])

  const loadLogs = async (): Promise<void> => {
    try {
      const res = await api.migration.logs()
      setLogs(res.logs)
    } catch {
      // silencioso
    }
  }

  useEffect(() => {
    void loadLogs()
  }, [])

  const showError = (msg: string): void => {
    setError(msg)
    setSuccess('')
  }
  const showSuccess = (msg: string): void => {
    setSuccess(msg)
    setError('')
  }

  const handleExport = async (): Promise<void> => {
    setError('')
    setSuccess('')
    setExporting(true)
    try {
      if (exportFormat === 'json') {
        const saved = await api.migration.exportJson(exportScope)
        if (saved) showSuccess('Respaldo exportado correctamente')
      } else {
        const saved = await api.migration.exportCsv(exportEntity)
        if (saved) showSuccess('CSV exportado correctamente')
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  const handleTemplate = async (): Promise<void> => {
    try {
      await api.migration.template(exportEntity)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al descargar plantilla')
    }
  }

  const handleFile = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    setPayload(null)
    setPreview(null)
    setResult(null)
    setError('')
    setSuccess('')
    if (!file) {
      setFileName('')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      setFileName(file.name)
      if (file.name.toLowerCase().endsWith('.json')) {
        try {
          const parsed = JSON.parse(text)
          setPayload(parsed)
        } catch {
          showError('El archivo JSON no es válido')
          setPayload(null)
        }
      } else {
        setPayload({ format: 'csv', entity: csvEntity, csvText: text })
      }
    }
    reader.onerror = () => showError('No se pudo leer el archivo')
    reader.readAsText(file)
  }

  const handlePreview = async (): Promise<void> => {
    if (!payload) return
    setError('')
    setPreviewing(true)
    setResult(null)
    try {
      const p = await api.migration.preview(payload, strategy)
      setPreview(p)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al analizar el archivo')
      setPreview(null)
    } finally {
      setPreviewing(false)
    }
  }

  const handleImport = async (): Promise<void> => {
    if (!payload) return
    if (strategy === 'overwrite') {
      const confirmed = window.confirm(
        '¿Estás seguro? La estrategia "Sobrescribir" reemplazará registros existentes. Esta acción no se puede deshacer.'
      )
      if (!confirmed) return
    }
    setError('')
    setImporting(true)
    try {
      const res = await api.migration.import(payload, strategy, fileName || undefined)
      setResult(res)
      setPreview(null)
      showSuccess('Importación completada exitosamente')
      await loadLogs()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al importar')
    } finally {
      setImporting(false)
    }
  }

  const orderedSummary = preview
    ? [...preview.summary].sort(
        (a, b) => ENTITY_ORDER.indexOf(a.entity) - ENTITY_ORDER.indexOf(b.entity)
      )
    : []

  const strategyOptions: Array<{ value: MigrationStrategy; label: string }> = meta
    ? (meta.strategies as Array<{ value: MigrationStrategy; label: string }>)
    : [
        { value: 'skip', label: 'Omitir duplicados' },
        { value: 'overwrite', label: 'Sobrescribir existentes' }
      ]

  const entityLabel = (e: string): string => ENTITY_LABELS[e] || e

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/settings')}
          className="text-gray-500 hover:text-gray-700 text-lg"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Migración de Datos</h1>
      </div>

      {!isRootOrAdmin && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          No tienes permiso para usar esta sección. Contacta al propietario del sistema.
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
          <span className="text-red-500 font-bold">✕</span> {error}
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
          <span className="text-green-500 font-bold">✓</span> {success}
        </div>
      )}

      {isRootOrAdmin && (
        <>
          {/* Exportar */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-bold mb-4">Exportar datos</h2>
            <p className="text-sm text-gray-500 mb-4">
              Exporta los datos de este sistema. El formato <strong>JSON</strong> genera un respaldo
              completo para migrar a otro equipo. El formato <strong>CSV</strong> genera un archivo
              editable de una entidad para llevar catálogos entre sistemas.
            </p>

            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={exportFormat === 'json'}
                  onChange={() => setExportFormat('json')}
                />
                JSON (respaldo completo)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={exportFormat === 'csv'}
                  onChange={() => setExportFormat('csv')}
                />
                CSV (una entidad)
              </label>
            </div>

            {exportFormat === 'json' ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Alcance</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {meta?.scopes.map((s) => (
                    <label
                      key={s.value}
                      className={`flex items-center gap-2 text-sm border rounded-md px-3 py-2 cursor-pointer ${
                        exportScope === s.value
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="scope"
                        value={s.value}
                        checked={exportScope === s.value}
                        onChange={() => setExportScope(s.value)}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-4 flex flex-wrap gap-2">
                {meta?.csvEntities.map((e) => (
                  <button
                    key={e}
                    onClick={() => setExportEntity(e)}
                    className={`px-3 py-2 border rounded-md text-sm transition-colors ${
                      exportEntity === e
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {entityLabel(e)}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-3 items-center">
              <button
                onClick={handleExport}
                disabled={exporting || !isRootOrAdmin}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {exporting ? (<><Spinner /> Exportando datos...</>) : 'Exportar'}
              </button>
              {exportFormat === 'csv' && !exporting && (
                <button
                  onClick={handleTemplate}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Plantilla CSV
                </button>
              )}
            </div>
          </div>

          {/* Importar */}
          {isRoot && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-bold mb-2">Importar datos</h2>
              <p className="text-sm text-gray-500 mb-4">
                Importa un respaldo JSON generado por otro sistema Silver Knight o un archivo CSV
                exportado (o con plantilla). Sigue los pasos para completar la importación.
              </p>

              <StepIndicator
                currentStep={importStep}
                steps={['Archivo', 'Vista previa', 'Importar', 'Listo']}
              />

              {/* Step 1: Archivo */}
              <div className={`mb-4 p-4 rounded-lg border-2 transition-colors ${
                importStep === 0 ? 'border-primary bg-primary/5' : importStep > 0 ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${
                    importStep > 0 ? 'bg-green-500 text-white' : importStep === 0 ? 'bg-primary text-white' : 'bg-gray-300 text-white'
                  }`}>
                    {importStep > 0 ? '✓' : '1'}
                  </span>
                  <span className="font-medium text-sm">Seleccionar archivo</span>
                  {fileName && importStep > 0 && (
                    <span className="text-xs text-green-600 ml-auto">{fileName}</span>
                  )}
                </div>
                <input
                  type="file"
                  accept=".json,.csv,text/csv,application/json"
                  onChange={handleFile}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-gray-100 file:text-sm file:font-medium hover:file:bg-gray-200"
                />
                {fileName && <p className="text-xs text-gray-500 mt-1">Archivo: {fileName}</p>}

                {!!payload && (payload as { format?: string }).format === 'csv' && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Entidad (solo CSV)
                    </label>
                    <select
                      value={csvEntity}
                      onChange={(e) => {
                        setCsvEntity(e.target.value)
                        setPayload({ format: 'csv', entity: e.target.value, csvText: (payload as { csvText?: string }).csvText })
                      }}
                      className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    >
                      {meta?.csvEntities.map((e) => (
                        <option key={e} value={e}>
                          {entityLabel(e)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Step 2: Estrategia + Vista previa */}
              <div className={`mb-4 p-4 rounded-lg border-2 transition-colors ${
                importStep === 1 ? 'border-primary bg-primary/5' : importStep > 1 ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${
                    importStep > 1 ? 'bg-green-500 text-white' : importStep === 1 ? 'bg-primary text-white' : 'bg-gray-300 text-white'
                  }`}>
                    {importStep > 1 ? '✓' : '2'}
                  </span>
                  <span className="font-medium text-sm">Estrategia y análisis</span>
                </div>

                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Estrategia para registros existentes
                </label>
                <div className="space-y-1 mb-3">
                  {strategyOptions.map((s) => (
                    <label
                      key={s.value}
                      className="flex items-start gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="strategy"
                        value={s.value}
                        checked={strategy === s.value}
                        onChange={() => { setStrategy(s.value); setPreview(null) }}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-medium">{s.label}</span>
                        <span className="text-gray-500 block text-xs">
                          {STRATEGY_HINTS[s.value]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>

                <button
                  onClick={handlePreview}
                  disabled={!payload || previewing}
                  className="px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/5 transition-colors disabled:opacity-50 flex items-center gap-1 text-sm"
                >
                  {previewing ? (<><Spinner /> Analizando registros...</>) : 'Analizar archivo'}
                </button>
              </div>

              {/* Step 3: Confirmar */}
              <div className={`mb-4 p-4 rounded-lg border-2 transition-colors ${
                importStep === 2 ? 'border-primary bg-primary/5' : importStep > 2 ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${
                    importStep > 2 ? 'bg-green-500 text-white' : importStep === 2 ? 'bg-primary text-white' : 'bg-gray-300 text-white'
                  }`}>
                    {importStep > 2 ? '✓' : '3'}
                  </span>
                  <span className="font-medium text-sm">Revisar y confirmar</span>
                </div>

                {!preview && importStep < 2 && (
                  <p className="text-xs text-gray-400">Completa el paso anterior para ver la vista previa.</p>
                )}

                {preview && (
                  <>
                    <h3 className="font-semibold text-gray-800 mb-2 text-sm">
                      {preview.format === 'csv' ? entityLabel(preview.entity || '') : 'Respaldo completo'}
                    </h3>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg mb-3">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-3 py-1.5 font-medium text-gray-600 text-xs">Entidad</th>
                            <th className="text-center px-3 py-1.5 font-medium text-gray-600 text-xs">Total</th>
                            <th className="text-center px-3 py-1.5 font-medium text-green-600 text-xs">Nuevos</th>
                            <th className="text-center px-3 py-1.5 font-medium text-amber-600 text-xs">
                              {strategy === 'overwrite' ? 'A sobrescribir' : 'Existentes'}
                            </th>
                            <th className="text-center px-3 py-1.5 font-medium text-red-600 text-xs">Errores</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderedSummary.map((s) => (
                            <tr key={s.entity} className="border-b last:border-0">
                              <td className="px-3 py-1.5 font-medium text-xs">{entityLabel(s.entity)}</td>
                              <td className="px-3 py-1.5 text-center text-xs">{s.total}</td>
                              <td className="px-3 py-1.5 text-center text-green-600 text-xs">{s.toCreate}</td>
                              <td className="px-3 py-1.5 text-center text-amber-600 text-xs">
                                {strategy === 'overwrite' ? s.toOverwrite : s.toSkip}
                              </td>
                              <td className="px-3 py-1.5 text-center text-red-600 text-xs">{s.errors.length}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {preview.summary.some((s) => s.errors.length > 0) && (
                      <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 max-h-32 overflow-y-auto">
                        {preview.summary.map((s) =>
                          s.errors.map((err) => (
                            <p key={`${s.entity}-${err.row}`}>
                              <strong>{entityLabel(s.entity)} fila {err.row}:</strong> {err.message}
                            </p>
                          ))
                        )}
                      </div>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700 mb-3">
                      Las facturas importadas se registran como <strong>históricas</strong> y no
                      avanzan la numeración fiscal. Los talonarios fiscales nunca se sobrescriben.
                    </div>

                    <button
                      onClick={handleImport}
                      disabled={importing}
                      className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center gap-1 text-sm"
                    >
                      {importing ? (<><Spinner /> Importando registros...</>) : 'Confirmar importación'}
                    </button>
                  </>
                )}
              </div>

              {/* Step 4: Resultado */}
              {result && (
                <div className="p-4 rounded-lg border-2 border-green-200 bg-green-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold">✓</span>
                    <span className="font-medium text-sm text-green-800">Importación completada</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                    <div className="bg-white rounded-lg p-3 text-center border">
                      <p className="text-2xl font-bold text-green-600">{result.summary.reduce((a, s) => a + s.imported, 0)}</p>
                      <p className="text-xs text-gray-500">Importados</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center border">
                      <p className="text-2xl font-bold text-amber-600">{result.summary.reduce((a, s) => a + s.skipped, 0)}</p>
                      <p className="text-xs text-gray-500">Omitidos</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center border">
                      <p className="text-2xl font-bold text-blue-600">{result.summary.reduce((a, s) => a + s.overwritten, 0)}</p>
                      <p className="text-xs text-gray-500">Sobrescritos</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center border">
                      <p className={`text-2xl font-bold ${result.summary.some((s) => s.errors.length > 0) ? 'text-red-600' : 'text-gray-400'}`}>
                        {result.summary.reduce((a, s) => a + s.errors.length, 0)}
                      </p>
                      <p className="text-xs text-gray-500">Errores</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center border">
                      <p className="text-2xl font-bold text-gray-600">{(result.durationMs / 1000).toFixed(1)}s</p>
                      <p className="text-xs text-gray-500">Duración</p>
                    </div>
                  </div>
                  {result.summary.some((s) => s.errors.length > 0) && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 max-h-32 overflow-y-auto">
                      {result.summary.map((s) =>
                        s.errors.map((err) => (
                          <p key={`${s.entity}-${err.row}`}>
                            <strong>{entityLabel(s.entity)} fila {err.row}:</strong> {err.message}
                          </p>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!isRoot && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-bold mb-2">Importar datos</h2>
              <p className="text-sm text-gray-500">
                La importación de datos solo está disponible para el propietario del sistema (root).
              </p>
            </div>
          )}

          {/* Historial */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">Historial de migraciones</h2>
            {logs.length === 0 ? (
              <p className="text-sm text-gray-400">No hay migraciones registradas</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Fecha</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Tipo</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Estrategia</th>
                      <th className="text-center px-4 py-2 font-medium text-gray-600">Importados</th>
                      <th className="text-center px-4 py-2 font-medium text-gray-600">Omitidos</th>
                      <th className="text-center px-4 py-2 font-medium text-gray-600">Errores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-500">
                          {new Date(l.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 font-medium">
                          {l.kind === 'csv' ? `CSV · ${entityLabel(l.entity || '')}` : 'Respaldo completo'}
                        </td>
                        <td className="px-4 py-2 text-gray-600">
                          {strategyOptions.find((s) => s.value === l.strategy)?.label || l.strategy}
                        </td>
                        <td className="px-4 py-2 text-center text-green-600">{l.imported}</td>
                        <td className="px-4 py-2 text-center text-amber-600">{l.skipped}</td>
                        <td className="px-4 py-2 text-center text-red-600">{l.errors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
