import { useCallback, useEffect, useRef, useState, type FormEvent, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  api,
  type DiscountCode,
  type DiscountCodeInput,
  type Product
} from '../lib/api'
import { useAuth } from '../contexts/useAuth'
import DiscountCodesFiltersBar from '../components/discount-codes/DiscountCodesFiltersBar'
import DiscountCodesTable from '../components/discount-codes/DiscountCodesTable'
import DiscountCodeValidateDrawer from '../components/discount-codes/DiscountCodeValidateDrawer'
import DiscountCodeDetailsDrawer from '../components/discount-codes/DiscountCodeDetailsDrawer'

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
type ScopeFilter = 'ALL' | 'PRODUCTS' | 'CATEGORIES' | 'all'
type TriState = 'all' | 'yes' | 'no'

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
  const { user, company, hasPermission } = useAuth()
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
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all')
  const [requireCustomerFilter, setRequireCustomerFilter] = useState<TriState>('all')
  const [hasUsageLimitFilter, setHasUsageLimitFilter] = useState<TriState>('all')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [showTestDrawer, setShowTestDrawer] = useState(false)
  const [testCode, setTestCode] = useState('')
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false)
  const [detailsCodeId, setDetailsCodeId] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<DiscountCode | null>(null)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Generación en masa
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkQuantity, setBulkQuantity] = useState('10')
  const [bulkPrefix, setBulkPrefix] = useState('')
  const [bulkResult, setBulkResult] = useState<{ count: number; codes: string[] } | null>(null)
  const [bulkCopied, setBulkCopied] = useState(false)

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
    setBulkMode(false)
    setBulkQuantity('10')
    setBulkPrefix('')
    setBulkResult(null)
    setBulkCopied(false)
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

  const openBulk = (): void => {
    void openCreate()
    setBulkMode(true)
    setBulkQuantity('10')
    setBulkPrefix('')
  }

  const openEdit = (c: DiscountCode): void => {
    setEditing(c)
    setBulkMode(false)
    setBulkResult(null)
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
    if (scope === 'PRODUCTS' && selectedProductIds.length === 0) {
      setFormError('Selecciona al menos un producto para este alcance')
      return
    }
    if (scope === 'CATEGORIES' && selectedCategoryIds.length === 0) {
      setFormError('Selecciona al menos una categoría para este alcance')
      return
    }

    const baseConfig: Omit<DiscountCodeInput, 'code'> = {
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

    if (bulkMode && !editing) {
      const qty = parseInt(bulkQuantity)
      if (Number.isNaN(qty) || qty < 1 || qty > 500) {
        setFormError('La cantidad a generar debe estar entre 1 y 500')
        return
      }
      setSubmitting(true)
      try {
        const res = await api.discountCodes.bulkGenerate({
          ...baseConfig,
          quantity: qty,
          prefix: bulkPrefix.trim() ? bulkPrefix.trim().toUpperCase() : undefined
        })
        setBulkResult({ count: res.count, codes: res.codes })
        await load()
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Error al generar códigos')
      } finally {
        setSubmitting(false)
      }
      return
    }

    const payload: DiscountCodeInput = { code: code.trim().toUpperCase(), ...baseConfig }

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

  const handleCopyAllBulk = async (): Promise<void> => {
    if (!bulkResult) return
    try {
      await navigator.clipboard.writeText(bulkResult.codes.join('\n'))
      setBulkCopied(true)
      setTimeout(() => setBulkCopied(false), 1500)
    } catch {
      setBulkCopied(false)
    }
  }

  const downloadBulkCsv = (): void => {
    if (!bulkResult) return
    const csv = 'codigo\n' + bulkResult.codes.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `codigos-descuento-${bulkResult.count}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getStatusText = (c: DiscountCode): string => {
    const now = new Date()
    if (c.deletedAt) return 'Eliminado'
    if (!c.isActive) return 'Inactivo'
    if (c.validFrom && new Date(c.validFrom) > now) return 'Programado'
    if (c.validUntil && new Date(c.validUntil) < now) return 'Expirado'
    if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return 'Agotado'
    return 'Activo'
  }

  const applyClientFilters = (list: DiscountCode[]): DiscountCode[] =>
    list.filter((c) => {
      if (scopeFilter !== 'all' && c.scope !== scopeFilter) return false
      if (requireCustomerFilter !== 'all' && c.requireCustomer !== (requireCustomerFilter === 'yes')) return false
      if (hasUsageLimitFilter !== 'all' && (c.usageLimit !== null) !== (hasUsageLimitFilter === 'yes')) return false
      return true
    })

  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const handlePrint = async (): Promise<void> => {
    setPrinting(true)
    setLoadError('')
    try {
      // Reúne todos los códigos que cumplen los filtros de servidor (paginando).
      const all: DiscountCode[] = []
      let currentPage = 1
      let totalPages = 1
      do {
        const params: {
          search?: string
          isActive?: boolean
          expired?: boolean
          page: number
          limit: number
        } = { page: currentPage, limit: 100 }
        if (search) params.search = search
        if (statusFilter === 'active') params.isActive = true
        if (statusFilter === 'inactive') params.isActive = false
        if (statusFilter === 'expired') params.expired = true
        const res = await api.discountCodes.list(params)
        all.push(...res.codes)
        totalPages = res.pages || 1
        currentPage++
      } while (currentPage <= totalPages && currentPage <= 50)

      const filtered = applyClientFilters(all)

      const filterDescriptions: string[] = []
      if (search) filterDescriptions.push(`Búsqueda: "${search}"`)
      if (statusFilter !== 'all') filterDescriptions.push(`Estado: ${statusFilter}`)
      if (scopeFilter !== 'all') filterDescriptions.push(`Alcance: ${scopeFilter}`)
      if (requireCustomerFilter !== 'all')
        filterDescriptions.push(`Requiere cliente: ${requireCustomerFilter === 'yes' ? 'Sí' : 'No'}`)
      if (hasUsageLimitFilter !== 'all')
        filterDescriptions.push(`Con límite de usos: ${hasUsageLimitFilter === 'yes' ? 'Sí' : 'No'}`)

      const conditionText = (c: DiscountCode): string =>
        [
          c.minSubtotal !== null ? `Mín ${c.minSubtotal} ${c.currency}` : '',
          c.minQuantity !== null ? `Cant ${c.minQuantity}` : '',
          c.maxDiscountAmount !== null ? `Tope ${c.maxDiscountAmount}` : ''
        ]
          .filter(Boolean)
          .join(' · ') || '—'

      const rows = filtered
        .map(
          (c) => `
        <tr>
          <td class="mono">${escapeHtml(c.code)}</td>
          <td>${escapeHtml(c.description || '')}</td>
          <td class="center">${c.discountValue}%</td>
          <td>${getStatusText(c)}</td>
          <td>${c.validFrom ? formatDate(c.validFrom) : 'Inmediato'}${c.validUntil ? ' → ' + formatDate(c.validUntil) : ''}</td>
          <td class="center">${c.usageLimit !== null ? `${c.usedCount}/${c.usageLimit}` : `${c.usedCount}/∞`}</td>
          <td>${escapeHtml(scopeLabel(c))}</td>
          <td>${escapeHtml(conditionText(c))}</td>
        </tr>`
        )
        .join('')

      const generatedAt = new Date().toLocaleString('es-VE')
      const companyName = company?.name || 'Silver Knight'
      const companyRif = company?.rif ? `RIF: ${company.rif}` : ''

      const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Códigos de Descuento</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { color: #6b7280; font-size: 12px; }
  h2 { font-size: 15px; margin: 16px 0 0; }
  .meta { margin: 10px 0; font-size: 11px; color: #4b5563; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
  th, td { border: 1px solid #d1d5db; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; }
  td.center, th.center { text-align: center; }
  td.mono { font-family: "Courier New", monospace; font-weight: bold; }
  .foot { margin-top: 16px; font-size: 10px; color: #9ca3af; text-align: right; }
  @media print { body { margin: 10mm; } }
</style></head>
<body>
  <h1>${escapeHtml(companyName)}</h1>
  <div class="sub">${escapeHtml(companyRif)}</div>
  <h2>Reporte de Códigos de Descuento</h2>
  <div class="meta">
    Generado: ${generatedAt} · Total: ${filtered.length} código${filtered.length === 1 ? '' : 's'}
    ${filterDescriptions.length ? `<br>Filtros: ${escapeHtml(filterDescriptions.join(' · '))}` : ''}
  </div>
  <table>
    <thead><tr>
      <th>Código</th><th>Descripción</th><th class="center">%</th><th>Estado</th>
      <th>Vigencia</th><th class="center">Usos</th><th>Alcance</th><th>Condiciones</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="8" class="center">Sin códigos para los filtros seleccionados</td></tr>'}</tbody>
  </table>
  <div class="foot">Silver Knight POS</div>
</body></html>`

      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      iframe.setAttribute('aria-hidden', 'true')
      document.body.appendChild(iframe)

      const cleanup = (): void => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
      }

      const doc = iframe.contentWindow?.document
      if (!doc) throw new Error('No se pudo preparar la impresión')
      doc.open()
      doc.write(html)
      doc.close()

      iframe.contentWindow!.onafterprint = cleanup
      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        // Respaldo por si onafterprint no se dispara (p. ej. cancelado).
        setTimeout(cleanup, 60000)
      }, 300)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Error al generar el reporte')
    } finally {
      setPrinting(false)
    }
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

  const visibleCodes = applyClientFilters(codes)

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handlePrint()}
            disabled={printing}
            title="Generar reporte imprimible o exportar a PDF"
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {printing ? 'Generando…' : '🖨 Imprimir / PDF'}
          </button>
          {canManage && (
            <>
              <button
                onClick={openBulk}
                className="border border-primary text-primary px-4 py-2 rounded-md hover:bg-primary/5 transition-colors"
              >
                ⚡ Generar en masa
              </button>
              <button
                onClick={openCreate}
                className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-colors"
              >
                + Nuevo Código
              </button>
            </>
          )}
        </div>
      </div>

      <DiscountCodesFiltersBar
        search={search}
        setSearch={(v) => {
          setSearch(v)
          setPage(1)
        }}
        status={statusFilter}
        setStatus={(v) => {
          setStatusFilter(v)
          setPage(1)
        }}
        scope={scopeFilter}
        setScope={(v) => {
          setScopeFilter(v)
          setPage(1)
        }}
        requireCustomer={requireCustomerFilter}
        setRequireCustomer={(v) => {
          setRequireCustomerFilter(v)
          setPage(1)
        }}
        hasUsageLimit={hasUsageLimitFilter}
        setHasUsageLimit={(v) => {
          setHasUsageLimitFilter(v)
          setPage(1)
        }}
        onClear={() => {
          setScopeFilter('all')
          setRequireCustomerFilter('all')
          setHasUsageLimitFilter('all')
          setPage(1)
        }}
      />

      {loadError && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md mb-4">{loadError}</div>
      )}

      <DiscountCodesTable
        codes={visibleCodes}
        loading={loading}
        canManage={canManage}
        copiedCode={copiedCode}
        togglingId={togglingId}
        onCopy={handleCopy}
        onToggleActive={handleToggleActive}
        onEdit={openEdit}
        onDelete={handleDelete}
        onView={(id) => {
          setDetailsCodeId(id)
          setShowDetailsDrawer(true)
        }}
        onTest={(c) => {
          setTestCode(c)
          setShowTestDrawer(true)
        }}
      />

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

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-1">
              {editing
                ? 'Editar Código de Descuento'
                : bulkMode
                  ? 'Generar Códigos en Masa'
                  : 'Nuevo Código de Descuento'}
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              {bulkMode
                ? 'La configuración se aplica a todos los códigos generados. Se crearán códigos únicos y consecutivos.'
                : 'Configura todos los parámetros del código. Los campos vacíos de condiciones/límites se interpretan como «sin restricción».'}
            </p>
            {bulkMode && bulkResult ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-md p-3 flex items-center justify-between">
                  <p className="text-sm text-green-800 font-medium">
                    ✓ Se generaron {bulkResult.count} código{bulkResult.count === 1 ? '' : 's'} correctamente.
                  </p>
                  <button
                    type="button"
                    onClick={() => setBulkResult(null)}
                    className="text-xs text-green-700 hover:text-green-900 underline"
                  >
                    Generar otro lote
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAllBulk}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                  >
                    {bulkCopied ? '✓ Copiado' : 'Copiar todos'}
                  </button>
                  <button
                    type="button"
                    onClick={downloadBulkCsv}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                  >
                    Descargar CSV
                  </button>
                  <span className="text-xs text-gray-400 ml-auto">
                    Mismo descuento, vigencia y condiciones
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100 bg-gray-50">
                  {bulkResult.codes.map((c) => (
                    <div key={c} className="px-3 py-1.5 font-mono text-sm text-gray-800">
                      {c}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      setBulkResult(null)
                      setBulkMode(false)
                    }}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="border border-gray-200 rounded-md p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Identidad</h3>
                {bulkMode && !editing ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad a generar *</label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={bulkQuantity}
                        onChange={(e) => setBulkQuantity(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                      <p className="text-[11px] text-gray-400 mt-1">Máximo 500 por lote.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Prefijo (opcional)</label>
                      <input
                        type="text"
                        value={bulkPrefix}
                        onChange={(e) => setBulkPrefix(e.target.value.toUpperCase())}
                        maxLength={10}
                        placeholder="Ej: PROMO"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">Se antepone a cada código generado.</p>
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
                ) : (
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
                )}
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
                <p className="text-xs text-gray-400">Vacíos = sin límite de fechas.</p>
              </div>

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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tope máximo por factura</label>
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
                          <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
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
                          <label key={cat.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
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
                  </div>
                )}
              </div>

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
                  {submitting
                    ? bulkMode
                      ? 'Generando...'
                      : 'Guardando...'
                    : editing
                      ? 'Guardar'
                      : bulkMode
                        ? `Generar ${bulkQuantity || '0'} códigos`
                        : 'Crear'}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      <DiscountCodeValidateDrawer
        key={showTestDrawer ? 'validate-open' : 'validate-closed'}
        open={showTestDrawer}
        code={testCode}
        onClose={() => {
          setShowTestDrawer(false)
          setTestCode('')
        }}
      />

      <DiscountCodeDetailsDrawer
        open={showDetailsDrawer}
        codeId={detailsCodeId}
        onClose={() => {
          setShowDetailsDrawer(false)
          setDetailsCodeId(null)
        }}
      />
    </div>
  )
}