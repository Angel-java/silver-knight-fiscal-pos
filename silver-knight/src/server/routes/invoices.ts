import { Router, Request, Response } from 'express'
import { prisma } from '../database/prisma'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createInvoiceSchema, cancelInvoiceSchema } from '../validation/schemas'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { nextControlNumber, buildInvoiceNumber } from '../utils/controlNumbers'
import { DEFAULT_INVOICE_PAGE_SIZE } from '../config'
import { getActiveExchangeRate } from '../utils/rateResolver'
import { validateDiscountCode, calculateDiscountedTotals } from '../utils/discounts'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('invoices'))

export interface CreateInvoiceLine {
  productId?: string | null
  productName: string
  quantity: number
  unitPriceUsd: number
  ivaRate: number
}

export interface InvoiceTotals {
  invoiceItems: Array<{
    productId: string | null
    productName: string
    quantity: number
    unitPriceUsd: number
    unitPriceVes: number
    ivaRate: number
    totalUsd: number
    totalVes: number
  }>
  subtotalUsd: number
  subtotalVes: number
  ivaUsd: number
  ivaVes: number
  totalUsd: number
  totalVes: number
  discountValue: number | null
  discountAmountUsd: number
  discountAmountVes: number
}

export function computeInvoiceTotals(
  items: CreateInvoiceLine[],
  rate: number,
  discount?: { discountValue: number; maxDiscountAmount?: number | null } | null
): InvoiceTotals {
  let subtotalUsd = 0
  let subtotalVes = 0
  let ivaUsd = 0
  let ivaVes = 0

  const round2 = (n: number): number => Math.round(n * 100) / 100

  const invoiceItems = items.map((item) => {
    const qty = Number(item.quantity) || 1
    const unitPriceUsd = Number(item.unitPriceUsd) || 0
    const unitPriceVes = round2(unitPriceUsd * rate)
    const lineUsd = unitPriceUsd * qty
    const lineVes = unitPriceVes * qty
    const ivaRate = Number(item.ivaRate) || 0
    const lineIvaUsd = lineUsd * (ivaRate / 100)
    const lineIvaVes = lineVes * (ivaRate / 100)
    subtotalUsd += lineUsd
    subtotalVes += lineVes
    ivaUsd += lineIvaUsd
    ivaVes += lineIvaVes
    return {
      productId: item.productId || null,
      productName: item.productName,
      quantity: qty,
      unitPriceUsd,
      unitPriceVes,
      ivaRate,
      totalUsd: lineUsd,
      totalVes: lineVes
    }
  })

  subtotalUsd = round2(subtotalUsd)
  subtotalVes = round2(subtotalVes)
  ivaUsd = round2(ivaUsd)
  ivaVes = round2(ivaVes)

  let discountValue: number | null = null
  let discountAmountUsd = 0
  let discountAmountVes = 0
  let totalUsd = round2(subtotalUsd + ivaUsd)
  let totalVes = round2(subtotalVes + ivaVes)

  if (discount && discount.discountValue > 0) {
    discountValue = discount.discountValue
    const discounted = calculateDiscountedTotals({
      subtotalUsd,
      subtotalVes,
      ivaUsd,
      ivaVes,
      discountValue: discount.discountValue,
      maxDiscountAmount: discount.maxDiscountAmount,
      exchangeRate: rate
    })
    discountAmountUsd = discounted.discountAmountUsd
    discountAmountVes = discounted.discountAmountVes
    ivaUsd = discounted.ivaAfterDiscountUsd
    ivaVes = discounted.ivaAfterDiscountVes
    totalUsd = discounted.totalUsd
    totalVes = discounted.totalVes
  }

  return {
    invoiceItems,
    subtotalUsd,
    subtotalVes,
    ivaUsd,
    ivaVes,
    totalUsd,
    totalVes,
    discountValue,
    discountAmountUsd,
    discountAmountVes
  }
}

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id as string },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, costUsd: true }
          }
        }
      },
      customer: true
    }
  })
  if (!invoice) {
    res.status(404).json({ error: 'Factura no encontrada' })
    return
  }
  res.json({ invoice })
}))

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const documentType = req.query.documentType as string | undefined
  const status = req.query.status as string | undefined
  const search = (req.query.search as string) || ''
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = DEFAULT_INVOICE_PAGE_SIZE
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (documentType) where.documentType = documentType
  if (status) where.status = status
  if (search) {
    where.OR = [{ number: { contains: search } }, { controlNumber: { contains: search } }]
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { customer: true, items: true }
    }),
    prisma.invoice.count({ where })
  ])
  res.json({ invoices, total, page, pages: Math.ceil(total / limit) })
}))

