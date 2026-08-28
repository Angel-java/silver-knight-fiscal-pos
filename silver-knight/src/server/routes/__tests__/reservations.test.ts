import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../database/prisma', () => ({
  prisma: {
    reservation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn()
    },
    reservationPayment: {
      create: vi.fn()
    },
    product: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    inventoryMovement: {
      create: vi.fn()
    },
    exchangeRate: {
      findFirst: vi.fn()
    },
    fiscalControl: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    invoice: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}))

vi.mock('../../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { userId: 'test-user', username: 'test', role: 'admin' }
    next()
  },
  rootMiddleware: (_req: any, _res: any, next: any) => {
    next()
  },
  requirePermission: () => (_req: any, _res: any, next: any) => {
    next()
  }
}))

vi.mock('../invoices', () => ({
  computeInvoiceTotals: vi.fn(),
  createFiscalInvoiceFromReservation: vi.fn()
}))

import { prisma } from '../../database/prisma'
import {
  computeInvoiceTotals,
  createFiscalInvoiceFromReservation
} from '../invoices'
import reservationsRouter from '../reservations'
import { errorHandler } from '../../middleware/errorHandler'

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/reservations', reservationsRouter)
  app.use(errorHandler)
  return app
}

const mockDate = new Date('2026-08-28T12:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(mockDate)
  vi.mocked(computeInvoiceTotals).mockImplementation((items: any[], rate: number) => {
    let totalUsd = 0
    let totalVes = 0
    let ivaUsd = 0
    let ivaVes = 0
    const invoiceItems = items.map((item) => {
      const lineUsd = item.unitPriceUsd * item.quantity
      const lineVes = lineUsd * rate
      const lineIvaUsd = lineUsd * (item.ivaRate / 100)
      const lineIvaVes = lineVes * (item.ivaRate / 100)
      totalUsd += lineUsd
      totalVes += lineVes
      ivaUsd += lineIvaUsd
      ivaVes += lineIvaVes
      return {
        productId: item.productId || null,
        productName: item.productName,
        quantity: item.quantity,
        unitPriceUsd: item.unitPriceUsd,
        unitPriceVes: lineUsd * rate,
        ivaRate: item.ivaRate,
        totalUsd: lineUsd,
        totalVes: lineVes
      }
    })
    return {
      invoiceItems,
      totalUsd: Math.round(totalUsd * 100) / 100,
      totalVes: Math.round(totalVes * 100) / 100,
      ivaUsd: Math.round(ivaUsd * 100) / 100,
      ivaVes: Math.round(ivaVes * 100) / 100
    }
  })
})

afterEach(() => {
  vi.useRealTimers()
})

function mockTransaction() {
  const mockTx = {
    reservation: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn()
    },
    reservationPayment: {
      create: vi.fn()
    },
    product: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    inventoryMovement: {
      create: vi.fn()
    },
    invoice: {
      create: vi.fn()
    }
  }
  vi.mocked(prisma.$transaction).mockImplementation((cb: any) => cb(mockTx))
  return mockTx
}

describe('POST /api/reservations', () => {
  it('creates a reservation and reserves stock', async () => {
    const mockTx = mockTransaction()
    vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValue({
      id: 'er-1', rate: 36.5, source: 'manual', date: new Date()
    } as any)
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue(null)
    vi.mocked(mockTx.product.findUnique).mockResolvedValue({
      id: 'prod-1', name: 'Product A', stock: 10
    } as any)
    vi.mocked(mockTx.reservation.create).mockResolvedValue({
      id: 'res-1',
      number: 'AP-20260828-0001',
      items: [],
      customer: null,
      payments: []
    } as any)

    const res = await request(createApp())
      .post('/api/reservations')
      .send({
        customerId: null,
        items: [{ productId: 'prod-1', productName: 'Product A', quantity: 2, unitPriceUsd: 50, ivaRate: 16 }],
        currency: 'USD',
        exchangeRate: 0,
        depositUsd: 50
      })

    expect(res.status).toBe(201)
    expect(prisma.exchangeRate.findFirst).toHaveBeenCalled()
    expect(mockTx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { stock: { decrement: 2 } }
    })
    expect(mockTx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'reserved' }) })
    )
  })

  it('returns 400 when stock is insufficient', async () => {
    const mockTx = mockTransaction()
    vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValue({
      id: 'er-1', rate: 36.5, source: 'manual', date: new Date()
    } as any)
    vi.mocked(mockTx.product.findUnique).mockResolvedValue({
      id: 'prod-1', name: 'Product A', stock: 1
    } as any)

    const res = await request(createApp())
      .post('/api/reservations')
      .send({
        items: [{ productId: 'prod-1', productName: 'Product A', quantity: 5, unitPriceUsd: 10, ivaRate: 16 }],
        currency: 'USD',
        exchangeRate: 36,
        depositUsd: 10
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Stock insuficiente')
  })

  it('returns 400 when deposit is not less than total', async () => {
    const mockTx = mockTransaction()
    vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValue({
      id: 'er-1', rate: 36.5, source: 'manual', date: new Date()
    } as any)
    vi.mocked(mockTx.product.findUnique).mockResolvedValue({
      id: 'prod-1', name: 'Product A', stock: 10
    } as any)

    const res = await request(createApp())
      .post('/api/reservations')
      .send({
        items: [{ productId: 'prod-1', productName: 'Product A', quantity: 1, unitPriceUsd: 50, ivaRate: 16 }],
        currency: 'USD',
        exchangeRate: 36,
        depositUsd: 50
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('debe ser menor que el total')
  })
})

describe('POST /api/reservations/:id/payments', () => {
  it('accumulates partial payment', async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 'res-1',
      status: 'active',
      exchangeRate: 36.5,
      totalUsd: 100,
      amountPaidUsd: 50
    } as any)
    vi.mocked(prisma.reservationPayment.create).mockResolvedValue({
      id: 'pay-1', amountUsd: 30, amountVes: 1095, method: 'cash'
    } as any)
    vi.mocked(prisma.reservation.update).mockResolvedValue({} as any)
    vi.mocked(prisma.$transaction).mockImplementation((cb: any) =>
      cb({
        reservationPayment: { create: vi.fn().mockResolvedValue({ id: 'pay-1', amountUsd: 30, method: 'cash' }) },
        reservation: { update: vi.fn().mockResolvedValue({}) }
      })
    )

    const res = await request(createApp())
      .post('/api/reservations/res-1/payments')
      .send({ amountUsd: 30, method: 'cash' })

    expect(res.status).toBe(200)
    expect(res.body.remaining).toBe(20)
    expect(res.body.finalized).toBe(false)
  })

  it('returns 400 when payment exceeds remaining balance', async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 'res-1',
      status: 'active',
      exchangeRate: 36.5,
      totalUsd: 100,
      amountPaidUsd: 90
    } as any)

    const res = await request(createApp())
      .post('/api/reservations/res-1/payments')
      .send({ amountUsd: 50 })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('supera el saldo')
  })

  it('returns 400 when reservation is not active', async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 'res-1', status: 'cancelled'
    } as any)

    const res = await request(createApp())
      .post('/api/reservations/res-1/payments')
      .send({ amountUsd: 10 })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('no está activo')
  })
})

