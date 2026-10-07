import { type JSX } from 'react'
import type { DiscountCode, Product, Category } from '../../lib/api'

interface DiscountCodeScopeTagsProps {
  code: DiscountCode
  productMap?: Record<string, Product>
  categoryMap?: Record<string, Category>
}

export default function DiscountCodeScopeTags({
  code,
  productMap = {},
  categoryMap = {}
}: DiscountCodeScopeTagsProps): JSX.Element {
  if (code.scope === 'ALL') {
    return <span className="text-xs text-gray-600">Todo el carrito</span>
  }

  const ids = code.scope === 'PRODUCTS' ? code.productIds || [] : code.categoryIds || []
  const map = code.scope === 'PRODUCTS' ? productMap : categoryMap
  const label = code.scope === 'PRODUCTS' ? 'Productos' : 'Categorías'

  if (ids.length === 0) {
    return <span className="text-xs text-gray-400">Sin selección</span>
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-xs text-gray-500">{label}:</span>
      {ids.slice(0, 3).map((id) => {
        const item = map[id]
        const display = item ? item.name : id.slice(0, 8)
        return (
          <span
            key={id}
            className="inline-block px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded"
            title={id}
          >
            {display}
          </span>
        )
      })}
      {ids.length > 3 && (
        <span className="text-[10px] text-gray-400">+{ids.length - 3}</span>
      )}
    </div>
  )
}
