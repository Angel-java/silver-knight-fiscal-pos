import { type JSX } from 'react'

export type StatusFilter = 'all' | 'active' | 'inactive' | 'expired'
type ScopeFilter = 'ALL' | 'PRODUCTS' | 'CATEGORIES' | 'all'
type TriState = 'all' | 'yes' | 'no'

interface DiscountCodesFiltersBarProps {
  search: string
  setSearch: (value: string) => void
  status: StatusFilter
  setStatus: (value: StatusFilter) => void
  scope: ScopeFilter
  setScope: (value: ScopeFilter) => void
  requireCustomer: TriState
  setRequireCustomer: (value: TriState) => void
  hasUsageLimit: TriState
  setHasUsageLimit: (value: TriState) => void
  onClear: () => void
}

const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Activos' },
  { key: 'inactive', label: 'Inactivos' },
  { key: 'expired', label: 'Expirados' }
]

export default function DiscountCodesFiltersBar({
  search,
  setSearch,
  status,
  setStatus,
  scope,
  setScope,
  requireCustomer,
  setRequireCustomer,
  hasUsageLimit,
  setHasUsageLimit,
  onClear
}: DiscountCodesFiltersBarProps): JSX.Element {
  const hasExtraFilters =
    scope !== 'all' || requireCustomer !== 'all' || hasUsageLimit !== 'all'

  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-gray-300 overflow-hidden">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatus(tab.key)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                status === tab.key
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-[220px] max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código o descripción"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5 text-gray-600">
          Alcance
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as ScopeFilter)}
            className="px-2 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">Todos</option>
            <option value="ALL">Todo el carrito</option>
            <option value="PRODUCTS">Productos</option>
            <option value="CATEGORIES">Categorías</option>
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-gray-600">
          Requiere cliente
          <select
            value={requireCustomer}
            onChange={(e) => setRequireCustomer(e.target.value as TriState)}
            className="px-2 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">Todos</option>
            <option value="yes">Sí</option>
            <option value="no">No</option>
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-gray-600">
          Límite de usos
          <select
            value={hasUsageLimit}
            onChange={(e) => setHasUsageLimit(e.target.value as TriState)}
            className="px-2 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">Todos</option>
            <option value="yes">Con límite</option>
            <option value="no">Sin límite</option>
          </select>
        </label>

        {hasExtraFilters && (
          <button
            onClick={onClear}
            className="text-primary hover:text-primary-dark text-sm font-medium"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )
}
