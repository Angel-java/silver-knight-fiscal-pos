import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import bcrypt from 'bcryptjs'

vi.mock('../../database/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn()
    },
    company: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn()
    },
    setting: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn()
    },
    $transaction: vi.fn()
  }
}))

vi.mock('../../auth/autoAdmin', () => ({
  ADMIN_USERNAME: 'admin',
  autoCreateAdmin: vi.fn()
}))

vi.mock('../../middleware/auth', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    authMiddleware: (req: any, _res: any, next: any) => {
      req.user = { userId: 'test-user', username: 'test', role: 'admin' }
      next()
    },
    adminMiddleware: (_req: any, _res: any, next: any) => {
      next()
    }
  }
})

import { prisma } from '../../database/prisma'
import authRouter from '../auth'
import { errorHandler } from '../../middleware/errorHandler'

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRouter)
  app.use(errorHandler)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/auth/login', () => {
  it('returns token and user on valid credentials', async () => {
    const hashedPin = await bcrypt.hash('1234', 10)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u-1',
      username: 'admin',
      role: 'admin',
      isActive: true,
      pin: hashedPin
    } as any)

    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ username: 'admin', pin: '1234' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
    expect(res.body.user.username).toBe('admin')
  })

  it('returns 400 when username or pin missing', async () => {
    const res = await request(createApp()).post('/api/auth/login').send({ username: 'admin' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it('returns 401 on invalid username', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ username: 'nobody', pin: '1234' })

    expect(res.status).toBe(401)
    expect(res.body.error).toContain('inválidas')
  })

  it('returns 401 on wrong pin', async () => {
    const hashedPin = await bcrypt.hash('correct', 10)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u-1',
      username: 'admin',
      role: 'admin',
      isActive: true,
      pin: hashedPin
    } as any)

    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ username: 'admin', pin: 'wrong' })

    expect(res.status).toBe(401)
  })

  it('returns 401 when user is inactive', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u-1',
      username: 'inactive',
      role: 'operator',
      isActive: false
    } as any)

    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ username: 'inactive', pin: '1234' })

    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/setup', () => {
  it('creates company and gerente user', async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(0)
    const mockTx = {
      company: { create: vi.fn().mockResolvedValue({ id: 'c-1', name: 'TestCo', rif: 'J-123' }) },
      user: { create: vi.fn().mockResolvedValue({ id: 'u-1', username: 'gerente', role: 'gerente' }) },
      setting: { upsert: vi.fn().mockResolvedValue({ key: 'profile', value: 'small' }) }
    }
    vi.mocked(prisma.$transaction).mockImplementation((cb: any) => cb(mockTx))

    const res = await request(createApp())
      .post('/api/auth/setup')
      .send({
        profile: 'small',
        company: { name: 'TestCo', rif: 'J-123', address: 'Addr' },
        adminUser: { username: 'gerente', pin: 'gerente123' }
      })

    expect(res.status).toBe(201)
    expect(res.body.token).toBeDefined()
    expect(res.body.company.name).toBe('TestCo')
    expect(mockTx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'gerente' }) })
    )
  })

  it('returns 400 when system already set up', async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(1)

    const res = await request(createApp())
      .post('/api/auth/setup')
      .send({ profile: 'small', company: { name: 'Test', rif: 'J-1' }, adminUser: { username: 'a', pin: '1' } })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('ya está configurado')
  })

  it('returns 400 when data is incomplete', async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(0)

    const res = await request(createApp())
      .post('/api/auth/setup')
      .send({ profile: 'small', company: { name: 'Test' }, adminUser: {} })

    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })
})

describe('GET /api/auth/me', () => {
  it('returns current user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'test-user',
      username: 'test',
      role: 'admin'
    } as any)

    const res = await request(createApp()).get('/api/auth/me')

    expect(res.status).toBe(200)
    expect(res.body.user.username).toBe('test')
  })

  it('returns 404 when user not found in DB', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const res = await request(createApp()).get('/api/auth/me')

    expect(res.status).toBe(404)
  })
})

describe('GET /api/auth/company', () => {
  it('returns company info', async () => {
    vi.mocked(prisma.company.findFirst).mockResolvedValue({ id: 'c-1', name: 'TestCo' } as any)

    const res = await request(createApp()).get('/api/auth/company')

    expect(res.status).toBe(200)
    expect(res.body.company.name).toBe('TestCo')
  })
})

describe('PUT /api/auth/company', () => {
  it('updates company info', async () => {
    vi.mocked(prisma.company.findFirst)
      .mockResolvedValueOnce({ id: 'c-1', name: 'Old', rif: 'J-1' } as any)
      .mockResolvedValueOnce(null) // no duplicate RIF
    const updated = { id: 'c-1', name: 'NewCo', rif: 'J-1' }
    vi.mocked(prisma.company.update).mockResolvedValue(updated as any)

    const res = await request(createApp())
      .put('/api/auth/company')
      .send({ name: 'NewCo', rif: 'J-1' })

    expect(res.status).toBe(200)
    expect(res.body.company.name).toBe('NewCo')
  })

  it('returns 400 without name or rif', async () => {
    const res = await request(createApp()).put('/api/auth/company').send({ name: '' })

    expect(res.status).toBe(400)
  })

  it('returns 409 on duplicate RIF', async () => {
    vi.mocked(prisma.company.findFirst)
      .mockResolvedValueOnce({ id: 'c-1', name: 'Existing', rif: 'J-1' } as any)
      .mockResolvedValueOnce({ id: 'c-2', name: 'Other', rif: 'J-999' } as any)

    const res = await request(createApp())
      .put('/api/auth/company')
      .send({ name: 'NewCo', rif: 'J-999' })

    expect(res.status).toBe(409)
  })
})
