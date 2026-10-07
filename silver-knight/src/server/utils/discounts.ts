import crypto from 'crypto'
import { prisma } from '../database/prisma'
import { AppError } from '../middleware/errorHandler'

export type DiscountScope = 'ALL' | 'PRODUCTS' | 'CATEGORIES'
export type DiscountCurrency = 'USD' | 'VES'

export interface DiscountValidationContext {
  code: string
  customerId?: string | null
  currency: DiscountCurrency
  subtotal: number
  quantity: number
  items?: Array<{
    productId?: string | null
    categoryId?: string | null
    quantity: number
    subtotalLine: number
  }>
}

export interface ValidatedDiscount {
  discountCodeId: string
  code: string
  description: string | null
  discountValue: number
  discountAmountUsd: number
  discountAmountVes: number
  subtotalAfterDiscountUsd: number
  subtotalAfterDiscountVes: number
}

export interface DiscountCalculationInput {
  subtotalUsd: number
  subtotalVes: number
  ivaUsd: number
  ivaVes: number
  discountValue: number
  maxDiscountAmount?: number | null
  exchangeRate: number
}

export interface DiscountCalculationOutput {
  discountAmountUsd: number
  discountAmountVes: number
  subtotalAfterDiscountUsd: number
  subtotalAfterDiscountVes: number
  ivaAfterDiscountUsd: number
  ivaAfterDiscountVes: number
  totalUsd: number
  totalVes: number
}

const round2 = (n: number): number => Math.round(n * 100) / 100

export function generateRandomCode(
  prefix = '',
  length = 8,
  separator = '',
  groups = 2
): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const groupSize = Math.max(2, Math.floor(length / groups))
  const parts: string[] = []
  let remaining = length

  for (let g = 0; g < groups && remaining > 0; g++) {
    const size = g === groups - 1 ? remaining : Math.min(groupSize, remaining)
    let part = ''
    for (let i = 0; i < size; i++) {
      part += chars.charAt(crypto.randomInt(chars.length))
    }
    parts.push(part)
    remaining -= size
  }

  const code = parts.join(separator || '')
  return prefix ? `${prefix}${separator || ''}${code}` : code
}

export async function generateUniqueDiscountCode(
  prefix?: string,
  length = 8,
  separator?: string,
  groups = 2
): Promise<string> {
  let attempts = 0
  while (attempts < 20) {
    const code = generateRandomCode(prefix, length, separator, groups).toUpperCase()
    const exists = await prisma.discountCode.findUnique({ where: { code } })
    if (!exists) return code
    attempts++
  }
  throw new AppError(500, 'No se pudo generar un código único')
}

/**
 * Genera `count` códigos únicos en lote. Verifica colisiones contra la BD
 * en consultas agrupadas para mantener el rendimiento con cantidades grandes.
 */
export async function generateUniqueDiscountCodeBatch(
  count: number,
  prefix?: string,
  length = 8,
  separator?: string,
  groups = 2
): Promise<string[]> {
  const selected: string[] = []
  const selectedSet = new Set<string>()
  let guard = 0

  while (selected.length < count && guard < 50) {
    guard++
    const remaining = count - selected.length
    const batchSize = Math.ceil(remaining * 1.5) + 10
    const candidates = new Set<string>()
    for (let i = 0; i < batchSize; i++) {
      candidates.add(generateRandomCode(prefix, length, separator, groups).toUpperCase())
    }
    const list = [...candidates].filter((c) => !selectedSet.has(c))
    if (list.length === 0) continue

    const existing = await prisma.discountCode.findMany({
      where: { code: { in: list } },
      select: { code: true }
    })
    const existingSet = new Set(existing.map((e) => e.code))

    for (const code of list) {
      if (selected.length >= count) break
      if (existingSet.has(code)) continue
      selected.push(code)
      selectedSet.add(code)
    }
  }

  if (selected.length < count) {
    throw new AppError(500, 'No se pudieron generar suficientes códigos únicos. Amplía la longitud del código.')
  }

  return selected
}

