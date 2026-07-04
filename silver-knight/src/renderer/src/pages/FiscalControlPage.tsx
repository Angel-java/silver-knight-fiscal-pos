import { useState, useEffect, type FormEvent, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type FiscalControl } from '../lib/api'

const DOC_OPTIONS = [
  { value: 'FACT', label: 'Factura' },
  { value: 'NCR', label: 'Nota de Crédito' },
  { value: 'NDB', label: 'Nota de Débito' }
]

export default function FiscalControlPage(): JSX.Element {
  const navigate = useNavigate()
  const [controls, setControls] = useState<FiscalControl[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<FiscalControl | null>(null)
  const [documentType, setDocumentType] = useState('FACT')
  const [resolution, setResolution] = useState('')
  const [prefix, setPrefix] = useState('')
  const [startNumber, setStartNumber] = useState('1')
  const [endNumber, setEndNumber] = useState('999999')
  const [issuedAt, setIssuedAt] = useState('')

  const load = async (): Promise<void> => {
    try {
      const res = await api.fiscalControl.list()
      setControls(res.controls)
    } catch {
      setError('Error al cargar controles fiscales')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        const res = await api.fiscalControl.list()
        setControls(res.controls)
      } catch {
        setError('Error al cargar controles fiscales')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const openCreate = (): void => {
    setEditing(null)
    setDocumentType('FACT')
    setResolution('')
    setPrefix('')
    setStartNumber('1')
    setEndNumber('999999')
    setIssuedAt(new Date().toISOString().split('T')[0])
    setError('')
    setShowModal(true)
  }

  const openEdit = (c: FiscalControl): void => {
    setEditing(c)
    setDocumentType(c.documentType)
    setResolution(c.resolution)
    setPrefix(c.prefix)
    setStartNumber(String(c.startNumber))
    setEndNumber(String(c.endNumber))
    setIssuedAt(c.issuedAt.split('T')[0])
    setError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')
    try {
      if (editing) {
        await api.fiscalControl.update(editing.id, {
          resolution,
          prefix,
          startNumber: parseInt(startNumber),
          endNumber: parseInt(endNumber),
          issuedAt
        })
      } else {
        await api.fiscalControl.create({
          documentType,
          resolution,
          prefix,
          startNumber: parseInt(startNumber),
          endNumber: parseInt(endNumber),
          issuedAt
        })
      }
      setShowModal(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  const toggleActive = async (c: FiscalControl): Promise<void> => {
    try {
      await api.fiscalControl.update(c.id, { isActive: !c.isActive })
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar')
    }
  }

  const getDocLabel = (dt: string): string => DOC_OPTIONS.find((o) => o.value === dt)?.label || dt

  if (loading) return <p className="text-gray-500 p-4">Cargando...</p>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/settings')}
            className="text-gray-500 hover:text-gray-700 text-lg"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Control Fiscal</h1>
        </div>
        <button
          onClick={openCreate}
          className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-colors"
        >
          + Nuevo Talonario
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Tipo</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Resolución</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Prefijo</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Rango</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Actual</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Activo</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {controls.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{getDocLabel(c.documentType)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{c.resolution}</td>
                <td className="px-4 py-3 text-sm font-mono">{c.prefix}</td>
                <td className="px-4 py-3 text-center text-sm">
                  {c.startNumber} — {c.endNumber}
                </td>
                <td className="px-4 py-3 text-center text-sm font-mono">{c.currentNumber}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(c)}
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {c.isActive ? 'Sí' : 'No'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openEdit(c)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {controls.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No hay talonarios configurados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">¿Qué es un talonario fiscal?</p>
        <p>
          Corresponde a una resolución de habilitación de talonarios emitida por el SENIAT. Cada
          tipo de documento (Factura, Nota de Crédito, Nota de Débito) necesita su propio talonario
          con un rango de numeración autorizado.
        </p>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-4">
              {editing ? 'Editar Talonario' : 'Nuevo Talonario'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Documento
                </label>
                {editing ? (
                  <p className="text-gray-800 font-medium">{getDocLabel(documentType)}</p>
                ) : (
                  <select
                    value={documentType}
                    onChange={(e) => {
                      setDocumentType(e.target.value)
                      setPrefix(`0${e.target.value[0]}`)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    {DOC_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nº Resolución SENIAT *
                </label>
                <input
                  type="text"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prefijo CF</label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="0F"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nº Inicio</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={startNumber}
                    onChange={(e) => setStartNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nº Fin</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={endNumber}
                    onChange={(e) => setEndNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Autorización
                </label>
                <input
                  type="date"
                  value={issuedAt}
                  onChange={(e) => setIssuedAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
                >
                  {editing ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
