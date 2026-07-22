import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../database/prisma', () => ({
  prisma: {
    fiscalControl: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    $transaction: vi.fn()
  }
}))

vi.mock('../../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { userId: 'test-user', username: 'test', role: 'admin' }
    next()
  },
  adminMiddleware: (_req: any, _res: any, next: any) => {
    next()
  },
  requirePermission: () => (_req: any, _res: any, next: any) => {
    next()
  }
}))

import { prisma } from '../../database/prisma'
import fiscalControlRouter, { ensureDefaultControl, DOCUMENT_TYPES } from '../fiscalControl'
import { errorHandler } from '../../middleware/errorHandler'

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/fiscal-control', fiscalControlRouter)
  app.use(errorHandler)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DOCUMENT_TYPES', () => {
  it('maps FACT, NCR, NDB to Spanish labels', () => {
    expect(DOCUMENT_TYPES).toEqual({
      FACT: 'Factura',
      NCR: 'Nota de Crédito',
      NDB: 'Nota de Débito'
    })
  })
})

describe('ensureDefaultControl', () => {
  it('creates default controls when none exist', async () => {
    vi.mocked(prisma.fiscalControl.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.fiscalControl.create).mockResolvedValue({} as any)

    await ensureDefaultControl()

    expect(prisma.fiscalControl.findFirst).toHaveBeenCalledTimes(3)
    expect(prisma.fiscalControl.create).toHaveBeenCalledTimes(3)
    expect(prisma.fiscalControl.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ documentType: 'FACT', prefix: '0F' })
      })
    )
    expect(prisma.fiscalControl.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ documentType: 'NCR', prefix: '0C' })
      })
    )
    expect(prisma.fiscalControl.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ documentType: 'NDB', prefix: '0D' })
      })
    )
  })

  it('skips existing controls', async () => {
    vi.mocked(prisma.fiscalControl.findFirst).mockResolvedValue({ id: 'existing' } as any)

    await ensureDefaultControl()

    expect(prisma.fiscalControl.findFirst).toHaveBeenCalledTimes(3)
    expect(prisma.fiscalControl.create).not.toHaveBeenCalled()
  })
})

describe('GET /api/fiscal-control', () => {
  it('returns all fiscal controls', async () => {
    const fakeControls = [{ id: '1', documentType: 'FACT', resolution: 'R001', prefix: '0F' }]
    vi.mocked(prisma.fiscalControl.findMany).mockResolvedValue(fakeControls as any)

    const res = await request(createApp()).get('/api/fiscal-control')

    expect(res.status).toBe(200)
    expect(res.body.controls).toEqual(fakeControls)
  })
})

describe('POST /api/fiscal-control', () => {
  it('creates a new fiscal control', async () => {
    const newControl = {
      id: 'new-id',
      documentType: 'FACT',
      resolution: 'SENIAT-2024-001',
      prefix: '0F',
      startNumber: 1,
      endNumber: 5000
    }
    vi.mocked(prisma.fiscalControl.create).mockResolvedValue(newControl as any)

    const res = await request(createApp()).post('/api/fiscal-control').send({
      documentType: 'FACT',
      resolution: 'SENIAT-2024-001',
      prefix: '0F',
      startNumber: 1,
      endNumber: 5000,
      issuedAt: '2024-01-01'
    })

    expect(res.status).toBe(201)
    expect(res.body.control).toEqual(newControl)
    expect(prisma.fiscalControl.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentType: 'FACT',
        resolution: 'SENIAT-2024-001',
        prefix: '0F',
        startNumber: 1,
        endNumber: 5000,
        currentNumber: 0
      })
    })
  })

  it('returns 400 for invalid document type', async () => {
    const res = await request(createApp()).post('/api/fiscal-control').send({
      documentType: 'INVALID',
      resolution: 'R001',
      startNumber: 1,
      endNumber: 100
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('inválido')
  })

  it('returns 400 when resolution is empty', async () => {
    const res = await request(createApp())
      .post('/api/fiscal-control')
      .send({ documentType: 'FACT', resolution: '', startNumber: 1, endNumber: 100 })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('resolución')
  })

  it('returns 409 when duplicate prefix/documentType exists', async () => {
    const prismaError = Object.assign(new Error(), {
      code: 'P2002',
      meta: { target: ['documentType', 'prefix'] }
    })
    vi.mocked(prisma.fiscalControl.create).mockRejectedValue(prismaError)

    const res = await request(createApp()).post('/api/fiscal-control').send({
      documentType: 'FACT',
      resolution: 'R002',
      prefix: '0F',
      startNumber: 1,
      endNumber: 100
    })

    expect(res.status).toBe(409)
    expect(res.body.error).toContain('Ya existe')
  })
})

describe('PUT /api/fiscal-control/:id', () => {
  it('updates a fiscal control', async () => {
    const updated = { id: 'ctrl-1', documentType: 'FACT', resolution: 'R002', prefix: '0F' }
    vi.mocked(prisma.fiscalControl.update).mockResolvedValue(updated as any)

    const res = await request(createApp())
      .put('/api/fiscal-control/ctrl-1')
      .send({ resolution: 'R002', isActive: false })

    expect(res.status).toBe(200)
    expect(res.body.control).toEqual(updated)
    expect(prisma.fiscalControl.update).toHaveBeenCalledWith({
      where: { id: 'ctrl-1' },
      data: { resolution: 'R002', isActive: false }
    })
  })

  it('returns 404 when control not found', async () => {
    const prismaError = Object.assign(new Error(), { code: 'P2025' })
    vi.mocked(prisma.fiscalControl.update).mockRejectedValue(prismaError)

    const res = await request(createApp())
      .put('/api/fiscal-control/non-existent')
      .send({ resolution: 'R999' })

    expect(res.status).toBe(404)
    expect(res.body.error).toContain('no encontrado')
  })
})
