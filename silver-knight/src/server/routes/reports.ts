import { Router, Request, Response } from 'express'
import { prisma } from '../database/prisma'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { parsePayments } from '../utils/payments'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('reports'))

router.get('/sales-daily', asyncHandler(async (_req: Request, res: Response) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const invoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: today, lt: tomorrow }, status: 'active', documentType: 'FACT' },
    orderBy: { createdAt: 'asc' },
    include: {
      customer: true,
      items: {
        include: {
          product: {
            select: { id: true, name: true, costUsd: true }
          }
        }
      }
    }
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
    const payments = parsePayments(inv.payments)
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
}))

router.get('/sales-range', asyncHandler(async (req: Request, res: Response) => {
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
    include: {
      customer: true,
      items: {
        include: {
          product: {
            select: { id: true, name: true, costUsd: true }
          }
        }
      }
    }
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
}))

router.get('/inventory', asyncHandler(async (_req: Request, res: Response) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: { category: { select: { id: true, name: true } } }
  })

  const totalValueUsd = products.reduce((s, p) => s + (p.costUsd || 0) * p.stock, 0)
  const totalPriceUsd = products.reduce((s, p) => s + p.priceUsd * p.stock, 0)
  const lowStockCount = products.filter((p) => p.minStock > 0 && p.stock <= p.minStock).length
  const outOfStockCount = products.filter((p) => p.stock <= 0).length

  res.json({
    products,
    summary: {
      totalProducts: products.length,
      totalValueUsd,
      totalPriceUsd,
      lowStockCount,
      outOfStockCount
    }
  })
}))

router.get('/top-products', asyncHandler(async (req: Request, res: Response) => {
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

  const items = await prisma.invoiceItem.findMany({
    where,
    include: {
      product: {
        select: { id: true, name: true, costUsd: true }
      }
    }
  })

  const grouped = new Map<string, {
    productId: string | null
    productName: string
    quantity: number
    totalUsd: number
    totalVes: number
    costUsd: number
  }>()

  for (const item of items) {
    const key = item.productId || item.productName
    if (!grouped.has(key)) {
      grouped.set(key, {
        productId: item.productId,
        productName: item.productName,
        quantity: 0,
        totalUsd: 0,
        totalVes: 0,
        costUsd: 0
      })
    }
    const g = grouped.get(key)!
    g.quantity += item.quantity
    g.totalUsd += item.totalUsd
    g.totalVes += item.totalVes
    g.costUsd += (item.product?.costUsd || 0) * item.quantity
  }

  const top = Array.from(grouped.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit)

  const totalQty = top.reduce((s, i) => s + i.quantity, 0)
  const totalUsd = top.reduce((s, i) => s + i.totalUsd, 0)
  const totalCost = top.reduce((s, i) => s + i.costUsd, 0)

  res.json({ top, summary: { totalQty, totalUsd, totalCost, count: top.length } })
}))

router.get('/cash-close', asyncHandler(async (req: Request, res: Response) => {
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
    const payments = parsePayments(inv.payments)
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
}))

export default router
