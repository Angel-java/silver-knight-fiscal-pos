import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const { mockBuildCompose, mockImageExists, mockIsOnline, mockIsReallyOnline } = vi.hoisted(() => ({
  mockBuildCompose: vi.fn(),
  mockImageExists: vi.fn(),
  mockIsOnline: vi.fn(() => true),
  mockIsReallyOnline: vi.fn(async () => true)
}))

const userDataDir = mkdtempSync(join(tmpdir(), 'sk-server-image-'))

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '1.0.0'),
    getPath: vi.fn(() => userDataDir)
  },
  net: {
    isOnline: () => mockIsOnline()
  }
}))

vi.mock('./docker', () => ({
  buildCompose: mockBuildCompose,
  imageExists: mockImageExists,
  SERVER_IMAGE: 'silverknight-server:latest'
}))

vi.mock('./logger', () => ({
  log: vi.fn()
}))

vi.mock('./netProbe', () => ({
  isReallyOnline: () => mockIsReallyOnline()
}))

import { ensureServerImage } from './server-image'

function sentinelPath(): string {
  return join(userDataDir, '.server-version')
}

function writeSentinel(version: string): void {
  writeFileSync(sentinelPath(), version, 'utf-8')
}

function removeSentinel(): void {
  if (existsSync(sentinelPath())) rmSync(sentinelPath())
}

afterAll(() => {
  rmSync(userDataDir, { recursive: true, force: true })
})

describe('ensureServerImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    removeSentinel()
    mockIsReallyOnline.mockResolvedValue(true)
    mockImageExists.mockResolvedValue(true)
    mockBuildCompose.mockResolvedValue({ success: true })
  })

  it('skips rebuild when sentinel version matches app version', async () => {
    writeSentinel('1.0.0')
    const result = await ensureServerImage()
    expect(result).toEqual({ rebuilt: false })
    expect(mockBuildCompose).not.toHaveBeenCalled()
  })

  it('rebuilds when online and sentinel version differs', async () => {
    writeSentinel('1.0.9')
    const result = await ensureServerImage()
    expect(result).toEqual({ rebuilt: true })
    expect(mockBuildCompose).toHaveBeenCalled()
    expect(readFileSync(sentinelPath(), 'utf-8')).toBe('1.0.0')
  })

  it('rebuilds when online and no sentinel exists', async () => {
    const result = await ensureServerImage()
    expect(result).toEqual({ rebuilt: true })
    expect(mockBuildCompose).toHaveBeenCalled()
    expect(readFileSync(sentinelPath(), 'utf-8')).toBe('1.0.0')
  })

  it('skips rebuild when offline with cached image (skippedOffline)', async () => {
    writeSentinel('1.0.9')
    mockIsReallyOnline.mockResolvedValue(false)
    mockImageExists.mockResolvedValue(true)
    const result = await ensureServerImage()
    expect(result).toEqual({ rebuilt: false, skippedOffline: true })
    expect(mockBuildCompose).not.toHaveBeenCalled()
  })

  it('returns error when offline without cached image', async () => {
    writeSentinel('1.0.9')
    mockIsReallyOnline.mockResolvedValue(false)
    mockImageExists.mockResolvedValue(false)
    const result = await ensureServerImage()
    expect(result.rebuilt).toBe(false)
    expect(result.skippedOffline).toBe(true)
    expect(result.error).toBeTruthy()
    expect(mockBuildCompose).not.toHaveBeenCalled()
  })

  it('continues with cached image when build fails and image exists', async () => {
    writeSentinel('1.0.9')
    mockBuildCompose.mockResolvedValue({ success: false, error: 'registry timeout' })
    const result = await ensureServerImage()
    expect(result).toEqual({ rebuilt: false, error: 'registry timeout' })
    expect(readFileSync(sentinelPath(), 'utf-8')).toBe('1.0.9')
  })

  it('returns error when build fails and no cached image', async () => {
    writeSentinel('1.0.9')
    mockImageExists.mockResolvedValue(false)
    mockBuildCompose.mockResolvedValue({ success: false, error: 'build broke' })
    const result = await ensureServerImage()
    expect(result).toEqual({ rebuilt: false, error: 'build broke' })
    expect(readFileSync(sentinelPath(), 'utf-8')).toBe('1.0.9')
  })
})
