import { Router, Request, Response } from 'express'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { puntoVentaService } from '../puntoVenta'

const router = Router()
router.use(authMiddleware)

router.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  await puntoVentaService.loadConfig()
  res.json({
    connected: puntoVentaService.isConnected,
    connecting: puntoVentaService.isConnecting,
    config: puntoVentaService.currentConfig
  })
}))

router.get('/ports', asyncHandler(async (_req: Request, res: Response) => {
  const ports = await puntoVentaService.listAvailablePorts()
  res.json({ ports })
}))

router.post('/connect', requirePermission('settings'), asyncHandler(async (req: Request, res: Response) => {
  const { port, baudRate } = req.body
  const config = await puntoVentaService.saveConfig({
    port: port || undefined,
    baudRate: baudRate || undefined
  })
  await puntoVentaService.connect(config)
  res.json({ connected: true, config: puntoVentaService.currentConfig })
}))

router.post('/disconnect', requirePermission('settings'), asyncHandler(async (_req: Request, res: Response) => {
  await puntoVentaService.disconnect()
  res.json({ connected: false })
}))

router.post('/test', requirePermission('settings'), asyncHandler(async (_req: Request, res: Response) => {
  await puntoVentaService.loadConfig()
  const msg = await puntoVentaService.testConnection()
  res.json({ ok: true, message: msg })
}))

router.post('/pay', asyncHandler(async (req: Request, res: Response) => {
  const { amount, currency } = req.body
  if (amount === undefined || amount === null || amount <= 0) {
    res.status(400).json({ error: 'Monto inválido' })
    return
  }
  const result = await puntoVentaService.sendAmount(Number(amount))
  res.json({ result, currency: currency || 'USD' })
}))

router.put('/settings', requirePermission('settings'), asyncHandler(async (req: Request, res: Response) => {
  const { port, baudRate, enabled } = req.body
  const config = await puntoVentaService.saveConfig({ port, baudRate, enabled })
  if (!enabled && puntoVentaService.isConnected) {
    await puntoVentaService.disconnect()
  }
  res.json({ config })
}))

export default router
