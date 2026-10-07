import { useEffect, useState, type JSX } from 'react'
import { api, type DiscountCode } from '../../lib/api'
import DiscountCodeStatusBadge from './DiscountCodeStatusBadge'
import DiscountCodeScopeTags from './DiscountCodeScopeTags'

interface DiscountCodeDetailsDrawerProps {
  open: boolean
  codeId: string | null
  onClose: () => void
}

const formatDateTime = (d: string | null): string => {
  if (!d) return '-'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('es-VE')
}

const formatDate = (d: string | null): string => {
  if (!d) return '-'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('es-VE')
}

export default function DiscountCodeDetailsDrawer({
  open,
  codeId,
  onClose
}: DiscountCodeDetailsDrawerProps): JSX.Element | null {
  const [code, setCode] = useState<DiscountCode | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !codeId) return
    const load = async (): Promise<void> => {
      setLoading(true)
      setError('')
      try {
        const res = await api.discountCodes.get(codeId)
        setCode(res.code)
      } catch {
        setError('Error al cargar detalles del código')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [open, codeId])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-lg flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Detalles del Código de Descuento</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="flex-1 p-4 space-y-6 overflow-y-auto">
          {loading && <p className="text-gray-500 text-sm">Cargando detalles...</p>}
          {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">{error}</div>}
          {code && (
            <>
              <div className="border border-gray-200 rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-semibold">{code.code}</span>
                    <DiscountCodeStatusBadge code={code} />
                  </div>
                  <span className="text-2xl font-bold text-primary">{code.discountValue}%</span>
                </div>
                {code.description && <p className="text-sm text-gray-600">{code.description}</p>}
                <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 pt-2 border-t">
                  <div>
                    <span className="text-gray-500">Moneda base:</span> {code.currency}
                  </div>
                  <div>
                    <span className="text-gray-500">Activo:</span> {code.isActive ? 'Sí' : 'No'}
                  </div>
                  <div>
                    <span className="text-gray-500">Creado:</span> {formatDateTime(code.createdAt)}
                  </div>
                  <div>
                    <span className="text-gray-500">Actualizado:</span> {formatDateTime(code.updatedAt)}
                  </div>
                  {code.deletedAt && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Eliminado (soft):</span> {formatDateTime(code.deletedAt)}
                    </div>
                  )}
                  {code.createdBy && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Creado por:</span> {code.createdBy.fullName || code.createdBy.username}
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-gray-200 rounded-md p-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">Vigencia</h3>
                <div className="text-sm text-gray-600">
                  <p>Válido desde: {code.validFrom ? formatDateTime(code.validFrom) : 'Inmediato'}</p>
                  <p>Válido hasta: {code.validUntil ? formatDateTime(code.validUntil) : 'Sin fecha de expiración'}</p>
                </div>
              </div>

              <div className="border border-gray-200 rounded-md p-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">Condiciones</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Monto mínimo: {code.minSubtotal !== null ? `${code.minSubtotal} ${code.currency}` : 'Sin mínimo'}</p>
                  <p>Cantidad mínima: {code.minQuantity !== null ? `${code.minQuantity} unidades` : 'Sin mínimo'}</p>
                  <p>Tope máximo de descuento: {code.maxDiscountAmount !== null ? code.maxDiscountAmount : 'Sin tope'}</p>
                  <div>
                    Alcance: <DiscountCodeScopeTags code={code} />
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-md p-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">Límites de uso</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    Usos: {code.usedCount}
                    {code.usageLimit !== null ? ` / ${code.usageLimit}` : ' / ∞'}
                  </p>
                  <p>Usos por cliente: {code.usagePerCustomer !== null ? code.usagePerCustomer : 'Sin límite'}</p>
                  <p>Requiere cliente: {code.requireCustomer ? 'Sí' : 'No'}</p>
                </div>
              </div>

              {code.discountUsages && code.discountUsages.length > 0 && (
                <div className="border border-gray-200 rounded-md p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">Usos ({code.discountUsages.length})</h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {code.discountUsages.map((usage) => (
                      <div key={usage.id} className="border border-gray-100 rounded p-2 text-xs space-y-1 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Factura #{usage.invoice?.number}</span>
                          <span className="text-gray-500">{formatDateTime(usage.usedAt)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-gray-600">
                          {usage.customer && (
                            <div className="col-span-2">
                              Cliente: {usage.customer.name}
                              {usage.customer.rif && ` (${usage.customer.rif})`}
                            </div>
                          )}
                          {usage.discountAmountUsd > 0 && <div>Desc. USD: ${usage.discountAmountUsd.toFixed(2)}</div>}
                          {usage.discountAmountVes > 0 && <div>Desc. VES: Bs. {usage.discountAmountVes.toFixed(2)}</div>}
                          {usage.invoice && (
                            <>
                              <div>Total USD: ${usage.invoice.totalUsd.toFixed(2)}</div>
                              <div>Total VES: Bs. {usage.invoice.totalVes.toFixed(2)}</div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {code.invoices && code.invoices.length > 0 && (
                <div className="border border-gray-200 rounded-md p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">Facturas asociadas (últimas 20)</h3>
                  <div className="space-y-1 text-xs">
                    {code.invoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between border-b border-gray-100 py-1 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">#{inv.number}</span>
                          <span className="text-gray-500">{inv.status === 'cancelled' ? 'Anulada' : inv.status}</span>
                        </div>
                        <div className="text-gray-600">
                          {formatDate(inv.createdAt)} · ${inv.totalUsd.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t p-3 flex justify-end bg-white">
          <button type="button" onClick={onClose} className="px-4 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
