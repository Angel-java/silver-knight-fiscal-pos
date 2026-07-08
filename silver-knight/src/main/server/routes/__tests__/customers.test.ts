import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../../database/prisma', () => ({
  prisma: {
    customer: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn()
    },
    invoice: {
      count: vi.fn()
    }
  }
}))

vi.mock('../../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { userId: 'test-user', username: 'test', role: 'admin' }
    next()
  },
  requirePermission: () => (_req: any, _res: any, next: any) => {
    next()
  }
}))

import { prisma } from '../../../database/prisma'
import customersRouter from '../customers'
import { errorHandler } from '../../middleware/errorHandler'

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/customers', customersRouter)
  app.use(errorHandler)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/customers', () => {
  it('lists customers with pagination', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([{ id: 'c-1', name: 'Client A' }] as any)
    vi.mocked(prisma.customer.count).mockResolvedValue(1)

    const res = await request(createApp()).get('/api/customers')

    expect(res.status).toBe(200)
    expect(res.body.customers).toHaveLength(1)
    expect(res.body.total).toBe(1)
  })

  it('searches by name, rif, phone', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([])
    vi.mocked(prisma.customer.count).mockResolvedValue(0)

    await request(createApp()).get('/api/customers?search=foo')

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([expect.objectContaining({ name: { contains: 'foo' } })])
        })
      })
    )
  })
})

describe('GET /api/customers/:id', () => {
  it('returns customer with invoices', async () => {
    vi.mocked(prisma.customer.findUnique).mockResolvedValue({
      id: 'c-1',
      name: 'Client',
      invoices: []
    } as any)

    const res = await request(createApp()).get('/api/customers/c-1')

    expect(res.status).toBe(200)
    expect(res.body.customer.name).toBe('Client')
  })

  it('returns 404 when not found', async () => {
    vi.mocked(prisma.customer.findUnique).mockResolvedValue(null)

    const res = await request(createApp()).get('/api/customers/nope')

    expect(res.status).toBe(404)
  })
})

describe('POST /api/customers', () => {
  it('creates a customer', async () => {
    vi.mocked(prisma.customer.create).mockResolvedValue({
      id: 'c-1',
      name: 'New Client',
      rif: 'J-123'
    } as any)

    const res = await request(createApp())
      .post('/api/customers')
      .send({ name: 'New Client', rif: 'J-123' })

    expect(res.status).toBe(201)
    expect(res.body.customer.name).toBe('New Client')
  })

  it('returns 400 without name', async () => {
    const res = await request(createApp()).post('/api/customers').send({ rif: 'J-123' })

    expect(res.status).toBe(400)
  })

  it('returns 409 on duplicate RIF', async () => {
    const prismaError = Object.assign(new Error(), { code: 'P2002', meta: { target: ['rif'] } })
    vi.mocked(prisma.customer.create).mockRejectedValue(prismaError)

    const res = await request(createApp())
      .post('/api/customers')
      .send({ name: 'Client', rif: 'J-DUP' })

    expect(res.status).toBe(409)
  })
})

describe('PUT /api/customers/:id', () => {
  it('updates a customer', async () => {
    vi.mocked(prisma.customer.update).mockResolvedValue({
      id: 'c-1',
      name: 'Updated',
      rif: 'J-999'
    } as any)

    const res = await request(createApp())
      .put('/api/customers/c-1')
      .send({ name: 'Updated', rif: 'J-999' })

    expect(res.status).toBe(200)
    expect(res.body.customer.name).toBe('Updated')
  })

  it('returns 404 on not found', async () => {
    const prismaError = Object.assign(new Error(), { code: 'P2025' })
    vi.mocked(prisma.customer.update).mockRejectedValue(prismaError)

    const res = await request(createApp())
      .put('/api/customers/nope')
      .send({ name: 'Test', rif: 'J-1' })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/customers/:id', () => {
  it('deletes a customer with no invoices', async () => {
    vi.mocked(prisma.invoice.count).mockResolvedValue(0)
    vi.mocked(prisma.customer.delete).mockResolvedValue({} as any)

    const res = await request(createApp()).delete('/api/customers/c-1')

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 400 when customer has invoices', async () => {
    vi.mocked(prisma.invoice.count).mockResolvedValue(5)

    const res = await request(createApp()).delete('/api/customers/c-1')

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('facturas')
  })

  it('returns 404 when not found', async () => {
    vi.mocked(prisma.invoice.count).mockResolvedValue(0)
    const prismaError = Object.assign(new Error(), { code: 'P2025' })
    vi.mocked(prisma.customer.delete).mockRejectedValue(prismaError)

    const res = await request(createApp()).delete('/api/customers/nope')

    expect(res.status).toBe(404)
  })
})
