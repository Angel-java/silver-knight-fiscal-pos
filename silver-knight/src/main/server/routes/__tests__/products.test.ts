import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../../database/prisma', () => ({
  prisma: {
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn()
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
import productsRouter from '../products'
import { errorHandler } from '../../middleware/errorHandler'

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/products', productsRouter)
  app.use(errorHandler)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/products', () => {
  it('lists products with pagination', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: 'p-1', name: 'Prod A', category: null }
    ] as any)
    vi.mocked(prisma.product.count).mockResolvedValue(1)

    const res = await request(createApp()).get('/api/products')

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(1)
    expect(res.body.total).toBe(1)
  })

  it('searches by name, code, or barcode', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([])
    vi.mocked(prisma.product.count).mockResolvedValue(0)

    await request(createApp()).get('/api/products?search=foo')

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([expect.objectContaining({ name: { contains: 'foo' } })])
        })
      })
    )
  })
})

describe('GET /api/products/:id', () => {
  it('returns product by id', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: 'p-1', name: 'Prod' } as any)

    const res = await request(createApp()).get('/api/products/p-1')

    expect(res.status).toBe(200)
    expect(res.body.product.id).toBe('p-1')
  })

  it('returns 404 when not found', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null)

    const res = await request(createApp()).get('/api/products/nope')

    expect(res.status).toBe(404)
  })
})

describe('POST /api/products', () => {
  it('creates a product', async () => {
    const created = { id: 'p-1', name: 'New Product', priceUsd: 10, priceVes: 350, category: null }
    vi.mocked(prisma.product.create).mockResolvedValue(created as any)

    const res = await request(createApp())
      .post('/api/products')
      .send({ name: 'New Product', priceUsd: 10, priceVes: 350 })

    expect(res.status).toBe(201)
    expect(res.body.product.name).toBe('New Product')
  })

  it('returns 400 without name', async () => {
    const res = await request(createApp())
      .post('/api/products')
      .send({ priceUsd: 10, priceVes: 350 })

    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it('returns 400 without prices', async () => {
    const res = await request(createApp()).post('/api/products').send({ name: 'Test' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it('returns 409 on duplicate code/barcode', async () => {
    const prismaError = Object.assign(new Error(), { code: 'P2002', meta: { target: ['code'] } })
    vi.mocked(prisma.product.create).mockRejectedValue(prismaError)

    const res = await request(createApp())
      .post('/api/products')
      .send({ name: 'Test', code: 'DUP', priceUsd: 1, priceVes: 1 })

    expect(res.status).toBe(409)
    expect(res.body.error).toContain('Ya existe')
  })
})

describe('PUT /api/products/:id', () => {
  it('updates a product', async () => {
    const updated = { id: 'p-1', name: 'Updated', priceUsd: 15, priceVes: 500, category: null }
    vi.mocked(prisma.product.update).mockResolvedValue(updated as any)

    const res = await request(createApp())
      .put('/api/products/p-1')
      .send({ name: 'Updated', priceUsd: 15, priceVes: 500 })

    expect(res.status).toBe(200)
    expect(res.body.product.name).toBe('Updated')
  })

  it('returns 404 when not found', async () => {
    const prismaError = Object.assign(new Error(), { code: 'P2025' })
    vi.mocked(prisma.product.update).mockRejectedValue(prismaError)

    const res = await request(createApp())
      .put('/api/products/nope')
      .send({ name: 'Test', priceUsd: 1, priceVes: 1 })

    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/products/:id/stock', () => {
  it('increases stock (type=in)', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: 'p-1', stock: 10 } as any)
    vi.mocked(prisma.product.update).mockResolvedValue({
      id: 'p-1',
      stock: 15,
      category: null
    } as any)

    const res = await request(createApp())
      .patch('/api/products/p-1/stock')
      .send({ quantity: 5, type: 'in' })

    expect(res.status).toBe(200)
    expect(res.body.product.stock).toBe(15)
  })

  it('decreases stock (type=out)', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: 'p-1', stock: 10 } as any)
    vi.mocked(prisma.product.update).mockResolvedValue({
      id: 'p-1',
      stock: 7,
      category: null
    } as any)

    const res = await request(createApp())
      .patch('/api/products/p-1/stock')
      .send({ quantity: 3, type: 'out' })

    expect(res.status).toBe(200)
    expect(res.body.product.stock).toBe(7)
  })

  it('returns 400 when stock would go negative', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: 'p-1', stock: 2 } as any)

    const res = await request(createApp())
      .patch('/api/products/p-1/stock')
      .send({ quantity: 10, type: 'out' })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('insuficiente')
  })

  it('returns 400 with invalid type', async () => {
    const res = await request(createApp())
      .patch('/api/products/p-1/stock')
      .send({ quantity: 5, type: 'invalid' })

    expect(res.status).toBe(400)
  })

  it('returns 404 when product not found', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null)

    const res = await request(createApp())
      .patch('/api/products/nope/stock')
      .send({ quantity: 1, type: 'in' })

    expect(res.status).toBe(404)
  })
})
