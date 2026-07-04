import { Router, Request, Response } from 'express'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import { syncService } from '../syncService'

const router = Router()
router.use(authMiddleware)

router.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = await syncService.getConfig()
    res.json({ config })
  } catch (error) {
    console.error('[sync] config error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/config', adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { url, apiKey, enabled, interval } = req.body
    const config = await syncService.saveConfig({ url, apiKey, enabled, interval })
    if (enabled) {
      syncService.start()
    } else {
      syncService.stop()
    }
    res.json({ config })
  } catch (error) {
    console.error('[sync] save config error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/now', adminMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await syncService.syncNow()
    res.json({ result })
  } catch (error) {
    console.error('[sync] sync now error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const config = await syncService.getConfig()
    res.json({
      syncing: syncService.isSyncing,
      config: {
        url: config.url,
        enabled: config.enabled,
        interval: config.interval,
        lastSyncAt: config.lastSyncAt
      },
      lastResult: syncService.lastResult
    })
  } catch (error) {
    console.error('[sync] status error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/logs', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)
    const logs = await syncService.getLogs(limit)
    res.json({ logs })
  } catch (error) {
    console.error('[sync] logs error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
