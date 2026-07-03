import { Router, Request, Response } from 'express'
import { prisma } from '../../database/prisma'
import { authMiddleware, adminMiddleware } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

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

router.get('/', async (_req: Request, res: Response) => {
  try {
    await ensureDefaultControl()
    const controls = await prisma.fiscalControl.findMany({ orderBy: { documentType: 'asc' } })
    res.json({ controls })
  } catch (error) {
    console.error('[fiscal-control] list error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', adminMiddleware, async (req: Request, res: Response) => {
  const { documentType, resolution, prefix, startNumber, endNumber, issuedAt } = req.body
  try {
    if (!DOCUMENT_TYPES[documentType]) {
      res.status(400).json({ error: 'Tipo de documento inválido. Válidos: FACT, NCR, NDB' })
      return
    }
    if (!resolution?.trim()) {
      res.status(400).json({ error: 'Número de resolución requerido' })
      return
    }
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
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      const e = error as { code: string; meta?: { target?: string[] } }
      if (e.code === 'P2002') {
        const fields = e.meta?.target?.join(', ') || `${documentType}/${prefix}`
        res.status(409).json({ error: `Ya existe un control fiscal para ${fields}` })
        return
      }
    }
    console.error('[fiscal-control] create error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:id', adminMiddleware, async (req: Request, res: Response) => {
  try {
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
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2025'
    ) {
      res.status(404).json({ error: 'Control fiscal no encontrado' })
      return
    }
    console.error('[fiscal-control] update error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export { router as default, DOCUMENT_TYPES, ensureDefaultControl }