function eligibleSubtotal(
  scope: DiscountScope,
  productIds: unknown,
  categoryIds: unknown,
  items?: DiscountValidationContext['items']
): { eligibleUsd: number; eligibleVes: number; eligibleQuantity: number } {
  if (scope === 'ALL' || !items || items.length === 0) {
    return { eligibleUsd: 0, eligibleVes: 0, eligibleQuantity: 0 } // 0 indica que use el total del contexto
  }

  const pIds = new Set(Array.isArray(productIds) ? productIds.map(String) : [])
  const cIds = new Set(Array.isArray(categoryIds) ? categoryIds.map(String) : [])

  let eligibleUsd = 0
  let eligibleVes = 0
  let eligibleQuantity = 0

  for (const item of items) {
    const productMatch = pIds.size > 0 && item.productId ? pIds.has(item.productId) : false
    const categoryMatch = cIds.size > 0 && item.categoryId ? cIds.has(item.categoryId) : false
    if (productMatch || categoryMatch) {
      eligibleUsd += item.subtotalLine
      eligibleVes += item.subtotalLine
      eligibleQuantity += item.quantity
    }
  }

  return { eligibleUsd, eligibleVes, eligibleQuantity }
}

export async function validateDiscountCode(
  context: DiscountValidationContext
): Promise<ValidatedDiscount> {
  const now = new Date()
  const code = context.code.trim().toUpperCase()

  const discountCode = await prisma.discountCode.findUnique({ where: { code } })

  if (!discountCode) {
    throw new AppError(404, 'Código de descuento no encontrado', { errorCode: 'NOT_FOUND' })
  }

  if (discountCode.deletedAt) {
    throw new AppError(400, 'Código de descuento no válido', { errorCode: 'DELETED' })
  }

  if (!discountCode.isActive) {
    throw new AppError(400, 'Código de descuento inactivo', { errorCode: 'INACTIVE' })
  }

  if (discountCode.validFrom && now < discountCode.validFrom) {
    throw new AppError(400, `El código será válido desde ${discountCode.validFrom.toLocaleDateString('es-VE')}`, {
      errorCode: 'NOT_YET_VALID'
    })
  }

  if (discountCode.validUntil && now > discountCode.validUntil) {
    throw new AppError(400, `El código expiró el ${discountCode.validUntil.toLocaleDateString('es-VE')}`, {
      errorCode: 'EXPIRED'
    })
  }

  if (discountCode.usageLimit !== null && discountCode.usedCount >= discountCode.usageLimit) {
    throw new AppError(400, 'Código agotado', { errorCode: 'USAGE_LIMIT_EXCEEDED' })
  }

  if (discountCode.requireCustomer && !context.customerId) {
    throw new AppError(400, 'Este código requiere un cliente seleccionado', { errorCode: 'CUSTOMER_REQUIRED' })
  }

  if (discountCode.usagePerCustomer !== null && discountCode.usagePerCustomer > 0 && context.customerId) {
    const customerUses = await prisma.discountUsage.count({
      where: {
        discountCodeId: discountCode.id,
        customerId: context.customerId
      }
    })
    if (customerUses >= discountCode.usagePerCustomer) {
      throw new AppError(400, 'Cliente ya usó este código el máximo de veces permitido', {
        errorCode: 'CUSTOMER_USAGE_LIMIT_EXCEEDED'
      })
    }
  }

  const { eligibleUsd, eligibleQuantity } = eligibleSubtotal(
    discountCode.scope as DiscountScope,
    discountCode.productIds,
    discountCode.categoryIds,
    context.items
  )

  const effectiveSubtotal = discountCode.scope === 'ALL' ? context.subtotal : eligibleUsd
  const effectiveQuantity = discountCode.scope === 'ALL' ? context.quantity : eligibleQuantity

  if (discountCode.minSubtotal !== null && discountCode.minSubtotal > 0) {
    // El frontend envía el subtotal en la moneda de la factura.
    // Si la moneda del código difiere, el operador debe asegurar equivalencia.
    if (effectiveSubtotal < discountCode.minSubtotal) {
      throw new AppError(400, `Monto mínimo requerido: ${discountCode.minSubtotal.toFixed(2)} ${discountCode.currency}`, {
        errorCode: 'MIN_SUBTOTAL_NOT_MET',
        minSubtotal: discountCode.minSubtotal,
        currency: discountCode.currency
      })
    }
  }

  if (discountCode.minQuantity !== null && discountCode.minQuantity > 0) {
    if (effectiveQuantity < discountCode.minQuantity) {
      throw new AppError(400, `Cantidad mínima requerida: ${discountCode.minQuantity} unidades`, {
        errorCode: 'MIN_QUANTITY_NOT_MET',
        minQuantity: discountCode.minQuantity
      })
    }
  }

  if (discountCode.scope !== 'ALL' && effectiveSubtotal <= 0) {
    throw new AppError(400, 'Ningún producto del carrito aplica para este código', { errorCode: 'NO_ELIGIBLE_ITEMS' })
  }

  // Calcular montos de descuento (asumimos subtotal y moneda del contexto)
  const percent = discountCode.discountValue / 100
  const discountAmount = round2(effectiveSubtotal * percent)
  const maxAmount = discountCode.maxDiscountAmount
  const finalDiscountAmount = maxAmount !== null && maxAmount > 0 && discountAmount > maxAmount ? maxAmount : discountAmount

  const discountAmountUsd = context.currency === 'USD' ? finalDiscountAmount : 0
  const discountAmountVes = context.currency === 'VES' ? finalDiscountAmount : 0

  return {
    discountCodeId: discountCode.id,
    code: discountCode.code,
    description: discountCode.description,
    discountValue: discountCode.discountValue,
    discountAmountUsd,
    discountAmountVes,
    subtotalAfterDiscountUsd: round2(context.subtotal - (context.currency === 'USD' ? finalDiscountAmount : 0)),
    subtotalAfterDiscountVes: round2(context.subtotal - (context.currency === 'VES' ? finalDiscountAmount : 0))
  }
}

