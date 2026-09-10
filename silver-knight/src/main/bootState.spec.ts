import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'

const { mockApp } = vi.hoisted(() => ({
  mockApp: {
    getVersion: vi.fn(() => '1.2.0'),
    getPath: vi.fn(() => 'C:\\tmp\\userData')
  }
}))

vi.mock('electron', () => ({
  app: mockApp
}))

vi.mock('./logger', () => ({
  log: () => undefined
}))

import {
  initBootState,
  markBootReady,
  markBootFailed,
  markCrash,
  markUpdateApplied,
  setPendingUpgrade,
  readBootState,
  __setUserDataDirForTests,
  __resetBootStateForTests
} from './bootState'

describe('bootState', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sk-boot-'))
    mockApp.getVersion.mockReturnValue('1.2.0')
    __setUserDataDirForTests(dir)
  })

  afterEach(() => {
    __resetBootStateForTests(null)
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  function readRawState(): Record<string, unknown> {
    const p = join(dir, 'bootState.json')
    return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>) : {}
  }

  it('starts clean on first boot', () => {
    const state = initBootState()
    expect(state.lastCleanShutdown).toBe(false)
    expect(state.consecutiveFailures).toBe(0)
    expect(state.appVersion).toBe('1.2.0')
  })

  it('clears failure flags on a clean boot', () => {
    initBootState()
    markBootReady()
    const state = readBootState()
    expect(state.lastCleanShutdown).toBe(true)
    expect(state.consecutiveFailures).toBe(0)
  })

  it('increments consecutive failures after an unclean boot', () => {
    markBootFailed('boom')
    const state = initBootState()
    expect(state.consecutiveFailures).toBe(1)
  })

  it('resets failures when a later boot is clean', () => {
    markBootFailed('boom')
    initBootState()
    markBootReady()
    initBootState()
    expect(readBootState().consecutiveFailures).toBe(0)
  })

  it('increments failuresAfterUpdate only across an update boundary', () => {
    markUpdateApplied('1.2.0')
    markBootFailed('boom') // app started with 1.2.0 after update yet failed
    const state = initBootState()
    expect(state.failuresAfterUpdate).toBe(1)
    expect(state.lastUpdateAppliedVersion).toBe('1.2.0')
  })

  it('does not count failures as post-update when version changed', () => {
    markUpdateApplied('1.1.0')
    mockApp.getVersion.mockReturnValue('1.2.0') // app moved to a new version
    markBootFailed('boom')
    const state = initBootState()
    expect(state.failuresAfterUpdate).toBe(0)
  })

  it('markCrash leaves a dirty shutdown so the next boot is flagged', () => {
    markCrash('renderer-crashed')
    const state = initBootState()
    expect(state.consecutiveFailures).toBe(1)
  })

  it('pendingUpgrade is stored and cleared once applied', () => {
    setPendingUpgrade('9.9.9')
    mockApp.getVersion.mockReturnValue('9.9.9')
    initBootState()
    markUpdateApplied('9.9.9')
    expect(readBootState().pendingUpgrade).toBe('9.9.9')
    markBootReady()
    expect(readBootState().pendingUpgrade).toBeNull()
  })

  it('keeps pendingUpgrade when the app booted at a different version', () => {
    setPendingUpgrade('9.9.9')
    markBootReady()
    expect(readBootState().pendingUpgrade).toBe('9.9.9')
  })

  it('persists app version in the file', () => {
    initBootState()
    expect(readRawState().appVersion).toBe('1.2.0')
  })
})
