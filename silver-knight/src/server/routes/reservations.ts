import { Router, Request, Response } from 'express'
import { prisma } from '../database/prisma'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import {
  createReservationSchema,
  addReservationPaymentSchema,
  finalizeReservationSchema,
  cancelReservationSchema
} from '../validation/schemas'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import { computeInvoiceTotals, createFiscalInvoiceFromReservation } from './invoices'
import { DEFAULT_INVOICE_PAGE_SIZE } from '../config'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('apartados'))

const round2 = (n: number): number => Math.round(n * 100) / 100

const ACTIVE_STATUSES = ['active']

async function getReservationOrThrow(id: string): Promise<{ reservation: unknown }> {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      customer: true,
      user: { select: { id: true, username: true, fullName: true } },
      items: { include: { product: { select: { id: true, name: true, code: true } } } },
      payments: { orderBy: { createdAt: 'asc' } }
    }
  })
  if (!reservation) {
    throw new AppError(404, 'Apartado no encontrado')
  }
  return { reservation }
}

async function nextReservationNumber(): Promise<string> {
  const now = new Date()
  const prefix = `AP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const last = await prisma.reservation.findFirst({
    where: { number: { startsWith: `${prefix}-` } },
    orderBy: { createdAt: 'desc' }
  })
  let seq = 1
  if (last) {
    const idx = last.number.lastIndexOf('-')
    seq = (parseInt(last.number.slice(idx + 1), 10) || 0) + 1
  }
  return `${prefix}-${String(seq).padStart(4, '0')}`
}

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined
  const search = (req.query.search as string) || ''
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = DEFAULT_INVOICE_PAGE_SIZE
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (search) {
    where.OR = [
      { number: { contains: search } },
      { customer: { is: { name: { contains: search } } } }
    ]
  }

  const [reservations, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        customer: true,
        user: { select: { id: true, username: true, fullName: true } }
      }
    }),
    prisma.reservation.count({ where })
  ])

  res.json({ reservations, total, page, pages: Math.ceil(total / limit) })
}))

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { reservation } = await getReservationOrThrow(req.params.id as string)
  res.json({ reservation })
}))

router.post('/', validate(createReservationSchema), asyncHandler(async (req: Request, res: Response) => {
  const { customerId, items, currency, exchangeRate, depositUsd, depositVes, depositMethod, dueDate, notes } = req.body

  let rate = Number(exchangeRate) || 0
  if (rate <= 0) {
    const latest = await prisma.exchangeRate.findFirst({ orderBy: { date: 'desc' } })
    if (!latest) {
      throw new AppError(
        400,
        'No hay una tasa de cambio configurada. Regístrala en Ajustes > Tasa BCV.',
        { errorCode: 'RATE_MISSING' }
      )
    }
    rate = latest.rate
  }

  const totals = computeInvoiceTotals(items, rate)
  const currencyCode = currency || 'USD'
  let deposit = round2(Number(depositUsd) || 0)
  if (deposit <= 0 && Number(depositVes) > 0 && rate > 0) {
    deposit = round2(Number(depositVes) / rate)
  }

  const number = await nextReservationNumber()

  const reservation = await prisma.$transaction(async (tx) => {
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

    if (round2(deposit) >= totals.totalUsd) {
      throw new AppError(
        400,
        'El apartado debe ser menor que el total. Para pagar todo, usa el POS.'
      )
    }

    const created = await tx.reservation.create({
      data: {
        number,
        customerId: customerId || null,
        userId: req.user?.userId || null,
        status: 'active',
        totalUsd: totals.totalUsd,
        totalVes: totals.totalVes,
        exchangeRate: rate,
        currency: currencyCode,
        amountPaidUsd: deposit,
        depositUsd: deposit,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        items: {
          create: totals.invoiceItems.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            quantity: it.quantity,
            unitPriceUsd: it.unitPriceUsd,
            unitPriceVes: it.unitPriceVes,
            ivaRate: it.ivaRate,
            totalUsd: it.totalUsd,
            totalVes: it.totalVes
          }))
        },
        payments: {
          create: {
            amountUsd: deposit,
            amountVes: round2(deposit * rate),
            method: depositMethod || 'cash',
            userId: req.user?.userId || null
          }
        }
      },
      include: { items: true, customer: true, payments: true }
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
            type: 'reserved',
            quantity: qty,
            reference: number,
            notes: 'Apartado de producto',
            userId: req.user?.userId || null
          }
        })
      }
    }

    return created
  })

  res.status(201).json({ reservation })
}))

router.post('/:id/payments', validate(addReservationPaymentSchema), asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const { amountUsd, amountVes, method, detail } = req.body

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { customer: true, user: true }
  })
  if (!reservation) {
    res.status(404).json({ error: 'Apartado no encontrado' })
    return
  }
  if (reservation.status !== 'active') {
    res.status(400).json({ error: 'El apartado no está activo' })
    return
  }

  const rate = reservation.exchangeRate
  const totalUsd = reservation.totalUsd
  const paidUsd = reservation.amountPaidUsd
  const remaining = round2(totalUsd - paidUsd)

  const amtUsd = round2(Number(amountUsd) || 0)
  const amtVes = round2(Number(amountVes) || 0)
  let convertedUsd = amtUsd
  if (amtVes > 0 && amtUsd <= 0) {
    convertedUsd = rate > 0 ? round2(amtVes / rate) : 0
  }

  if (convertedUsd <= 0) {
    res.status(400).json({ error: 'Monto de abono inválido' })
    return
  }
  if (convertedUsd > remaining) {
    res.status(400).json({
      error: `El abono ($${convertedUsd.toFixed(2)}) supera el saldo restante ($${remaining.toFixed(2)})`
    })
    return
  }

  const newPaid = round2(paidUsd + convertedUsd)

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.reservationPayment.create({
      data: {
        reservationId: id,
        amountUsd: convertedUsd,
        amountVes: round2(convertedUsd * rate),
        method: method || 'cash',
        detail: detail || null,
        userId: req.user?.userId || null
      }
    })
    await tx.reservation.update({
      where: { id },
      data: { amountPaidUsd: newPaid }
    })
    return p
  })

  const newRemaining = round2(remaining - convertedUsd)
  const finalized = newRemaining <= 0

  res.json({ payment, remaining: newRemaining, finalized })
}))

router.post('/:id/finalize', validate(finalizeReservationSchema), asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const { payments } = req.body

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { items: true }
  })
  if (!reservation) {
    res.status(404).json({ error: 'Apartado no encontrado' })
    return
  }
  if (reservation.status !== 'active') {
    res.status(400).json({ error: 'El apartado no está activo' })
    return
  }

  const remaining = round2(reservation.totalUsd - reservation.amountPaidUsd)
  if (remaining > 0) {
    res.status(400).json({
      error: `Aún falta cobrar $${remaining.toFixed(2)}. Registra más abonos o incluye el saldo en payments.`
    })
    return
  }

  const invoice = await createFiscalInvoiceFromReservation({
    customerId: reservation.customerId,
    items: reservation.items.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      unitPriceUsd: it.unitPriceUsd,
      ivaRate: it.ivaRate
    })),
    currency: reservation.currency,
    exchangeRate: reservation.exchangeRate,
    payments:
      payments && Array.isArray(payments) && payments.length > 0
        ? payments.filter((p) => p && typeof p === 'object' && 'method' in p && 'amount' in p)
        : [{ method: 'cash', amount: remaining, currency: reservation.currency }],
    userId: req.user?.userId || null
  })

  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      status: 'finalized',
      finalizedAt: new Date(),
      invoiceId: invoice.id
    },
    include: { items: true, customer: true, payments: true, invoice: true }
  })

  res.json({ reservation: updated, invoice })
}))

router.post('/:id/cancel', validate(cancelReservationSchema), asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const { reason } = req.body

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { items: true }
  })
  if (!reservation) {
    res.status(404).json({ error: 'Apartado no encontrado' })
    return
  }
  if (!ACTIVE_STATUSES.includes(reservation.status)) {
    res.status(400).json({ error: 'El apartado no está activo' })
    return
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const item of reservation.items) {
      if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        })
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: 'unreserved',
            quantity: item.quantity,
            reference: reservation.number,
            notes: reason,
            userId: req.user?.userId || null
          }
        })
      }
    }

    return tx.reservation.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: req.user?.userId || null,
        cancelReason: reason
      },
      include: { items: true, customer: true, payments: true }
    })
  })

  res.json({ reservation: updated })
}))

export default router
