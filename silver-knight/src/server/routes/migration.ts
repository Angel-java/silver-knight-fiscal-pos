import { Router, Request, Response, json } from 'express'
import rateLimit from 'express-rate-limit'
import { prisma } from '../database/prisma'
import {
  authMiddleware,
  rootMiddleware,
  rootOrAdminMiddleware,
  requirePermission
} from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { exportBackup, exportCsv, getTemplateCsv, type ExportResult } from '../migration/exporter'
import { previewImport, applyImport } from '../migration/importer'
import {
  CSV_ENTITIES,
  EXPORT_SCOPES,
  MAX_IMPORT_BYTES,
  SCOPE_LABELS,
  STRATEGY_LABELS,
  type CsvEntity,
  type ExportScope,
  type ImportStrategy
} from '../migration/formats'

const router = Router()

router.use(json({ limit: MAX_IMPORT_BYTES }))
router.use(authMiddleware)
router.use(requirePermission('data-migration'))

const importLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiadas importaciones. Intenta de nuevo en 1 hora.' },
  standardHeaders: true,
  legacyHeaders: false
})

function sendFile(res: Response, result: ExportResult): void {
  res.setHeader('Content-Type', result.contentType)
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${result.filename}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`
  )
  res.send(result.content)
}

router.get('/scopes', asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    formats: ['json', 'csv'],
    backupFormat: 'silverknight-backup',
    scopes: EXPORT_SCOPES.map((s) => ({ value: s, label: SCOPE_LABELS[s] })),
    csvEntities: CSV_ENTITIES,
    strategies: Object.entries(STRATEGY_LABELS).map(([value, label]) => ({ value, label })),
    maxImportBytes: MAX_IMPORT_BYTES
  })
}))

router.get(
  '/export',
  rootOrAdminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const format = String(req.query['format'] || 'json')
    if (format === 'json') {
      const scope = String(req.query['scope'] || 'all') as ExportScope
      if (!(EXPORT_SCOPES as readonly string[]).includes(scope)) {
        res.status(400).json({ error: 'Alcance de exportación inválido' })
        return
      }
      sendFile(res, await exportBackup(scope))
      return
    }
    if (format === 'csv') {
      const entity = String(req.query['entity'] || '') as CsvEntity
      if (!(CSV_ENTITIES as readonly string[]).includes(entity)) {
        res.status(400).json({ error: 'Entidad CSV inválida' })
        return
      }
      sendFile(res, await exportCsv(entity))
      return
    }
    res.status(400).json({ error: 'Formato de exportación inválido' })
  })
)

router.get(
  '/templates',
  rootOrAdminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const entity = String(req.query['entity'] || '') as CsvEntity
    if (!(CSV_ENTITIES as readonly string[]).includes(entity)) {
      res.status(400).json({ error: 'Entidad CSV inválida' })
      return
    }
    sendFile(res, getTemplateCsv(entity))
  })
)

router.post(
  '/preview',
  rootMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { payload?: unknown; strategy?: ImportStrategy }
    const payload = body.payload
    if (payload == null) {
      res.status(400).json({ error: 'Payload requerido' })
      return
    }
    const preview = await previewImport(payload, body.strategy)
    res.json(preview)
  })
)

router.post(
  '/import',
  rootMiddleware,
  importLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { payload?: unknown; strategy?: ImportStrategy; fileName?: string }
    if (body.payload == null) {
      res.status(400).json({ error: 'Payload requerido' })
      return
    }
    if (!body.strategy || !['skip', 'overwrite'].includes(body.strategy)) {
      res.status(400).json({ error: 'Estrategia inválida' })
      return
    }
    const result = await applyImport(body.payload, body.strategy, req.user?.userId ?? null, body.fileName)
    res.json(result)
  })
)

router.get(
  '/logs',
  rootOrAdminMiddleware,
  asyncHandler(async (_req: Request, res: Response) => {
    const logs = await prisma.migrationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    })
    res.json({ logs })
  })
)

export default router
