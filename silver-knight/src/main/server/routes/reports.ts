import { Router, Request, Response } from 'express'
import { prisma } from '../../database/prisma'
import { authMiddleware } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

router.get('/sales-daily', async (_req: Request, res: Response) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const invoices = await prisma.invoice.findMany({
      where: { createdAt: { gte: today, lt: tomorrow }, status: 'active', documentType: 'FACT' },
      orderBy: { createdAt: 'asc' },
      include: { customer: true, items: true }
    })

    const totalUsd = invoices.reduce((s, i) => s + i.totalUsd, 0)
    const totalVes = invoices.reduce((s, i) => s + i.totalVes, 0)
    const ivaUsd = invoices.reduce((s, i) => s + i.ivaUsd, 0)
    const ivaVes = invoices.reduce((s, i) => s + i.ivaVes, 0)
    const productsSold = invoices.reduce(
      (s, i) => s + i.items.reduce((si, item) => si + item.quantity, 0),
      0
    )

    const paymentsBreakdown: Record<string, { usd: number; ves: number }> = {}
    for (const inv of invoices) {
      if (!inv.payments) continue
      const payments = JSON.parse(inv.payments) as Array<{
        method: string
        amount: number
        currency: string
      }>
      for (const p of payments) {
        if (!paymentsBreakdown[p.method]) paymentsBreakdown[p.method] = { usd: 0, ves: 0 }
        if (p.currency === 'USD') paymentsBreakdown[p.method].usd += p.amount
        else paymentsBreakdown[p.method].ves += p.amount
      }
    }

    res.json({
      invoices,
      summary: {
        totalUsd,
        totalVes,
        ivaUsd,
        ivaVes,
        productsSold,
        count: invoices.length,
        paymentsBreakdown
      }
    })
  } catch (error) {
    console.error('[reports] sales-daily error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/sales-range', async (req: Request, res: Response) => {
  try {
    const from = req.query.from
      ? new Date(req.query.from as string)
      : new Date(new Date().setDate(1))
    from.setHours(0, 0, 0, 0)
    const to = req.query.to ? new Date(req.query.to as string) : new Date()
    to.setHours(23, 59, 59, 999)

    const invoices = await prisma.invoice.findMany({
      where: {
        documentType: 'FACT',
        createdAt: { gte: from, lte: to }
      },
      orderBy: { createdAt: 'asc' },
      include: { customer: true, items: true }
    })

    const activeInvoices = invoices.filter((i) => i.status === 'active')
    const cancelledInvoices = invoices.filter((i) => i.status === 'cancelled')

    const totalUsd = activeInvoices.reduce((s, i) => s + i.totalUsd, 0)
    const totalVes = activeInvoices.reduce((s, i) => s + i.totalVes, 0)
    const ivaUsd = activeInvoices.reduce((s, i) => s + i.ivaUsd, 0)
    const ivaVes = activeInvoices.reduce((s, i) => s + i.ivaVes, 0)
    const productsSold = activeInvoices.reduce(
      (s, i) => s + i.items.reduce((si, item) => si + item.quantity, 0),
      0
    )

    const usdCount = activeInvoices.filter((i) => i.currency === 'USD').length
    const vesCount = activeInvoices.filter((i) => i.currency === 'VES').length

    res.json({
      invoices,
      summary: {
        totalUsd,
        totalVes,
        ivaUsd,
        ivaVes,
        productsSold,
        count: activeInvoices.length,
        cancelledCount: cancelledInvoices.length,
        usdInvoices: usdCount,
        vesInvoices: vesCount
      }
    })
  } catch (error) {
    console.error('[reports] sales-range error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/inventory', async (_req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { category: { select: { id: true, name: true } } }
    })

    const totalValueUsd = products.reduce((s, p) => s + (p.costUsd || 0) * p.stock, 0)
    const totalValueVes = products.reduce((s, p) => s + (p.costVes || 0) * p.stock, 0)
    const totalPriceUsd = products.reduce((s, p) => s + p.priceUsd * p.stock, 0)
    const totalPriceVes = products.reduce((s, p) => s + p.priceVes * p.stock, 0)
    const lowStockCount = products.filter((p) => p.minStock > 0 && p.stock <= p.minStock).length
    const outOfStockCount = products.filter((p) => p.stock <= 0).length

    res.json({
      products,
      summary: {
        totalProducts: products.length,
        totalValueUsd,
        totalValueVes,
        totalPriceUsd,
        totalPriceVes,
        lowStockCount,
        outOfStockCount
      }
    })
  } catch (error) {
    console.error('[reports] inventory error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/top-products', async (req: Request, res: Response) => {
  try {
    const from = req.query.from ? new Date(req.query.from as string) : undefined
    const to = req.query.to ? new Date(req.query.to as string) : undefined
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)

    const where: Record<string, unknown> = {
      invoice: { status: 'active', documentType: 'FACT' }
    }
    if (from || to) {
      where.invoice = {
        ...(where.invoice as Record<string, unknown>),
        createdAt: {
          ...(from ? { gte: new Date(from.setHours(0, 0, 0, 0)) } : {}),
          ...(to ? { lte: new Date(to.setHours(23, 59, 59, 999)) } : {})
        }
      }
    }

    const items = await prisma.invoiceItem.groupBy({
      by: ['productId', 'productName'],
      where,
      _sum: { quantity: true, totalUsd: true, totalVes: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit
    })

    const top = items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      quantity: i._sum.quantity || 0,
      totalUsd: i._sum.totalUsd || 0,
      totalVes: i._sum.totalVes || 0
    }))

    const totalQty = top.reduce((s, i) => s + i.quantity, 0)
    const totalUsd = top.reduce((s, i) => s + i.totalUsd, 0)

    res.json({ top, summary: { totalQty, totalUsd, count: top.length } })
  } catch (error) {
    console.error('[reports] top-products error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/cash-close', async (req: Request, res: Response) => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0]
    const from = new Date(dateStr + 'T00:00:00')
    const to = new Date(dateStr + 'T23:59:59.999')

    const invoices = await prisma.invoice.findMany({
      where: {
        documentType: 'FACT',
        createdAt: { gte: from, lte: to }
      },
      orderBy: { createdAt: 'asc' },
      include: { customer: true }
    })

    const activeInvoices = invoices.filter((i) => i.status === 'active')
    const cancelledInvoices = invoices.filter((i) => i.status === 'cancelled')

    const totalUsd = activeInvoices.reduce((s, i) => s + i.totalUsd, 0)
    const totalVes = activeInvoices.reduce((s, i) => s + i.totalVes, 0)

    const paymentsBreakdown: Record<string, { usd: number; ves: number; count: number }> = {}
    for (const inv of activeInvoices) {
      if (!inv.payments) continue
      const payments = JSON.parse(inv.payments) as Array<{
        method: string
        amount: number
        currency: string
      }>
      for (const p of payments) {
        if (!paymentsBreakdown[p.method]) paymentsBreakdown[p.method] = { usd: 0, ves: 0, count: 0 }
        if (p.currency === 'USD') paymentsBreakdown[p.method].usd += p.amount
        else paymentsBreakdown[p.method].ves += p.amount
        paymentsBreakdown[p.method].count++
      }
    }

    res.json({
      date: dateStr,
      invoices,
      summary: {
        totalUsd,
        totalVes,
        count: activeInvoices.length,
        cancelledCount: cancelledInvoices.length,
        paymentsBreakdown
      }
    })
  } catch (error) {
    console.error('[reports] cash-close error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
