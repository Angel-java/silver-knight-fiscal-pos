import { Router, Request, Response } from 'express'
import { prisma } from '../database/prisma'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('iva-books'))

router.get('/ventas', asyncHandler(async (req: Request, res: Response) => {
  const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().setDate(1))
  const to = req.query.to ? new Date(req.query.to as string) : new Date()

  const invoices = await prisma.invoice.findMany({
    where: {
      documentType: 'FACT',
      status: 'active',
      createdAt: { gte: from, lte: to }
    },
    orderBy: { createdAt: 'asc' },
    include: { customer: true, items: true }
  })

  const totalUsd = invoices.reduce((s, i) => s + i.totalUsd, 0)
  const totalVes = invoices.reduce((s, i) => s + i.totalVes, 0)
  const ivaUsd = invoices.reduce((s, i) => s + i.ivaUsd, 0)
  const ivaVes = invoices.reduce((s, i) => s + i.ivaVes, 0)

  res.json({ invoices, summary: { totalUsd, totalVes, ivaUsd, ivaVes, count: invoices.length } })
}))

router.get('/compras', asyncHandler(async (req: Request, res: Response) => {
  const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().setDate(1))
  const to = req.query.to ? new Date(req.query.to as string) : new Date()

  const invoices = await prisma.invoice.findMany({
    where: {
      documentType: { in: ['FACT', 'NCR', 'NDB'] },
      createdAt: { gte: from, lte: to }
    },
    orderBy: { createdAt: 'asc' },
    include: { customer: true, items: true }
  })

  res.json({ invoices, summary: { count: invoices.length } })
}))

export default router
