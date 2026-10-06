import { useCallback, useEffect, useRef, useState, type FormEvent, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  api,
  type DiscountCode,
  type DiscountCodeInput,
  type Product
} from '../lib/api'
import { useAuth } from '../contexts/useAuth'

const CURRENCY_OPTIONS = [
  { value: 'VES', label: 'Bolívares (VES)' },
  { value: 'USD', label: 'Dólares (USD)' }
]

const SCOPE_OPTIONS = [
  { value: 'ALL', label: 'Todo el carrito' },
  { value: 'PRODUCTS', label: 'Productos específicos' },
  { value: 'CATEGORIES', label: 'Categorías específicas' }
] as const

type Scope = 'ALL' | 'PRODUCTS' | 'CATEGORIES'
type StatusFilter = 'all' | 'active' | 'inactive' | 'expired'

const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Activos' },
  { key: 'inactive', label: 'Inactivos' },
  { key: 'expired', label: 'Expirados' }
]

const toDateInput = (d: string | null): string => {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  // 'en-CA' produce YYYY-MM-DD en hora local
  return date.toLocaleDateString('en-CA')
}

const formatDate = (d: string | null): string => {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-VE')
}

export default function DiscountCodesPage(): JSX.Element {
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const canManage = user?.role === 'root' || user?.role === 'admin' || hasPermission('discount-codes')

  // Listado
  const [codes, setCodes] = useState<DiscountCode[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<DiscountCode | null>(null)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [discountValue, setDiscountValue] = useState('20')
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [minSubtotal, setMinSubtotal] = useState('')
  const [minQuantity, setMinQuantity] = useState('')
  const [currency, setCurrency] = useState<'VES' | 'USD'>('VES')
  const [usageLimit, setUsageLimit] = useState('')
  const [usagePerCustomer, setUsagePerCustomer] = useState('')
  const [requireCustomer, setRequireCustomer] = useState(false)
  const [scope, setScope] = useState<Scope>('ALL')
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Selector de alcance
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const productSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setLoadError('')
    try {
      const params: { search?: string; isActive?: boolean; expired?: boolean; page: number } = {
        page
      }
      if (search) params.search = search
      if (statusFilter === 'active') params.isActive = true
      if (statusFilter === 'inactive') params.isActive = false
      if (statusFilter === 'expired') params.expired = true

      const res = await api.discountCodes.list(params)
      setCodes(res.codes)
      setTotal(res.total)
      setPages(res.pages || 1)
      if (res.page > (res.pages || 1)) setPage(1)
    } catch {
      setLoadError('Error al cargar códigos de descuento')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, page])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  const loadProductResults = useCallback(async (term: string): Promise<void> => {
    if (!term.trim()) {
      setProductResults([])
      return
    }
    setProductsLoading(true)
    try {
      const res = await api.products.list({ search: term, page: 1 })
      setProductResults(res.products)
    } catch {
      setProductResults([])
    } finally {
      setProductsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (scope !== 'PRODUCTS') return
    if (productSearchRef.current) clearTimeout(productSearchRef.current)
    productSearchRef.current = setTimeout(() => {
      void loadProductResults(productSearch)
    }, 300)
    return () => {
      if (productSearchRef.current) clearTimeout(productSearchRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSearch, scope])

  const loadCategories = useCallback(async (): Promise<void> => {
    if (categories.length > 0) return
    setCategoriesLoading(true)
    try {
      const res = await api.categories.list()
      setCategories(res.categories.map((c) => ({ id: c.id, name: c.name })))
    } catch {
      setCategories([])
    } finally {
      setCategoriesLoading(false)
    }
  }, [categories.length])

  useEffect(() => {
    if (!showModal || scope !== 'CATEGORIES') return
    const t = setTimeout(() => {
      void loadCategories()
    }, 0)
    return () => clearTimeout(t)
  }, [showModal, scope, loadCategories])

  const openCreate = async (): Promise<void> => {
    setEditing(null)
    setCode('')
    setDescription('')
    setDiscountValue('20')
    setValidFrom('')
    setValidUntil('')
    setMinSubtotal('')
    setMinQuantity('')
    setCurrency('VES')
    setUsageLimit('')
    setUsagePerCustomer('')
    setRequireCustomer(false)
    setScope('ALL')
    setMaxDiscountAmount('')
    setIsActive(true)
    setSelectedProductIds([])
    setSelectedCategoryIds([])
    setProductSearch('')
    setProductResults([])
    setFormError('')

    try {
      const res = await api.discountCodes.generate({})
      setCode(res.code)
    } catch {
      // permitir ingresar el código manualmente
    }
    setShowModal(true)
  }

  const openEdit = (c: DiscountCode): void => {
    setEditing(c)
    setCode(c.code)
    setDescription(c.description || '')
    setDiscountValue(String(c.discountValue))
    setValidFrom(toDateInput(c.validFrom))
    setValidUntil(toDateInput(c.validUntil))
    setMinSubtotal(c.minSubtotal !== null ? String(c.minSubtotal) : '')
    setMinQuantity(c.minQuantity !== null ? String(c.minQuantity) : '')
    setCurrency(c.currency as 'VES' | 'USD')
    setUsageLimit(c.usageLimit !== null ? String(c.usageLimit) : '')
    setUsagePerCustomer(c.usagePerCustomer !== null ? String(c.usagePerCustomer) : '')
    setRequireCustomer(c.requireCustomer)
    setScope(c.scope)
    setMaxDiscountAmount(c.maxDiscountAmount !== null ? String(c.maxDiscountAmount) : '')
    setIsActive(c.isActive)
    setSelectedProductIds(c.productIds || [])
    setSelectedCategoryIds(c.categoryIds || [])
    setProductSearch('')
    setProductResults([])
    setFormError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setFormError('')

    const numValue = parseFloat(discountValue)
    if (Number.isNaN(numValue) || numValue < 1 || numValue > 100) {
      setFormError('El porcentaje de descuento debe estar entre 1 y 100')
      return
    }
    if (validFrom && validUntil && validUntil < validFrom) {
      setFormError('"Válido hasta" debe ser mayor o igual a "Válido desde"')
      return
    }
    if (scope !== 'ALL' && scope === 'PRODUCTS' && selectedProductIds.length === 0) {
      setFormError('Selecciona al menos un producto para este alcance')
      return
    }
    if (scope !== 'ALL' && scope === 'CATEGORIES' && selectedCategoryIds.length === 0) {
      setFormError('Selecciona al menos una categoría para este alcance')
      return
    }

    const payload: DiscountCodeInput = {
      code: code.trim().toUpperCase(),
      description: description.trim() || null,
      discountValue: numValue,
      // Fecha "desde" al inicio del día y "hasta" al final del día (según intención del operador)
      validFrom: validFrom ? `${validFrom}T00:00:00` : null,
      validUntil: validUntil ? `${validUntil}T23:59:59` : null,
      minSubtotal: minSubtotal ? parseFloat(minSubtotal) : null,
      minQuantity: minQuantity ? parseInt(minQuantity) : null,
      currency,
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      usagePerCustomer: usagePerCustomer ? parseInt(usagePerCustomer) : null,
      requireCustomer,
      scope,
      productIds: scope === 'PRODUCTS' ? selectedProductIds : null,
      categoryIds: scope === 'CATEGORIES' ? selectedCategoryIds : null,
      maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
      isActive
    }

    setSubmitting(true)
    try {
      if (editing) {
        await api.discountCodes.update(editing.id, payload)
      } else {
        await api.discountCodes.create(payload)
      }
      setShowModal(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm('¿Eliminar este código? Si ya fue usado, quedará inactivo (soft-delete).')) return
    try {
      await api.discountCodes.delete(id)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  const handleToggleActive = async (c: DiscountCode): Promise<void> => {
    setTogglingId(c.id)
    try {
      await api.discountCodes.update(c.id, { isActive: !c.isActive })
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cambiar estado')
    } finally {
      setTogglingId(null)
    }
  }

  const handleCopy = async (codeText: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(codeText)
      setCopiedCode(codeText)
      setTimeout(() => setCopiedCode(null), 1500)
    } catch {
      setCopiedCode(null)
    }
  }

  const getStatusBadge = (c: DiscountCode): { text: string; className: string } => {
    if (!c.isActive) return { text: 'Inactivo', className: 'bg-gray-100 text-gray-700' }
    const now = new Date()
    if (c.validFrom && new Date(c.validFrom) > now) {
      return { text: 'Programado', className: 'bg-yellow-100 text-yellow-700' }
    }
    if (c.validUntil && new Date(c.validUntil) < now) {
      return { text: 'Expirado', className: 'bg-red-100 text-red-700' }
    }
    if (c.usageLimit !== null && c.usedCount >= c.usageLimit) {
      return { text: 'Agotado', className: 'bg-orange-100 text-orange-700' }
    }
    return { text: 'Activo', className: 'bg-green-100 text-green-700' }
  }

  const scopeLabel = (c: DiscountCode): string => {
    if (c.scope === 'PRODUCTS') return `Productos (${(c.productIds || []).length})`
    if (c.scope === 'CATEGORIES') return `Categorías (${(c.categoryIds || []).length})`
    return 'Todo el carrito'
  }

  const toggleProduct = (id: string): void => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleCategory = (id: string): void => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  if (loading && codes.length === 0) return <p className="text-gray-500 p-4">Cargando...</p>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/settings')} className="text-gray-500 hover:text-gray-700 text-lg">
            ←
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Códigos de Descuento</h1>
            <p className="text-sm text-gray-500">
              {total} código{total === 1 ? '' : 's'} · panel de gestión y configuración
            </p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-colors"
          >
            + Nuevo Código
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex rounded-md border border-gray-300 overflow-hidden">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setStatusFilter(tab.key)
                setPage(1)
              }}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === tab.key
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
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Buscar por código o descripción"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      {loadError && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md mb-4">{loadError}</div>
      )}

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Código</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Descripción</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">% Desc.</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Validez</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Condiciones</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Alcance</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Usos</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                {canManage && <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const badge = getStatusBadge(c)
                const usagePct =
                  c.usageLimit !== null ? Math.min(100, Math.round((c.usedCount / c.usageLimit) * 100)) : null
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{c.code}</span>
                        {canManage && (
                          <button
                            onClick={() => handleCopy(c.code)}
                            title="Copiar código"
                            className="text-gray-400 hover:text-gray-600 text-xs"
                          >
                            {copiedCode === c.code ? '✓' : '⧉'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                      {c.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-medium">{c.discountValue}%</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {c.validFrom || c.validUntil ? (
                        <span className="block text-xs">
                          {c.validFrom ? `Desde ${formatDate(c.validFrom)}` : 'Sin inicio'}
                          <br />
                          {c.validUntil ? `Hasta ${formatDate(c.validUntil)}` : 'Sin fin'}
                        </span>
                      ) : (
                        'Ilimitado'
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {c.minSubtotal !== null && `Mín: ${c.minSubtotal} ${c.currency}`}
                      {c.minSubtotal !== null && c.minQuantity !== null && ' · '}
                      {c.minQuantity !== null && `Cant: ${c.minQuantity}`}
                      {c.maxDiscountAmount !== null && (
                        <>
                          {c.minSubtotal !== null || c.minQuantity !== null ? ' · ' : ''}
                          Tope: {c.maxDiscountAmount}
                        </>
                      )}
                      {c.minSubtotal === null && c.minQuantity === null && c.maxDiscountAmount === null && '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{scopeLabel(c)}</td>
                    <td className="px-4 py-3 text-center text-sm">
                      {c.usageLimit !== null ? (
                        <span title={`${usagePct}% del límite consumido`}>
                          {c.usedCount}/{c.usageLimit}
                        </span>
                      ) : (
                        `${c.usedCount} / ∞`
                      )}
                      {c.usagePerCustomer !== null && (
                        <span className="block text-[10px] text-gray-400">
                          {c.usagePerCustomer}/cliente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
                        {badge.text}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right text-sm whitespace-nowrap">
                        <button
                          onClick={() => handleToggleActive(c)}
                          disabled={togglingId === c.id}
                          title={c.isActive ? 'Desactivar' : 'Activar'}
                          className={`mr-3 text-xs px-2 py-1 rounded-md border transition-colors disabled:opacity-50 ${
                            c.isActive
                              ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                              : 'border-green-300 text-green-700 hover:bg-green-50'
                          }`}
                        >
                          {togglingId === c.id ? '...' : c.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                        <button onClick={() => openEdit(c)} className="text-blue-600 hover:text-blue-800 mr-3">
                          Editar
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:text-red-800">
                          Eliminar
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
              {codes.length === 0 && !loading && (
                <tr>
                  <td colSpan={canManage ? 9 : 8} className="px-4 py-8 text-center text-gray-400">
                    No hay códigos de descuento para este filtro
                  </td>
                </tr>
              )}
              {codes.length === 0 && loading && (
                <tr>
                  <td colSpan={canManage ? 9 : 8} className="px-4 py-8 text-center text-gray-400">
                    Cargando...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pages > 1 && (
          <div className="p-3 border-t flex items-center justify-between text-sm text-gray-600">
            <span>
              Página {page} de {pages} · {total} código{total === 1 ? '' : 's'}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-1">
              {editing ? 'Editar Código de Descuento' : 'Nuevo Código de Descuento'}
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Configura todos los parámetros del código. Los campos vacíos de condiciones/límites se interpretan como
              «sin restricción».
            </p>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Identidad */}
              <div className="border border-gray-200 rounded-md p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Identidad</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        disabled={!!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono disabled:bg-gray-100"
                        required
                      />
                      {!editing && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await api.discountCodes.generate({})
                              setCode(res.code)
                            } catch {
                              setFormError('No se pudo generar un código automático')
                            }
                          }}
                          title="Generar código automático"
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                        >
                          🎲
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">% Descuento *</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="0.1"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej: Bienvenida 20% — campaña octubre"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              {/* Validez */}
              <div className="border border-gray-200 rounded-md p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Validez</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Válido desde</label>
                    <input
                      type="date"
                      value={validFrom}
                      onChange={(e) => setValidFrom(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Válido hasta</label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Vacíos = sin límite de fechas. «Hasta» se interpreta hasta el fin de ese día.
                </p>
              </div>

              {/* Descuento y condiciones */}
              <div className="border border-gray-200 rounded-md p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Descuento y condiciones</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monto mínimo</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={minSubtotal}
                      onChange={(e) => setMinSubtotal(e.target.value)}
                      placeholder="Sin mínimo"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Moneda para evaluar</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as 'VES' | 'USD')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      {CURRENCY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad mínima</label>
                    <input
                      type="number"
                      min="1"
                      value={minQuantity}
                      onChange={(e) => setMinQuantity(e.target.value)}
                      placeholder="Sin mínimo"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tope máximo por factura
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={maxDiscountAmount}
                      onChange={(e) => setMaxDiscountAmount(e.target.value)}
                      placeholder="Sin tope"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              {/* Límites de uso */}
              <div className="border border-gray-200 rounded-md p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Límites de uso</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Límite total de usos</label>
                    <input
                      type="number"
                      min="1"
                      value={usageLimit}
                      onChange={(e) => setUsageLimit(e.target.value)}
                      placeholder="Ilimitado"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Usos por cliente</label>
                    <input
                      type="number"
                      min="1"
                      value={usagePerCustomer}
                      onChange={(e) => setUsagePerCustomer(e.target.value)}
                      placeholder="Sin límite"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
                      <input
                        type="checkbox"
                        checked={requireCustomer}
                        onChange={(e) => setRequireCustomer(e.target.checked)}
                        className="w-4 h-4"
                      />
                      Requiere cliente
                    </label>
                  </div>
                </div>
              </div>

              {/* Alcance */}
              <div className="border border-gray-200 rounded-md p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Alcance</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {SCOPE_OPTIONS.map((o) => (
                    <label
                      key={o.value}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer text-sm ${
                        scope === o.value
                          ? 'border-primary bg-primary/5 text-gray-800'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="scope"
                        value={o.value}
                        checked={scope === o.value}
                        onChange={() => {
                          setScope(o.value)
                          setFormError('')
                        }}
                        className="w-4 h-4"
                      />
                      {o.label}
                    </label>
                  ))}
                </div>

                {scope === 'PRODUCTS' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Productos incluidos ({selectedProductIds.length})
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedProductIds.map((id) => {
                        const found = productResults.find((p) => p.id === id)
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                          >
                            {found ? found.name : id.slice(0, 8)}
                            <button type="button" onClick={() => toggleProduct(id)} className="font-bold">
                              ×
                            </button>
                          </span>
                        )
                      })}
                    </div>
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar producto por nombre o código..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    {productsLoading && <p className="text-xs text-gray-400">Buscando...</p>}
                    {!productsLoading && productResults.length > 0 && (
                      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md divide-y">
                        {productResults.map((p) => (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedProductIds.includes(p.id)}
                              onChange={() => toggleProduct(p.id)}
                              className="w-4 h-4"
                            />
                            <span className="flex-1 truncate">{p.name}</span>
                            {p.code && <span className="text-xs text-gray-400 font-mono">{p.code}</span>}
                          </label>
                        ))}
                      </div>
                    )}
                    {!productsLoading && productSearch && productResults.length === 0 && (
                      <p className="text-xs text-gray-400">Sin productos que coincidan con la búsqueda.</p>
                    )}
                  </div>
                )}

                {scope === 'CATEGORIES' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categorías incluidas ({selectedCategoryIds.length})
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedCategoryIds.map((id) => {
                        const found = categories.find((c) => c.id === id)
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                          >
                            {found ? found.name : id.slice(0, 8)}
                            <button type="button" onClick={() => toggleCategory(id)} className="font-bold">
                              ×
                            </button>
                          </span>
                        )
                      })}
                    </div>
                    {categoriesLoading && <p className="text-xs text-gray-400">Cargando categorías...</p>}
                    {!categoriesLoading && categories.length > 0 && (
                      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md divide-y">
                        {categories.map((cat) => (
                          <label
                            key={cat.id}
                            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCategoryIds.includes(cat.id)}
                              onChange={() => toggleCategory(cat.id)}
                              className="w-4 h-4"
                            />
                            <span className="flex-1 truncate">{cat.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {!categoriesLoading && categories.length === 0 && (
                      <p className="text-xs text-gray-400">No hay categorías registradas.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Estado */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Activo (acepta el código en el POS)
                </label>
              </div>

              {formError && <p className="text-red-600 text-sm">{formError}</p>}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : editing ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}