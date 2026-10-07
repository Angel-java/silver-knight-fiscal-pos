import { type JSX } from 'react'
import type { DiscountCode } from '../../lib/api'

interface DiscountCodeStatusBadgeProps {
  code: DiscountCode
  className?: string
}

export default function DiscountCodeStatusBadge({
  code,
  className = ''
}: DiscountCodeStatusBadgeProps): JSX.Element {
  const now = new Date()

  let text = 'Activo'
  let style = 'bg-green-100 text-green-700'

  if (code.deletedAt) {
    text = 'Eliminado'
    style = 'bg-gray-100 text-gray-500'
  } else if (!code.isActive) {
    text = 'Inactivo'
    style = 'bg-yellow-100 text-yellow-700'
  } else if (code.validFrom && new Date(code.validFrom) > now) {
    text = 'Programado'
    style = 'bg-blue-100 text-blue-700'
  } else if (code.validUntil && new Date(code.validUntil) < now) {
    text = 'Expirado'
    style = 'bg-red-100 text-red-700'
  } else if (code.usageLimit !== null && code.usedCount >= code.usageLimit) {
    text = 'Agotado'
    style = 'bg-orange-100 text-orange-700'
  }

  return (
    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${style} ${className}`}>
      {text}
    </span>
  )
}
