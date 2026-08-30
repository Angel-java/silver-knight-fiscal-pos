import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import bcrypt from 'bcryptjs'

vi.mock('../../database/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn()
    }
  }
}))

import { prisma } from '../../database/prisma'

function mockUser(overrides = {}) {
  return {
    id: 'root-1',
    username: 'admin',
    fullName: 'Dueño del Sistema',
    pin: 'hash',
    role: 'root',
    permissions: null,
    ...overrides
  }
}

const user = prisma.user as any

describe('autoCreateRoot', () => {
  let autoCreateRoot: () => Promise<void>

  async function load(env: Record<string, string>) {
    for (const [k, v] of Object.entries(env)) {
      vi.stubEnv(k, v)
    }
    vi.resetModules()
    const mod = await import('../autoAdmin')
    autoCreateRoot = mod.autoCreateRoot
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('no hace nada si ROOT_PIN no está configurado', async () => {
    await load({})
    await autoCreateRoot()
    expect(user.findUnique).not.toHaveBeenCalled()
    expect(user.create).not.toHaveBeenCalled()
  })

  it('crea el root si no existe', async () => {
    await load({ ROOT_USERNAME: 'admin', ROOT_PIN: 's3cret' })
    user.findUnique.mockResolvedValue(null)
    user.findFirst.mockResolvedValue(null)
    await autoCreateRoot()
    expect(user.create).toHaveBeenCalledTimes(1)
    const data = user.create.mock.calls[0][0].data
    expect(data.username).toBe('admin')
    expect(data.role).toBe('root')
    expect(bcrypt.compareSync('s3cret', data.pin)).toBe(true)
  })

  it('no toca el root si el PIN ya es el actual', async () => {
    const current = bcrypt.hashSync('s3cret', 10)
    await load({ ROOT_USERNAME: 'admin', ROOT_PIN: 's3cret' })
    user.findUnique.mockResolvedValue(mockUser({ pin: current, role: 'root' }))
    await autoCreateRoot()
    expect(user.update).not.toHaveBeenCalled()
    expect(user.create).not.toHaveBeenCalled()
  })

  it('reconcilia el PIN del root existente si cambió en el .env', async () => {
    const old = bcrypt.hashSync('viejo', 10)
    await load({ ROOT_USERNAME: 'admin', ROOT_PIN: 'nuevo' })
    user.findUnique.mockResolvedValue(mockUser({ pin: old, role: 'root' }))
    await autoCreateRoot()
    expect(user.update).toHaveBeenCalledTimes(1)
    const data = user.update.mock.calls[0][0].data
    expect(bcrypt.compareSync('nuevo', data.pin)).toBe(true)
    expect(data.role).toBe('root')
  })

  it('renombra un root con nombre legacy (ej. alucard) al ROOT_USERNAME', async () => {
    await load({ ROOT_USERNAME: 'admin', ROOT_PIN: 'nuevo' })
    user.findUnique.mockResolvedValue(null)
    user.findFirst.mockResolvedValue(mockUser({ username: 'alucard', pin: bcrypt.hashSync('x', 10) }))
    await autoCreateRoot()
    expect(user.update).toHaveBeenCalledTimes(1)
    const data = user.update.mock.calls[0][0].data
    expect(data.username).toBe('admin')
    expect(bcrypt.compareSync('nuevo', data.pin)).toBe(true)
  })
  it('no-op si ROOT_PIN es string vacío (no fija PIN erróneo)', async () => {
    await load({ ROOT_USERNAME: 'admin', ROOT_PIN: '' })
    await autoCreateRoot()
    expect(user.findUnique).not.toHaveBeenCalled()
    expect(user.update).not.toHaveBeenCalled()
    expect(user.create).not.toHaveBeenCalled()
  })

  it('reconcilia tras un cambio de .env entre arranques de la misma BD', async () => {
    const primerPin = bcrypt.hashSync('pin-v1', 10)
    const rootGuardado = mockUser({ pin: primerPin, role: 'root' })

    await load({ ROOT_USERNAME: 'admin', ROOT_PIN: 'pin-v1' })
    user.findUnique.mockResolvedValue(rootGuardado)
    await autoCreateRoot()
    expect(user.update).not.toHaveBeenCalled()

    await load({ ROOT_USERNAME: 'admin', ROOT_PIN: 'pin-v2' })
    user.findUnique.mockResolvedValue(rootGuardado)
    await autoCreateRoot()
    expect(user.update).toHaveBeenCalledTimes(1)
    const data = user.update.mock.calls[0][0].data
    expect(bcrypt.compareSync('pin-v2', data.pin)).toBe(true)
  })
})