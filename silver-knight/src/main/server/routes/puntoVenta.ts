import { Router, Request, Response } from 'express'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import { puntoVentaService } from '../puntoVenta'

const router = Router()
router.use(authMiddleware)

router.get('/status', async (_req: Request, res: Response) => {
  try {
    await puntoVentaService.loadConfig()
    res.json({
      connected: puntoVentaService.isConnected,
      connecting: puntoVentaService.isConnecting,
      config: puntoVentaService.currentConfig
    })
  } catch (error) {
    console.error('[punto-venta] status error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/ports', async (_req: Request, res: Response) => {
  try {
    const ports = await puntoVentaService.listAvailablePorts()
    res.json({ ports })
  } catch (error) {
    console.error('[punto-venta] ports error:', error)
    res.status(500).json({ error: 'Error al listar puertos' })
  }
})

router.post('/connect', adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { port, baudRate } = req.body
    const config = await puntoVentaService.saveConfig({
      port: port || undefined,
      baudRate: baudRate || undefined
    })
    await puntoVentaService.connect(config)
    res.json({ connected: true, config: puntoVentaService.currentConfig })
  } catch (error) {
    console.error('[punto-venta] connect error:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'Error al conectar' })
  }
})

router.post('/disconnect', adminMiddleware, async (_req: Request, res: Response) => {
  try {
    await puntoVentaService.disconnect()
    res.json({ connected: false })
  } catch (error) {
    console.error('[punto-venta] disconnect error:', error)
    res.status(500).json({ error: 'Error al desconectar' })
  }
})

router.post('/test', adminMiddleware, async (_req: Request, res: Response) => {
  try {
    await puntoVentaService.loadConfig()
    const msg = await puntoVentaService.testConnection()
    res.json({ ok: true, message: msg })
  } catch (error) {
    console.error('[punto-venta] test error:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'Error en prueba' })
  }
})

router.post('/pay', async (req: Request, res: Response) => {
  try {
    const { amount, currency } = req.body
    if (amount === undefined || amount === null || amount <= 0) {
      res.status(400).json({ error: 'Monto inválido' })
      return
    }
    const result = await puntoVentaService.sendAmount(Number(amount))
    res.json({ result, currency: currency || 'USD' })
  } catch (error) {
    console.error('[punto-venta] pay error:', error)
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : 'Error al procesar pago' })
  }
})

router.put('/settings', adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { port, baudRate, enabled } = req.body
    const config = await puntoVentaService.saveConfig({ port, baudRate, enabled })
    if (!enabled && puntoVentaService.isConnected) {
      await puntoVentaService.disconnect()
    }
    res.json({ config })
  } catch (error) {
    console.error('[punto-venta] settings error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
