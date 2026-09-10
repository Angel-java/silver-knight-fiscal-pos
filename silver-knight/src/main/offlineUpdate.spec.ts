import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'

const { mockApp, mockAutoUpdater, mockSpawn } = vi.hoisted(() => ({
  mockApp: {
    getPath: vi.fn(() => 'C:\\tmp\\userData')
  },
  mockAutoUpdater: {},
  mockSpawn: vi.fn()
}))

vi.mock('electron', () => ({
  app: mockApp
}))

vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater
}))

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args)
}))

vi.mock('./logger', () => ({
  log: () => undefined
}))

import {
  readOfflineManifest,
  findOfflineInstaller,
  getApplicableOfflineInstaller,
  installOfflinePackage,
  __setOfflineDirForTests,
  __resetOfflineEnvForTests
} from './offlineUpdate'
import { __setInstallersDirForTests, sha512Base64 } from './installerCache'

describe('offlineUpdate', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sk-offline-'))
    __setOfflineDirForTests(dir)
    __setInstallersDirForTests(dir)
  })

  afterEach(() => {
    __resetOfflineEnvForTests()
    __setInstallersDirForTests(null)
    mockSpawn.mockReset()
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  function writeInstaller(version: string): string {
    const file = join(dir, `silver-knight-${version}-setup.exe`)
    const buf = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2 * 1024 * 1024)])
    writeFileSync(file, buf)
    return file
  }

  function writeManifest(version: string, file: string, sha512?: string): void {
    writeFileSync(
      join(dir, 'manifest.json'),
      JSON.stringify({ version, file, ...(sha512 ? { sha512 } : {}) }),
      'utf-8'
    )
  }

  it('returns null when there is no manifest', () => {
    expect(readOfflineManifest()).toBeNull()
    expect(findOfflineInstaller()).toBeNull()
  })

  it('reads a manifest and finds the installer file', () => {
    const file = writeInstaller('2.0.0')
    const manifestFile = file.split(/[\\/]/).pop()!
    writeManifest('2.0.0', manifestFile)
    const manifest = readOfflineManifest()
    expect(manifest?.version).toBe('2.0.0')
    const found = findOfflineInstaller()
    expect(found?.version).toBe('2.0.0')
  })

  it('rejects a manifest whose file is missing', () => {
    writeManifest('2.0.0', 'does-not-exist.exe')
    expect(findOfflineInstaller()).toBeNull()
  })

  it('returns the offline installer only when newer than installed', () => {
    const file = writeInstaller('2.0.0')
    const manifestFile = file.split(/[\\/]/).pop()!
    writeManifest('2.0.0', manifestFile)
    expect(getApplicableOfflineInstaller('1.0.0')).not.toBeNull()
    expect(getApplicableOfflineInstaller('3.0.0')).toBeNull()
    expect(getApplicableOfflineInstaller('2.0.0')).toBeNull()
  })

  it('rejects when the sha512 does not match', () => {
    const file = writeInstaller('2.0.0')
    const manifestFile = file.split(/[\\/]/).pop()!
    writeManifest('2.0.0', manifestFile, 'aGVsbG8=') // decoy
    expect(getApplicableOfflineInstaller('1.0.0')).toBeNull()
  })

  it('accepts when the sha512 matches', () => {
    const file = writeInstaller('2.0.0')
    const manifestFile = file.split(/[\\/]/).pop()!
    writeManifest('2.0.0', manifestFile, sha512Base64(file))
    expect(getApplicableOfflineInstaller('1.0.0')).not.toBeNull()
  })

  it('installOfflinePackage reports offline-not-applicable when none', async () => {
    const result = await installOfflinePackage('9.9.9')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('offline-not-applicable')
  })

  it('installOfflinePackage installs a matching newer package', async () => {
    const file = writeInstaller('2.0.0')
    const manifestFile = file.split(/[\\/]/).pop()!
    writeManifest('2.0.0', manifestFile, sha512Base64(file))
    mockSpawn.mockReturnValue({
      once: (event: string, cb: (code?: number) => void) => {
        if (event === 'exit') setTimeout(() => cb(0), 5)
      },
      kill: () => undefined
    })
    const result = await installOfflinePackage('1.0.0')
    expect(result.ok).toBe(true)
    expect(result.version).toBe('2.0.0')
    expect(mockSpawn).toHaveBeenCalled()
  })

  it('manifest ignores unknown fields', () => {
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ version: 'x', file: '' }), 'utf-8')
    expect(readOfflineManifest()).toBeNull()
  })
})
