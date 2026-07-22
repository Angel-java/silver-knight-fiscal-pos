import { Router, Request, Response } from 'express'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { getAvailablePrinters, printInvoice } from '../printer'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('invoices'))

router.get('/printers', asyncHandler(async (_req: Request, res: Response) => {
  const printers = await getAvailablePrinters()
  res.json({ printers })
}))

router.post('/invoice/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id)
  await printInvoice(id)
  res.json({ ok: true })
}))

export default router