export function calculateDiscountedTotals(
  input: DiscountCalculationInput
): DiscountCalculationOutput {
  const percent = input.discountValue / 100
  const discountAmountBaseUsd = input.subtotalUsd * percent
  const discountAmountBaseVes = input.subtotalVes * percent

  const maxAmount = input.maxDiscountAmount ?? 0
  let discountAmountUsd = discountAmountBaseUsd
  let discountAmountVes = discountAmountBaseVes

  if (maxAmount > 0) {
    // El tope se aplica en la moneda principal de la factura; asumimos VES por defecto.
    // Para mantener dualidad, convertimos usando la tasa si es necesario.
    const maxUsd = maxAmount / (input.exchangeRate || 1)
    if (discountAmountUsd > maxUsd) discountAmountUsd = maxUsd
    if (discountAmountVes > maxAmount) discountAmountVes = maxAmount
  }

  discountAmountUsd = round2(discountAmountUsd)
  discountAmountVes = round2(discountAmountVes)

  const subtotalAfterDiscountUsd = round2(input.subtotalUsd - discountAmountUsd)
  const subtotalAfterDiscountVes = round2(input.subtotalVes - discountAmountVes)

  // Ajuste proporcional del IVA sobre la base descontada
  const ivaAfterDiscountUsd = input.subtotalUsd > 0
    ? round2(input.ivaUsd * (subtotalAfterDiscountUsd / input.subtotalUsd))
    : 0
  const ivaAfterDiscountVes = input.subtotalVes > 0
    ? round2(input.ivaVes * (subtotalAfterDiscountVes / input.subtotalVes))
    : 0

  return {
    discountAmountUsd,
    discountAmountVes,
    subtotalAfterDiscountUsd,
    subtotalAfterDiscountVes,
    ivaAfterDiscountUsd,
    ivaAfterDiscountVes,
    totalUsd: round2(subtotalAfterDiscountUsd + ivaAfterDiscountUsd),
    totalVes: round2(subtotalAfterDiscountVes + ivaAfterDiscountVes)
  }
}
