import { Router, Request, Response } from 'express'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { logger } from '../utils/logger'
import { getAvailablePrinters, printInvoice } from '../printer'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('invoices'))

router.get('/printers', async (_req: Request, res: Response) => {
  try {
    const printers = await getAvailablePrinters()
    res.json({ printers })
  } catch (error) {
    logger.error('print', 'list printers error', error)
    res.status(500).json({ error: 'Error al listar impresoras' })
  }
})

router.post('/invoice/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    await printInvoice(id)
    res.json({ ok: true })
  } catch (error) {
    logger.error('print', 'invoice error', error)
    const msg = error instanceof Error ? error.message : 'Error al imprimir'
    res.status(500).json({ error: msg })
  }
})

export default router
