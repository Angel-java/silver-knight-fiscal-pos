import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockExec, mockExistsSync } = vi.hoisted(() => ({
  mockExec: vi.fn(),
  mockExistsSync: vi.fn(() => false)
}))

vi.mock('child_process', () => ({
  exec: mockExec
}))

vi.mock('fs', () => ({
  existsSync: mockExistsSync
}))

vi.mock('./logger', () => ({
  log: vi.fn()
}))

import {
  getCachedDockerExe,
  getDockerCandidatePaths,
  probeDockerVersion,
  resolveDockerOnce,
  resolveDockerWithRetry,
  DOCKER_CHECK_ATTEMPTS,
  __resetDockerResolutionForTests
} from './docker-path'

const RETRY_DELAY_MS = 1500
const TOTAL_RETRY_WINDOW_MS = 1500 + 3000 + 100

function succeedWithVersion(version: string): void {
  mockExec.mockImplementation(
    (_cmd: string, _opts: unknown, cb: (err: unknown, out: { stdout: string }) => void) => {
      cb(null, { stdout: `Docker version ${version}, build 211d84d0\n` })
    }
  )
}

function failAsTimeout(): void {
  mockExec.mockImplementation(
    (_cmd: string, _opts: unknown, cb: (err: unknown, out?: unknown) => void) => {
      const err = new Error('spawn ETIMEDOUT')
      ;(err as { killed?: boolean }).killed = true
      cb(err)
    }
  )
}

describe('docker-path', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
    __resetDockerResolutionForTests()
    process.env.LOCALAPPDATA = 'C:\\Users\\test\\AppData\\Local'
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.LOCALAPPDATA
  })

  it('resolves docker via PATH and caches the result', async () => {
    succeedWithVersion('27.3.1')

    const first = await resolveDockerOnce()
    expect(first).toEqual({ exe: 'docker', version: '27.3.1' })
    expect(getCachedDockerExe()).toBe('docker')

    await resolveDockerOnce()
    expect(mockExec).toHaveBeenCalledTimes(1)
  })

  it('falls back to an absolute install path when PATH lookup fails', async () => {
    mockExistsSync.mockReturnValue(true)
    mockExec.mockImplementation(
      (cmd: string, _opts: unknown, cb: (err: unknown, out?: { stdout: string }) => void) => {
        if (cmd.startsWith('"C:\\')) {
          cb(null, { stdout: 'Docker version 26.0.0\n' })
        } else {
          cb(new Error("'docker' is not recognized"))
        }
      }
    )

    const resolved = await resolveDockerOnce()
    expect(resolved?.exe).toBe(getDockerCandidatePaths()[0])
    expect(resolved?.version).toBe('26.0.0')
    expect(getCachedDockerExe()).toBe(getDockerCandidatePaths()[0])
  })

  it('skips missing absolute candidates without probing them', async () => {
    failAsTimeout()

    const resolved = await resolveDockerOnce()
    expect(resolved).toBeNull()
    const probed = mockExec.mock.calls.map(([cmd]) => cmd as string)
    expect(probed.every((c) => c.startsWith('"docker"'))).toBe(true)
  })

  it('recovers on a later attempt when the first lookup stalls', async () => {
    let calls = 0
    mockExec.mockImplementation(
      (_cmd: string, _opts: unknown, cb: (err: unknown, out?: { stdout: string }) => void) => {
        calls++
        if (calls === 1) {
          const err = new Error('command timed out')
          ;(err as { killed?: boolean }).killed = true
          cb(err)
        } else {
          cb(null, { stdout: 'Docker version 27.0.0\n' })
        }
      }
    )

    const pending = resolveDockerWithRetry()
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    const resolved = await pending

    expect(resolved).toEqual({ exe: 'docker', version: '27.0.0' })
    expect(mockExec).toHaveBeenCalledTimes(2)
  })

  it('gives up after DOCKER_CHECK_ATTEMPTS attempts when docker truly absent', async () => {
    failAsTimeout()
    mockExistsSync.mockReturnValue(false)

    const pending = resolveDockerWithRetry()
    await vi.advanceTimersByTimeAsync(TOTAL_RETRY_WINDOW_MS)
    const resolved = await pending

    expect(resolved).toBeNull()
    expect(mockExec).toHaveBeenCalledTimes(DOCKER_CHECK_ATTEMPTS)
    expect(getCachedDockerExe()).toBe('docker')
  })

  it('reports unparseable --version output as not found', async () => {
    mockExec.mockImplementation(
      (_cmd: string, _opts: unknown, cb: (err: null, out: { stdout: string }) => void) => {
        cb(null, { stdout: 'some antivirus banner garbage\n' })
      }
    )

    const version = await probeDockerVersion('docker')
    expect(version).toBeNull()
  })
})