router.post('/', validate(createInvoiceSchema), asyncHandler(async (req: Request, res: Response) => {
  const { customerId, items, currency, exchangeRate, payments, documentType, discountCodeId } = req.body

  let rate = Number(exchangeRate) || 0
  if (rate <= 0) {
    // Regla de tasa (data-driven): activa = captura más reciente; `old` = ya pasó el
    // fin del día de la fecha de la tasa (BCV/DolarAPI o la elegida al ingresar
    // manual). `old` es informativo y NUNCA bloquea: solo se bloquea con RATE_MISSING
    // (cero tasas). El valor confirmado en el panel (body exchangeRate) es autoritativo.
    const resolved = await getActiveExchangeRate()
    if (!resolved.rate) {
      throw new AppError(
        400,
        'No hay una tasa de cambio configurada. Regístrala en Ajustes > Tasa BCV.',
        { errorCode: 'RATE_MISSING' }
      )
    }
    rate = resolved.rate.rate
  }

  const docType = documentType || 'FACT'
  const { number: controlNumber, fiscalControlId } = await nextControlNumber(docType)
  const number = buildInvoiceNumber(docType, controlNumber)

  const invoiceCurrency = currency || 'USD'

  const invoice = await prisma.$transaction(async (tx) => {
    let discountCode: Awaited<ReturnType<typeof tx.discountCode.findUnique>> = null
    let discountInput: { discountValue: number; maxDiscountAmount?: number | null } | null = null

    if (discountCodeId) {
      discountCode = await tx.discountCode.findUnique({ where: { id: discountCodeId } })
      if (!discountCode || discountCode.deletedAt) {
        throw new AppError(400, 'Código de descuento no encontrado', { errorCode: 'NOT_FOUND' })
      }

      // Re-validar dentro de la transacción para evitar race conditions
      const subtotal = items.reduce(
        (s: number, i: CreateInvoiceLine) => s + Number(i.unitPriceUsd || 0) * Number(i.quantity || 1) * (invoiceCurrency === 'VES' ? rate : 1),
        0
      )
      const quantity = items.reduce((s: number, i: CreateInvoiceLine) => s + Number(i.quantity || 1), 0)

      const validated = await validateDiscountCode({
        code: discountCode.code,
        customerId: customerId || null,
        currency: invoiceCurrency,
        subtotal,
        quantity,
        items: items.map((i: CreateInvoiceLine) => ({
          productId: i.productId || null,
          quantity: Number(i.quantity || 1),
          subtotalLine: Number(i.unitPriceUsd || 0) * Number(i.quantity || 1) * (invoiceCurrency === 'VES' ? rate : 1)
        }))
      })

      discountInput = {
        discountValue: validated.discountValue,
        maxDiscountAmount: discountCode.maxDiscountAmount
      }
    }

    const totals = computeInvoiceTotals(items, rate, discountInput)

    for (const item of items) {
      if (item.productId) {
        const product = await tx.product.findUnique({ where: { id: item.productId } })
        if (product && product.stock < Number(item.quantity)) {
          throw new AppError(
            400,
            `Stock insuficiente para "${product.name}": disponible ${product.stock}, requerido ${item.quantity}`
          )
        }
      }
    }

    const inv = await tx.invoice.create({
      data: {
        number,
        documentType: docType,
        controlNumber,
        fiscalControlId,
        customerId: customerId || null,
        userId: req.user?.userId || null,
        currency: invoiceCurrency,
        exchangeRate: rate,
        totalUsd: totals.totalUsd,
        totalVes: totals.totalVes,
        ivaUsd: totals.ivaUsd,
        ivaVes: totals.ivaVes,
        discountCodeId: discountCode?.id || null,
        discountValue: totals.discountValue,
        discountAmountUsd: totals.discountAmountUsd,
        discountAmountVes: totals.discountAmountVes,
        payments: payments ? JSON.stringify(payments) : null,
        items: { create: totals.invoiceItems }
      },
      include: { items: true, customer: true, fiscalControl: true }
    })

    if (discountCode) {
      await tx.discountCode.update({
        where: { id: discountCode.id },
        data: { usedCount: { increment: 1 } }
      })
      await tx.discountUsage.create({
        data: {
          discountCodeId: discountCode.id,
          customerId: customerId || null,
          invoiceId: inv.id,
          discountAmountUsd: totals.discountAmountUsd,
          discountAmountVes: totals.discountAmountVes
        }
      })
    }

    for (const item of items) {
      if (item.productId) {
        const qty = Number(item.quantity)
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: qty } }
        })
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: 'sale',
            quantity: qty,
            reference: number,
            userId: null
          }
        })
      }
    }

    return inv
  })

  res.status(201).json({ invoice })
}))

