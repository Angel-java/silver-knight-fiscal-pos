import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockApp, mockExecSync } = vi.hoisted(() => ({
  mockApp: {
    isPackaged: true,
    getVersion: vi.fn(() => '1.0.0'),
    getPath: vi.fn(() => 'C:\\tmp\\userData')
  },
  mockExecSync: vi.fn<(...args: unknown[]) => string>(() => '')
}))

vi.mock('electron', () => ({
  app: mockApp
}))

vi.mock('child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args)
}))

vi.mock('./logger', () => ({
  log: () => undefined
}))

vi.mock('./bootState', () => ({
  readBootState: () => ({
    appVersion: '1.0.0',
    lastCleanShutdown: false,
    consecutiveFailures: 2,
    lastUpdateAppliedVersion: '1.0.0',
    failuresAfterUpdate: 2,
    pendingUpgrade: null,
    lastBootAt: null
  })
}))

vi.mock('./offlineUpdate', () => ({
  installOfflinePackage: vi.fn(async () => ({ ok: false, error: 'offline-not-applicable' })),
  listOfflineFiles: vi.fn(() => [])
}))

vi.mock('./installerCache', () => ({
  compareVersions: vi.fn((a: string, b: string) => {
    const [ma, mb] = [a, b].map((v) => Number(v.split('.')[0]))
    return ma > mb ? 1 : ma < mb ? -1 : 0
  }),
  installInstallerBlocking: vi.fn(async () => ({ ok: true, exitCode: 0 })),
  sha512Base64: vi.fn(() => 'AAAAAAAA'),
  verifyInstallerFile: vi.fn(() => ({ ok: true }))
}))

import { ensureWatchdogRegistration, parseLatestYml } from './watchdog'

describe('watchdog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApp.isPackaged = true
  })

  it('parses version and sha512 from electron-builder latest.yml', () => {
    const yml = [
      'version: 2.4.0',
      'files:',
      '  - url: silver-knight-2.4.0-setup.exe',
      '    sha512: abc123+/=',
      '    size: 12345',
      'path: silver-knight-2.4.0-setup.exe',
      'sha512: def456',
      'releaseDate: 2026-01-01T00:00:00.000Z'
    ].join('\n')
    const info = parseLatestYml(yml)
    expect(info.version).toBe('2.4.0')
    expect(info.sha512).toBe('abc123+/=')
  })

  it('leaves fields empty when the yml is malformed', () => {
    const info = parseLatestYml('nope: 1')
    expect(info.version).toBe('')
    expect(info.sha512).toBeUndefined()
  })

  it('registers the watchdog when packaged and the entry is missing', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('not found')
    })
    ensureWatchdogRegistration()
    const calls = mockExecSync.mock.calls.map((c) => String(c[0]))
    expect(calls.some((c) => c.includes('reg add'))).toBe(true)
    expect(calls.some((c) => c.includes('SilverKnightWatchdog'))).toBe(true)
  })

  it('skips registration when the value already points to this exe', () => {
    mockExecSync.mockImplementation((cmd: unknown) => {
      if (String(cmd).includes('reg query')) {
        return `    SilverKnightWatchdog    REG_SZ    "${process.execPath}" --watchdog`
      }
      return ''
    })
    ensureWatchdogRegistration()
    const calls = mockExecSync.mock.calls.map((c) => String(c[0]))
    expect(calls.some((c) => c.includes('reg add'))).toBe(false)
  })

  it('does nothing in dev builds', () => {
    mockApp.isPackaged = false
    ensureWatchdogRegistration()
    expect(mockExecSync).not.toHaveBeenCalled()
  })
})
