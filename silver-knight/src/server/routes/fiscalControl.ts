import { Router, Request, Response } from 'express'
import { prisma } from '../database/prisma'
import { authMiddleware, adminMiddleware, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createFiscalControlSchema, updateFiscalControlSchema } from '../validation/schemas'
import { asyncHandler } from '../middleware/errorHandler'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('fiscal-control'))

const DOCUMENT_TYPES: Record<string, string> = {
  FACT: 'Factura',
  NCR: 'Nota de Crédito',
  NDB: 'Nota de Débito'
}

const DEFAULT_CONTROLS = [
  { documentType: 'FACT', prefix: '0F' },
  { documentType: 'NCR', prefix: '0C' },
  { documentType: 'NDB', prefix: '0D' }
]

async function ensureDefaultControl(): Promise<void> {
  for (const dc of DEFAULT_CONTROLS) {
    const exists = await prisma.fiscalControl.findFirst({
      where: { documentType: dc.documentType }
    })
    if (exists) continue
    await prisma.fiscalControl.create({
      data: {
        documentType: dc.documentType,
        resolution: 'INICIAL-DEV',
        prefix: dc.prefix,
        startNumber: 1,
        endNumber: 999999,
        currentNumber: 0,
        issuedAt: new Date()
      }
    })
  }
}

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const controls = await prisma.fiscalControl.findMany({ orderBy: { documentType: 'asc' } })
  res.json({ controls })
}))

router.post(
  '/',
  adminMiddleware,
  validate(createFiscalControlSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { documentType, resolution, prefix, startNumber, endNumber, issuedAt } = req.body
    const control = await prisma.fiscalControl.create({
      data: {
        documentType,
        resolution: resolution.trim(),
        prefix: prefix || `0${documentType[0]}`,
        startNumber: parseInt(startNumber) || 1,
        endNumber: parseInt(endNumber) || 999999,
        currentNumber: (parseInt(startNumber) || 1) - 1,
        issuedAt: issuedAt ? new Date(issuedAt) : new Date()
      }
    })
    res.status(201).json({ control })
  })
)

router.put(
  '/:id',
  adminMiddleware,
  validate(updateFiscalControlSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string
    const { resolution, prefix, startNumber, endNumber, issuedAt, isActive } = req.body
    const control = await prisma.fiscalControl.update({
      where: { id },
      data: {
        resolution: resolution ?? undefined,
        prefix: prefix ?? undefined,
        startNumber: startNumber != null ? parseInt(startNumber) : undefined,
        endNumber: endNumber != null ? parseInt(endNumber) : undefined,
        issuedAt: issuedAt ? new Date(issuedAt) : undefined,
        isActive: isActive ?? undefined
      }
    })
    res.json({ control })
  })
)

export { router as default, DOCUMENT_TYPES, ensureDefaultControl }
