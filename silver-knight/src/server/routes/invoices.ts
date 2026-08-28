import { Router, Request, Response } from 'express'
import { prisma } from '../database/prisma'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createInvoiceSchema, cancelInvoiceSchema } from '../validation/schemas'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { nextControlNumber, buildInvoiceNumber } from '../utils/controlNumbers'
import { DEFAULT_INVOICE_PAGE_SIZE } from '../config'
import { parseVigencyDays } from '../utils/rateSettings'

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

export function computeInvoiceTotals(
  items: CreateInvoiceLine[],
  rate: number
): {
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
  totalUsd: number
  totalVes: number
  ivaUsd: number
  ivaVes: number
} {
  let totalUsd = 0
  let totalVes = 0
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
    totalUsd += lineUsd
    totalVes += lineVes
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

  return {
    invoiceItems,
    totalUsd: Math.round(totalUsd * 100) / 100,
    totalVes: Math.round(totalVes * 100) / 100,
    ivaUsd: Math.round(ivaUsd * 100) / 100,
    ivaVes: Math.round(ivaVes * 100) / 100
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
  const { customerId, items, currency, exchangeRate, payments, documentType } = req.body

  let rate = Number(exchangeRate) || 0
  if (rate <= 0) {
    const [latest, settings] = await Promise.all([
      prisma.exchangeRate.findFirst({ orderBy: { date: 'desc' } }),
      prisma.setting.findMany()
    ])
    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value
    const vigencyDays = parseVigencyDays(map['bcvRateVigencyDays'])

    if (latest) {
      const ageDays = (Date.now() - new Date(latest.date).getTime()) / (24 * 60 * 60 * 1000)
      if (ageDays <= vigencyDays) {
        rate = latest.rate
      } else {
        throw new AppError(
          400,
          `La tasa de cambio registrada (${latest.rate.toFixed(2)} Bs/USD) ya no está en vigencia ` +
            `(${vigencyDays} día(s)). Regístrala de nuevo en Ajustes > Tasa BCV.`,
          { errorCode: 'RATE_EXPIRED' }
        )
      }
    }

    if (rate <= 0) {
      throw new AppError(
        400,
        'No hay una tasa de cambio configurada. Regístrala en Ajustes > Tasa BCV.',
        { errorCode: 'RATE_MISSING' }
      )
    }
  }

  const docType = documentType || 'FACT'
  const { number: controlNumber, fiscalControlId } = await nextControlNumber(docType)
  const number = buildInvoiceNumber(docType, controlNumber)

  const totals = computeInvoiceTotals(items, rate)

  const invoice = await prisma.$transaction(async (tx) => {
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
        currency: currency || 'USD',
        exchangeRate: rate,
        totalUsd: totals.totalUsd,
        totalVes: totals.totalVes,
        ivaUsd: totals.ivaUsd,
        ivaVes: totals.ivaVes,
        payments: payments ? JSON.stringify(payments) : null,
        items: { create: totals.invoiceItems }
      },
      include: { items: true, customer: true, fiscalControl: true }
    })

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