export interface FinalizeInvoiceInput {
  customerId?: string | null
  items: CreateInvoiceLine[]
  currency?: string
  exchangeRate: number
  payments?: Array<{ method: string; amount: number; currency: string; approvalCode?: string | null }> | null
  userId?: string | null
}

// Crea una factura fiscal SIN volver a decrementar stock ni crear movimientos de
// venta. Se usa cuando el stock ya fue reservado por un apartado (reservation).
export async function createFiscalInvoiceFromReservation(
  input: FinalizeInvoiceInput
): Promise<Awaited<ReturnType<typeof prisma.invoice.create>>> {
  const docType = 'FACT'
  const { number: controlNumber, fiscalControlId } = await nextControlNumber(docType)
  const number = buildInvoiceNumber(docType, controlNumber)

  const totals = computeInvoiceTotals(input.items, input.exchangeRate)

  return prisma.$transaction(async (tx) => {
    return tx.invoice.create({
      data: {
        number,
        documentType: docType,
        controlNumber,
        fiscalControlId,
        customerId: input.customerId || null,
        userId: input.userId || null,
        currency: input.currency || 'USD',
        exchangeRate: input.exchangeRate,
        totalUsd: totals.totalUsd,
        totalVes: totals.totalVes,
        ivaUsd: totals.ivaUsd,
        ivaVes: totals.ivaVes,
        payments: input.payments ? JSON.stringify(input.payments) : null,
        items: { create: totals.invoiceItems }
      },
      include: { items: true, customer: true, fiscalControl: true }
    })
  })
}

router.patch('/:id/cancel', validate(cancelInvoiceSchema), asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const { reason } = req.body

  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) {
    res.status(404).json({ error: 'Factura no encontrada' })
    return
  }
  if (invoice.status !== 'active') {
    res.status(400).json({ error: 'La factura ya está anulada' })
    return
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status: 'cancelled',
      cancelReason: reason.trim(),
      cancelledAt: new Date()
    },
    include: { items: true, customer: true }
  })

  for (const item of updated.items) {
    if (item.productId) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } }
      })
      await prisma.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: 'cancellation',
          quantity: item.quantity,
          reference: updated.number,
          notes: reason
        }
      })
    }
  }

  res.json({ invoice: updated })
}))

export default router
