import { Router, Request, Response } from 'express'
import { prisma } from '../../database/prisma'
import { authMiddleware } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

async function nextInvoiceNumber(): Promise<string> {
  const now = new Date()
  const prefix = `F${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-`
  const last = await prisma.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' }
  })
  const seq = last ? parseInt(last.number.split('-')[1] || '0', 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, '0')}`
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { customer: true, items: true }
    })
    res.json({ invoices })
  } catch (error) {
    console.error('[invoices] list error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const { customerId, items, currency, exchangeRate, payments } = req.body
    if (!items || !items.length) {
      res.status(400).json({ error: 'La factura debe tener al menos un item' })
      return
    }

    const number = await nextInvoiceNumber()

    let totalUsd = 0
    let totalVes = 0
    let ivaUsd = 0
    let ivaVes = 0

    const invoiceItems = items.map((item: {
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
    })

    const invoice = await prisma.invoice.create({
      data: {
        number,
        customerId: customerId || null,
        currency: currency || 'USD',
        exchangeRate: Number(exchangeRate) || 0,
        totalUsd: Math.round(totalUsd * 100) / 100,
        totalVes: Math.round(totalVes * 100) / 100,
        ivaUsd: Math.round(ivaUsd * 100) / 100,
        ivaVes: Math.round(ivaVes * 100) / 100,
        payments: payments ? JSON.stringify(payments) : null,
        items: { create: invoiceItems }
      },
      include: { items: true, customer: true }
    })

    for (const item of items) {
      if (item.productId) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: Number(item.quantity) } }
        })
      }
    }

    res.status(201).json({ invoice })
  } catch (error) {
    console.error('[invoices] create error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
