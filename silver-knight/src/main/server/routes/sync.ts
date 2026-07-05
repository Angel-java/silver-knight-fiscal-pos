import { Router, Request, Response } from 'express'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import { syncService } from '../syncService'

const router = Router()
router.use(authMiddleware)

router.get('/config', async (_req: Request, res: Response) => {
  const config = await syncService.getConfig()
  res.json({ config })
})

router.put('/config', adminMiddleware, async (req: Request, res: Response) => {
  const { url, apiKey, enabled, interval } = req.body
  const config = await syncService.saveConfig({ url, apiKey, enabled, interval })
  if (enabled) {
    syncService.start()
  } else {
    syncService.stop()
  }
  res.json({ config })
})

router.post('/now', adminMiddleware, async (_req: Request, res: Response) => {
  const result = await syncService.syncNow()
  res.json({ result })
})

router.get('/status', async (_req: Request, res: Response) => {
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
})

router.get('/logs', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)
  const logs = await syncService.getLogs(limit)
  res.json({ logs })
})

export default router
