import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../../database/prisma', () => ({
  prisma: {
    invoice: {
      findMany: vi.fn()
    }
  }
}))

vi.mock('../../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { userId: 'test-user', username: 'test', role: 'admin' }
    next()
  }
}))

import { prisma } from '../../../database/prisma'
import ivaBooksRouter from '../ivaBooks'
import { errorHandler } from '../../middleware/errorHandler'

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/iva', ivaBooksRouter)
  app.use(errorHandler)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/iva/ventas', () => {
  it('returns only active FACT invoices with summary', async () => {
    const fakeInvoices = [
      {
        id: 'inv-1',
        documentType: 'FACT',
        status: 'active',
        totalUsd: 100,
        totalVes: 0,
        ivaUsd: 16,
        ivaVes: 0,
        items: [],
        customer: null
      },
      {
        id: 'inv-2',
        documentType: 'FACT',
        status: 'active',
        totalUsd: 200,
        totalVes: 0,
        ivaUsd: 32,
        ivaVes: 0,
        items: [],
        customer: null
      }
    ]
    vi.mocked(prisma.invoice.findMany).mockResolvedValue(fakeInvoices as any)

    const res = await request(createApp()).get('/api/iva/ventas')

    expect(res.status).toBe(200)
    expect(res.body.invoices).toHaveLength(2)
    expect(res.body.summary).toEqual({
      totalUsd: 300,
      totalVes: 0,
      ivaUsd: 48,
      ivaVes: 0,
      count: 2
    })
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ documentType: 'FACT', status: 'active' })
      })
    )
  })

  it('filters by date range', async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])

    await request(createApp()).get('/api/iva/ventas?from=2026-01-01&to=2026-06-30')

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-06-30')
          }
        })
      })
    )
  })

  it('excludes cancelled invoices from IVA sales book', async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])

    await request(createApp()).get('/api/iva/ventas')

    const callArg = vi.mocked(prisma.invoice.findMany).mock.calls[0][0]
    expect(callArg).toBeDefined()
    const where = callArg!.where as Record<string, unknown>
    expect(where.status).toBe('active')
  })
})

describe('GET /api/iva/compras', () => {
  it('returns invoices of all types with count', async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      { id: 'inv-1', documentType: 'FACT', items: [], customer: null }
    ] as any)

    const res = await request(createApp()).get('/api/iva/compras')

    expect(res.status).toBe(200)
    expect(res.body.invoices).toHaveLength(1)
    expect(res.body.summary.count).toBe(1)
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          documentType: { in: ['FACT', 'NCR', 'NDB'] }
        })
      })
    )
  })
})
