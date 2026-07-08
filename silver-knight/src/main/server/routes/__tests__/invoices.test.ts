import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../../database/prisma', () => ({
  prisma: {
    fiscalControl: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    invoice: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn()
    },
    product: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    inventoryMovement: {
      create: vi.fn()
    },
    setting: {
      findMany: vi.fn()
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

import { prisma } from '../../../database/prisma'
import invoicesRouter from '../invoices'
import { errorHandler } from '../../middleware/errorHandler'

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/invoices', invoicesRouter)
  app.use(errorHandler)
  return app
}

const mockDate = new Date('2026-07-04T12:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(mockDate)
})

afterEach(() => {
  vi.useRealTimers()
})

function mockTransaction() {
  const mockTx = {
    fiscalControl: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    invoice: {
      create: vi.fn()
    },
    product: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    inventoryMovement: {
      create: vi.fn()
    }
  }
  vi.mocked(prisma.$transaction).mockImplementation((cb: any) => cb(mockTx))
  return mockTx
}

describe('POST /api/invoices', () => {
  it('creates an invoice successfully with CF number', async () => {
    const mockTx = mockTransaction()
    vi.mocked(prisma.fiscalControl.findFirst).mockResolvedValue({
      id: 'fc-1',
      documentType: 'FACT',
      prefix: '0F',
      currentNumber: 5,
      endNumber: 999999,
      resolution: 'R001',
      isActive: true
    } as any)
    vi.mocked(mockTx.fiscalControl.findFirst).mockResolvedValue({
      id: 'fc-1',
      documentType: 'FACT',
      prefix: '0F',
      currentNumber: 5,
      endNumber: 999999,
      resolution: 'R001',
      isActive: true
    } as any)

    const createdInvoice = {
      id: 'inv-1',
      number: 'F-F20260704-0006',
      documentType: 'FACT',
      controlNumber: '0F0000000006',
      totalUsd: 115,
      totalVes: 0,
      ivaUsd: 15,
      ivaVes: 0,
      items: [
        { id: 'item-1', productName: 'Product A', quantity: 1, unitPriceUsd: 100, ivaRate: 15 }
      ],
      customer: null,
      fiscalControl: { id: 'fc-1' }
    }
    vi.mocked(mockTx.invoice.create).mockResolvedValue(createdInvoice as any)

    const res = await request(createApp())
      .post('/api/invoices')
      .send({
        items: [
          {
            productName: 'Product A',
            quantity: 1,
            unitPriceUsd: 100,
            unitPriceVes: 0,
            ivaRate: 15
          }
        ],
        currency: 'USD',
        exchangeRate: 0
      })

    expect(res.status).toBe(201)
    expect(res.body.invoice).toBeDefined()
    expect(res.body.invoice.controlNumber).toBe('0F0000000006')
    expect(mockTx.fiscalControl.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'fc-1' }, data: { currentNumber: 6 } })
    )
  })

  it('returns 400 when no items provided', async () => {
    const res = await request(createApp())
      .post('/api/invoices')
      .send({ items: [], currency: 'USD' })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('al menos un item')
  })

  it('returns 400 when stock is insufficient', async () => {
    const mockTx = mockTransaction()
    vi.mocked(prisma.fiscalControl.findFirst).mockResolvedValue({
      id: 'fc-1',
      documentType: 'FACT',
      prefix: '0F',
      currentNumber: 1,
      endNumber: 999999,
      isActive: true
    } as any)
    vi.mocked(mockTx.fiscalControl.findFirst).mockResolvedValue({
      id: 'fc-1',
      documentType: 'FACT',
      prefix: '0F',
      currentNumber: 1,
      endNumber: 999999,
      isActive: true
    } as any)
    vi.mocked(mockTx.product.findUnique).mockResolvedValue({
      id: 'prod-1',
      name: 'Product A',
      stock: 0
    } as any)

    const res = await request(createApp())
      .post('/api/invoices')
      .send({
        items: [
          {
            productId: 'prod-1',
            productName: 'Product A',
            quantity: 5,
            unitPriceUsd: 100,
            unitPriceVes: 0,
            ivaRate: 16
          }
        ],
        currency: 'USD',
        exchangeRate: 0
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Stock insuficiente')
  })

  it('returns error when fiscal control range is exhausted', async () => {
    const exhausted = {
      id: 'fc-1',
      documentType: 'FACT',
      prefix: '0F',
      currentNumber: 999999,
      endNumber: 999999,
      isActive: true
    } as any
    const mockTx = mockTransaction()
    vi.mocked(prisma.fiscalControl.findFirst).mockResolvedValue(exhausted)
    vi.mocked(mockTx.fiscalControl.findFirst).mockResolvedValue(exhausted)

    const res = await request(createApp())
      .post('/api/invoices')
      .send({
        items: [
          { productName: 'Test', quantity: 1, unitPriceUsd: 10, unitPriceVes: 0, ivaRate: 16 }
        ],
        currency: 'USD'
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Rango de numeración agotado')
  })
})

describe('PATCH /api/invoices/:id/cancel', () => {
  it('cancels an active invoice and restores stock', async () => {
    const activeInvoice = {
      id: 'inv-1',
      status: 'active',
      items: [{ id: 'item-1', productId: 'prod-1', quantity: 2, productName: 'A' }]
    }
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(activeInvoice as any)
    vi.mocked(prisma.invoice.update).mockResolvedValue({
      ...activeInvoice,
      status: 'cancelled',
      cancelReason: 'Test cancel',
      cancelledAt: new Date()
    } as any)

    const res = await request(createApp())
      .patch('/api/invoices/inv-1/cancel')
      .send({ reason: 'Test cancel' })

    expect(res.status).toBe(200)
    expect(prisma.invoice.update).toHaveBeenCalled()
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { stock: { increment: 2 } }
    })
  })

  it('returns 400 when no reason provided', async () => {
    const res = await request(createApp()).patch('/api/invoices/inv-1/cancel').send({ reason: '' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it('returns 404 when invoice not found', async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(null)

    const res = await request(createApp())
      .patch('/api/invoices/non-existent/cancel')
      .send({ reason: 'Test' })

    expect(res.status).toBe(404)
  })

  it('returns 400 when invoice already cancelled', async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({
      id: 'inv-1',
      status: 'cancelled'
    } as any)

    const res = await request(createApp())
      .patch('/api/invoices/inv-1/cancel')
      .send({ reason: 'Test' })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('ya está anulada')
  })
})

describe('GET /api/invoices/:id', () => {
  it('returns invoice by id', async () => {
    const invoice = {
      id: 'inv-1',
      number: 'F-001',
      items: [],
      customer: null
    }
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(invoice as any)

    const res = await request(createApp()).get('/api/invoices/inv-1')

    expect(res.status).toBe(200)
    expect(res.body.invoice.id).toBe('inv-1')
  })

  it('returns 404 when invoice not found', async () => {
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue(null)

    const res = await request(createApp()).get('/api/invoices/non-existent')

    expect(res.status).toBe(404)
  })
})

describe('GET /api/invoices', () => {
  it('lists invoices with pagination', async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      { id: 'inv-1', number: 'F-001', items: [], customer: null }
    ] as any)
    vi.mocked(prisma.invoice.count).mockResolvedValue(1)

    const res = await request(createApp()).get('/api/invoices')

    expect(res.status).toBe(200)
    expect(res.body.invoices).toHaveLength(1)
    expect(res.body.total).toBe(1)
    expect(res.body.page).toBe(1)
  })

  it('filters by documentType and status', async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])
    vi.mocked(prisma.invoice.count).mockResolvedValue(0)

    await request(createApp()).get('/api/invoices?documentType=NCR&status=active')

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ documentType: 'NCR', status: 'active' })
      })
    )
  })
})
