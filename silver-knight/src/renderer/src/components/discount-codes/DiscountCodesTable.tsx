import { type JSX } from 'react'
import type { DiscountCode } from '../../lib/api'
import DiscountCodeStatusBadge from './DiscountCodeStatusBadge'
import DiscountCodeScopeTags from './DiscountCodeScopeTags'

interface DiscountCodesTableProps {
  codes: DiscountCode[]
  loading: boolean
  canManage: boolean
  copiedCode: string | null
  togglingId: string | null
  onCopy: (code: string) => void
  onToggleActive: (code: DiscountCode) => void
  onEdit: (code: DiscountCode) => void
  onDelete: (id: string) => void
  onView: (id: string) => void
  onTest: (code: string) => void
}

const formatDate = (d: string | null): string => {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-VE')
}

export default function DiscountCodesTable({
  codes,
  loading,
  canManage,
  copiedCode,
  togglingId,
  onCopy,
  onToggleActive,
  onEdit,
  onDelete,
  onView,
  onTest
}: DiscountCodesTableProps): JSX.Element {
  return (
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
              const usagePct = c.usageLimit !== null ? Math.min(100, Math.round((c.usedCount / c.usageLimit) * 100)) : null
              return (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{c.code}</span>
                      <button
                        onClick={() => onCopy(c.code)}
                        title="Copiar código"
                        className="text-gray-400 hover:text-gray-600 text-xs"
                      >
                        {copiedCode === c.code ? '✓' : '⧉'}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">{c.description || '-'}</td>
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
                  <td className="px-4 py-3 text-xs text-gray-600">
                    <DiscountCodeScopeTags code={c} />
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {c.usageLimit !== null ? (
                      <span title={`${usagePct}% del límite consumido`}>
                        {c.usedCount}/{c.usageLimit}
                      </span>
                    ) : (
                      `${c.usedCount} / ∞`
                    )}
                    {c.usagePerCustomer !== null && (
                      <span className="block text-[10px] text-gray-400">{c.usagePerCustomer}/cliente</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <DiscountCodeStatusBadge code={c} />
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right text-sm whitespace-nowrap">
                      <button onClick={() => onView(c.id)} className="text-gray-600 hover:text-gray-800 mr-2" title="Ver detalles">
                        Detalles
                      </button>
                      <button onClick={() => onTest(c.code)} className="text-gray-600 hover:text-gray-800 mr-2" title="Probar código">
                        Probar
                      </button>
                      <button
                        onClick={() => onToggleActive(c)}
                        disabled={togglingId === c.id}
                        className={`mr-2 text-xs px-2 py-1 rounded-md border transition-colors disabled:opacity-50 ${
                          c.isActive
                            ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                            : 'border-green-300 text-green-700 hover:bg-green-50'
                        }`}
                      >
                        {togglingId === c.id ? '...' : c.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => onEdit(c)} className="text-blue-600 hover:text-blue-800 mr-2">
                        Editar
                      </button>
                      <button onClick={() => onDelete(c.id)} className="text-red-600 hover:text-red-800">
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
    </div>
  )
}