describe('POST /api/reservations/:id/finalize', () => {
  it('returns 400 when there is still a balance', async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 'res-1',
      status: 'active',
      totalUsd: 100,
      amountPaidUsd: 50,
      exchangeRate: 36.5,
      currency: 'USD',
      items: [{ id: 'i1', productId: 'p1', productName: 'A', quantity: 1, unitPriceUsd: 100, ivaRate: 16 }]
    } as any)

    const res = await request(createApp())
      .post('/api/reservations/res-1/finalize')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Aún falta cobrar')
  })

  it('finalizes and emits fiscal invoice without re-decrementing stock', async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 'res-1',
      status: 'active',
      customerId: null,
      totalUsd: 100,
      amountPaidUsd: 100,
      exchangeRate: 36.5,
      currency: 'USD',
      items: [{ id: 'i1', productId: 'p1', productName: 'A', quantity: 1, unitPriceUsd: 100, ivaRate: 16 }]
    } as any)
    vi.mocked(createFiscalInvoiceFromReservation).mockResolvedValue({
      id: 'inv-1',
      number: 'F-F20260828-0001',
      controlNumber: '0F0000000001'
    } as any)
    vi.mocked(prisma.reservation.update).mockResolvedValue({
      id: 'res-1',
      status: 'finalized',
      finalizedAt: new Date(),
      invoiceId: 'inv-1',
      items: [],
      customer: null,
      payments: [],
      invoice: { id: 'inv-1' }
    } as any)

    const res = await request(createApp())
      .post('/api/reservations/res-1/finalize')
      .send({})

    expect(res.status).toBe(200)
    expect(createFiscalInvoiceFromReservation).toHaveBeenCalled()
    expect(res.body.reservation.status).toBe('finalized')
    expect(prisma.product.update).not.toHaveBeenCalled()
  })
})

describe('POST /api/reservations/:id/cancel', () => {
  it('cancels and releases stock', async () => {
    const mockTx = mockTransaction()
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 'res-1',
      status: 'active',
      number: 'AP-20260828-0001',
      items: [{ id: 'i1', productId: 'p1', quantity: 2 }]
    } as any)
    vi.mocked(mockTx.reservation.update).mockResolvedValue({
      id: 'res-1', status: 'cancelled', items: [], customer: null, payments: []
    } as any)

    const res = await request(createApp())
      .post('/api/reservations/res-1/cancel')
      .send({ reason: 'Cliente ya no lo quiere' })

    expect(res.status).toBe(200)
    expect(mockTx.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { stock: { increment: 2 } }
    })
    expect(mockTx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'unreserved' }) })
    )
  })
})

describe('GET /api/reservations', () => {
  it('lists reservations with pagination', async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      { id: 'res-1', number: 'AP-20260828-0001', customer: null }
    ] as any)
    vi.mocked(prisma.reservation.count).mockResolvedValue(1)

    const res = await request(createApp()).get('/api/reservations')

    expect(res.status).toBe(200)
    expect(res.body.reservations).toHaveLength(1)
    expect(res.body.total).toBe(1)
  })
})
