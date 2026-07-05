import { useState, useEffect, useTransition, type JSX } from 'react'
import { api } from '../../lib/api'
import { useDebounceValue } from '../../hooks/useDebounce'

interface CustomerModalProps {
  open: boolean
  onClose: () => void
  onSelect: (customer: { id: string; name: string; rif: string | null }) => void
}

export default function CustomerModal({
  open,
  onClose,
  onSelect
}: CustomerModalProps): JSX.Element | null {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Array<{ id: string; name: string; rif: string | null }>>(
    []
  )
  const [isPending, startTransition] = useTransition()

  const debouncedSearch = useDebounceValue(search, 300)

  useEffect(() => {
    if (!open) return
    startTransition(async () => {
      const res = await api.customers.list({ search: debouncedSearch })
      setResults(res.customers)
    })
  }, [debouncedSearch, open, startTransition])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">Seleccionar Cliente</h2>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, RIF o teléfono..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary mb-4"
          autoFocus
        />
        <div className="max-h-60 overflow-y-auto space-y-1 mb-4">
          {isPending ? (
            <p className="text-gray-400 text-sm text-center py-4">Buscando...</p>
          ) : results.length > 0 ? (
            results.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-800">{c.name}</span>
                {c.rif && <span className="text-sm text-gray-500 ml-2">{c.rif}</span>}
              </button>
            ))
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">
              {search ? 'Sin resultados' : 'Escribe para buscar clientes'}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onSelect({ id: '', name: '', rif: null })
              onClose()
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Sin cliente
          </button>
        </div>
      </div>
    </div>
  )
}
