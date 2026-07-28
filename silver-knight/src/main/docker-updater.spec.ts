import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '1.1.0'),
    isPackaged: false
  }
}))

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn()
}))

vi.mock('./docker', () => ({
  buildCompose: vi.fn(),
  stopCompose: vi.fn(),
  startCompose: vi.fn()
}))

import { checkAndRebuildServer } from './docker-updater'
import { readFileSync, existsSync } from 'fs'
import { buildCompose, stopCompose, startCompose } from './docker'

const mockReadFileSync = vi.mocked(readFileSync)
const mockExistsSync = vi.mocked(existsSync)
const mockBuildCompose = vi.mocked(buildCompose)
const mockStopCompose = vi.mocked(stopCompose)
const mockStartCompose = vi.mocked(startCompose)

describe('checkAndRebuildServer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns rebuilt=false when versions match', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('1.1.0')

    const result = await checkAndRebuildServer()

    expect(result).toEqual({ rebuilt: false })
    expect(mockBuildCompose).not.toHaveBeenCalled()
  })

  it('rebuilds when versions differ', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('1.0.0')
    mockBuildCompose.mockResolvedValue({ success: true })
    mockStartCompose.mockResolvedValue({ success: true })

    const result = await checkAndRebuildServer()

    expect(result).toEqual({ rebuilt: true })
    expect(mockBuildCompose).toHaveBeenCalled()
    expect(mockStopCompose).toHaveBeenCalled()
    expect(mockStartCompose).toHaveBeenCalled()
  })

  it('rebuilds when version file does not exist', async () => {
    mockExistsSync.mockReturnValue(false)
    mockBuildCompose.mockResolvedValue({ success: true })
    mockStartCompose.mockResolvedValue({ success: true })

    const result = await checkAndRebuildServer()

    expect(result).toEqual({ rebuilt: true })
    expect(mockBuildCompose).toHaveBeenCalled()
  })

  it('returns error when build fails', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('1.0.0')
    mockBuildCompose.mockResolvedValue({ success: false, error: 'docker build failed' })

    const result = await checkAndRebuildServer()

    expect(result).toEqual({ rebuilt: false, error: 'docker build failed' })
    expect(mockStopCompose).not.toHaveBeenCalled()
    expect(mockStartCompose).not.toHaveBeenCalled()
  })

  it('returns error when start fails after build', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('1.0.0')
    mockBuildCompose.mockResolvedValue({ success: true })
    mockStartCompose.mockResolvedValue({ success: false, error: 'port conflict' })

    const result = await checkAndRebuildServer()

    expect(result).toEqual({ rebuilt: false, error: 'port conflict' })
  })

  it('calls onOutput callback with progress lines', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('1.0.0')
    mockBuildCompose.mockImplementation(async (onOutput) => {
      onOutput?.('Building image...')
      return { success: true }
    })
    mockStartCompose.mockImplementation(async (onOutput) => {
      onOutput?.('Starting containers...')
      return { success: true }
    })

    const onOutput = vi.fn()
    await checkAndRebuildServer(onOutput)

    expect(onOutput).toHaveBeenCalledWith('Building image...')
    expect(onOutput).toHaveBeenCalledWith('Starting containers...')
  })

  it('handles readFileSync error gracefully', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation(() => {
      throw new Error('permission denied')
    })
    mockBuildCompose.mockResolvedValue({ success: true })
    mockStartCompose.mockResolvedValue({ success: true })

    const result = await checkAndRebuildServer()

    expect(result).toEqual({ rebuilt: true })
    expect(mockBuildCompose).toHaveBeenCalled()
  })

  it('handles readFileSync returning empty string', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('')
    mockBuildCompose.mockResolvedValue({ success: true })
    mockStartCompose.mockResolvedValue({ success: true })

    const result = await checkAndRebuildServer()

    expect(result).toEqual({ rebuilt: true })
  })
})
