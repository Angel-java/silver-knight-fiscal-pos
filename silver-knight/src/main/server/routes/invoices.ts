import { Router, Request, Response } from 'express'
import { prisma } from '../../database/prisma'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createInvoiceSchema, cancelInvoiceSchema } from '../validation/schemas'
import { logger } from '../utils/logger'
import { ensureDefaultControl } from './fiscalControl'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('invoices'))

async function nextControlNumber(
  documentType: string
): Promise<{ number: string; fiscalControlId: string }> {
  await ensureDefaultControl()

  return prisma.$transaction(async (tx) => {
    const control = await tx.fiscalControl.findFirst({
      where: { documentType, isActive: true }
    })
    if (!control) {
      throw new Error(
        `No hay un control fiscal activo para ${documentType}. Configúralo en Ajustes > Control Fiscal.`
      )
    }

    const nextNum = control.currentNumber + 1
    if (nextNum > control.endNumber) {
      throw new Error(
        `Rango de numeración agotado para ${documentType} (resolución ${control.resolution})`
      )
    }

    const cfNumber = `${control.prefix}${String(nextNum).padStart(10, '0')}`

    await tx.fiscalControl.update({
      where: { id: control.id },
      data: { currentNumber: nextNum }
    })

    return { number: cfNumber, fiscalControlId: control.id }
  })
}

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id as string },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, costUsd: true, costVes: true }
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
  } catch (error) {
    logger.error('invoices', 'get error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/', async (req: Request, res: Response) => {
  try {
    const documentType = req.query.documentType as string | undefined
    const status = req.query.status as string | undefined
    const search = (req.query.search as string) || ''
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = 50
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
  } catch (error) {
    logger.error('invoices', 'list error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', validate(createInvoiceSchema), async (req: Request, res: Response) => {
  try {
    const { customerId, items, currency, exchangeRate, payments, documentType } = req.body

    const docType = documentType || 'FACT'
    const { number: controlNumber, fiscalControlId } = await nextControlNumber(docType)

    const now = new Date()
    const seqPrefix = `F${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-`
    const docLabel = docType === 'FACT' ? 'F' : docType === 'NCR' ? 'NC' : 'ND'
    const number = `${docLabel}-${seqPrefix}${controlNumber.slice(-4)}`

    let totalUsd = 0
    let totalVes = 0
    let ivaUsd = 0
    let ivaVes = 0

    const invoiceItems = items.map(
      (item: {
        productId?: string
        productName: string
        quantity: number
        unitPriceUsd: number
        unitPriceVes: number
        ivaRate: number
      }) => {
        const qty = Number(item.quantity) || 1
        const lineUsd = Number(item.unitPriceUsd) * qty
        const lineVes = Number(item.unitPriceVes) * qty
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
          unitPriceUsd: Number(item.unitPriceUsd),
          unitPriceVes: Number(item.unitPriceVes),
          ivaRate,
          totalUsd: lineUsd,
          totalVes: lineVes
        }
      }
    )

    const invoice = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (item.productId) {
          const product = await tx.product.findUnique({ where: { id: item.productId } })
          if (product && product.stock < Number(item.quantity)) {
            throw new Error(
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
          exchangeRate: Number(exchangeRate) || 0,
          totalUsd: Math.round(totalUsd * 100) / 100,
          totalVes: Math.round(totalVes * 100) / 100,
          ivaUsd: Math.round(ivaUsd * 100) / 100,
          ivaVes: Math.round(ivaVes * 100) / 100,
          payments: payments ? JSON.stringify(payments) : null,
          items: { create: invoiceItems }
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
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error interno del servidor'
    logger.error('invoices', 'create error', error)
    res.status(400).json({ error: msg })
  }
})

router.patch('/:id/cancel', validate(cancelInvoiceSchema), async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    logger.error('invoices', 'cancel error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
