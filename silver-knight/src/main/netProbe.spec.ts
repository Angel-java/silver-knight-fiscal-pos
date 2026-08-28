import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isReallyOnline } from './netProbe'

const { mockNetIsOnline } = vi.hoisted(() => ({
  mockNetIsOnline: vi.fn(() => true)
}))

vi.mock('electron', () => ({
  net: {
    isOnline: mockNetIsOnline
  }
}))

vi.mock('./logger', () => ({
  log: vi.fn()
}))

import {
  __setOnlineOverrideForTests,
  __setFetchResultForTests
} from './netProbe'

describe('netProbe', () => {
  beforeEach(() => {
    mockNetIsOnline.mockReturnValue(true)
    __setOnlineOverrideForTests(null)
    __setFetchResultForTests(null)
  })

  afterEach(() => {
    __setOnlineOverrideForTests(null)
    __setFetchResultForTests(null)
    vi.restoreAllMocks()
  })

  it('treats net.isOnline() false as offline without probing', async () => {
    mockNetIsOnline.mockReturnValue(false)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(await isReallyOnline()).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns true when the probe succeeds on the first attempt', async () => {
    __setFetchResultForTests({ ok: true })
    expect(await isReallyOnline()).toBe(true)
  })

  it('recovers on a later attempt after an initial failure', async () => {
    let calls = 0
    __setFetchResultForTests({ ok: true })
    mockNetIsOnline.mockReturnValue(true)
    // Simulate first attempt throwing by toggling the injected result after one call
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockImplementation(() => {
      calls++
      if (calls === 1) return Promise.reject(new Error('network down'))
      return Promise.resolve({ ok: true, status: 200 } as Response)
    })
    // ensure injected override is not active for the retry path
    __setFetchResultForTests(null)

    const result = await isReallyOnline()
    expect(mockNetIsOnline).toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(result).toBe(true)
  })

  it('treats repeated probe failures as offline (falso positivo de isOnline)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('ETIMEDOUT'))
    expect(await isReallyOnline()).toBe(false)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('returns the forced offline override without probing', async () => {
    __setOnlineOverrideForTests(false)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(await isReallyOnline()).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
