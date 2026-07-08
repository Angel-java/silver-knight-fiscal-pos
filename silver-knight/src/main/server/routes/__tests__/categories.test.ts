import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../../database/prisma', () => ({
  prisma: {
    category: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
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
import categoriesRouter from '../categories'
import { errorHandler } from '../../middleware/errorHandler'

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/categories', categoriesRouter)
  app.use(errorHandler)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/categories', () => {
  it('returns all categories ordered by name', async () => {
    vi.mocked(prisma.category.findMany).mockResolvedValue([
      { id: 'cat-1', name: 'Bebidas' },
      { id: 'cat-2', name: 'Alimentos' }
    ] as any)

    const res = await request(createApp()).get('/api/categories')

    expect(res.status).toBe(200)
    expect(res.body.categories).toHaveLength(2)
    expect(prisma.category.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } })
  })
})

describe('POST /api/categories', () => {
  it('creates a category', async () => {
    vi.mocked(prisma.category.create).mockResolvedValue({
      id: 'cat-1',
      name: 'Nueva',
      description: 'Test'
    } as any)

    const res = await request(createApp())
      .post('/api/categories')
      .send({ name: 'Nueva', description: 'Test' })

    expect(res.status).toBe(201)
    expect(res.body.category.name).toBe('Nueva')
  })

  it('returns 400 without name', async () => {
    const res = await request(createApp()).post('/api/categories').send({ description: 'No name' })

    expect(res.status).toBe(400)
  })

  it('returns 409 on duplicate name', async () => {
    const prismaError = Object.assign(new Error(), { code: 'P2002' })
    vi.mocked(prisma.category.create).mockRejectedValue(prismaError)

    const res = await request(createApp()).post('/api/categories').send({ name: 'Duplicada' })

    expect(res.status).toBe(409)
    expect(res.body.error).toContain('Ya existe')
  })
})

describe('PUT /api/categories/:id', () => {
  it('updates a category', async () => {
    vi.mocked(prisma.category.update).mockResolvedValue({
      id: 'cat-1',
      name: 'Editada'
    } as any)

    const res = await request(createApp()).put('/api/categories/cat-1').send({ name: 'Editada' })

    expect(res.status).toBe(200)
    expect(res.body.category.name).toBe('Editada')
  })

  it('returns 409 on duplicate name', async () => {
    const prismaError = Object.assign(new Error(), { code: 'P2002' })
    vi.mocked(prisma.category.update).mockRejectedValue(prismaError)

    const res = await request(createApp()).put('/api/categories/cat-1').send({ name: 'Duplicada' })

    expect(res.status).toBe(409)
  })

  it('returns 404 on not found', async () => {
    const prismaError = Object.assign(new Error(), { code: 'P2025' })
    vi.mocked(prisma.category.update).mockRejectedValue(prismaError)

    const res = await request(createApp()).put('/api/categories/nope').send({ name: 'Test' })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/categories/:id', () => {
  it('deletes a category', async () => {
    vi.mocked(prisma.category.delete).mockResolvedValue({} as any)

    const res = await request(createApp()).delete('/api/categories/cat-1')

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 404 when not found', async () => {
    const prismaError = Object.assign(new Error(), { code: 'P2025' })
    vi.mocked(prisma.category.delete).mockRejectedValue(prismaError)

    const res = await request(createApp()).delete('/api/categories/nope')

    expect(res.status).toBe(404)
  })
})
