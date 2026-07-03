import { Router, Request, Response } from 'express'
import { prisma } from '../../database/prisma'
import { authMiddleware } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const invoicesToday = await prisma.invoice.findMany({
      where: { createdAt: { gte: today, lt: tomorrow }, status: 'active' }
    })

    const totalUsd = invoicesToday.reduce((s, inv) => s + inv.totalUsd, 0)
    const totalVes = invoicesToday.reduce((s, inv) => s + inv.totalVes, 0)
    const totalIvaUsd = invoicesToday.reduce((s, inv) => s + inv.ivaUsd, 0)
    const totalIvaVes = invoicesToday.reduce((s, inv) => s + inv.ivaVes, 0)

    const itemsToday = await prisma.invoiceItem.findMany({
      where: { invoice: { createdAt: { gte: today, lt: tomorrow }, status: 'active' } }
    })
    const productsSold = itemsToday.reduce((s, item) => s + item.quantity, 0)

    res.json({
      summary: {
        invoicesCount: invoicesToday.length,
        totalUsd: Math.round(totalUsd * 100) / 100,
        totalVes: Math.round(totalVes * 100) / 100,
        ivaUsd: Math.round(totalIvaUsd * 100) / 100,
        ivaVes: Math.round(totalIvaVes * 100) / 100,
        productsSold
      }
    })
  } catch (error) {
    console.error('[dashboard] summary error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
