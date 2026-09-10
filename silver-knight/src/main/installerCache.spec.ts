import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'

const { mockApp, mockAutoUpdater, mockSpawn } = vi.hoisted(() => ({
  mockApp: {
    getPath: vi.fn(() => 'C:\\tmp\\userData')
  },
  mockAutoUpdater: {
    downloadedUpdateHelper: { downloadedUpdateFile: null as string | null }
  },
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
  parseVersion,
  compareVersions,
  sha512Base64,
  cacheInstaller,
  listCachedInstallers,
  pickRollbackInstaller,
  verifyInstallerFile,
  cachedInstallerFileName,
  launchInstallerDetached,
  installInstallerBlocking,
  __setInstallersDirForTests
} from './installerCache'

describe('installerCache', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sk-cache-'))
    mockApp.getPath.mockReturnValue(dir)
    __setInstallersDirForTests(dir)
    mockAutoUpdater.downloadedUpdateHelper.downloadedUpdateFile = null
  })

  afterEach(() => {
    __setInstallersDirForTests(null)
    mockSpawn.mockReset()
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  function makeExe(version: string): string {
    const exe = join(dir, `src-${version}.exe`)
    // NSIS installers are >1MB with an MZ header
    const buf = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2 * 1024 * 1024)])
    writeFileSync(exe, buf)
    return exe
  }

  it('parses versions and compares them', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3])
    expect(parseVersion('not-a-version')).toBeNull()
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1)
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1)
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
    expect(compareVersions('bad', '1.0.0')).toBe(-1)
  })

  it('computes sha512 in base64', () => {
    const file = join(dir, 'blob.bin')
    writeFileSync(file, Buffer.from('hello'))
    expect(sha512Base64(file)).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('caches an installer and writes a sha512 sidecar', () => {
    const src = makeExe('1.1.0')
    const cached = cacheInstaller(src, '1.1.0')
    expect(cached).not.toBeNull()
    expect(existsSync(cached!.filePath)).toBe(true)
    expect(existsSync(`${cached!.filePath}.sha512`)).toBe(true)
    const list = listCachedInstallers()
    expect(list.some((c) => c.version === '1.1.0')).toBe(true)
  })

  it('verifies an installer file (MZ, size, sha sidecar)', () => {
    const src = makeExe('1.1.0')
    const cached = cacheInstaller(src, '1.1.0')
    const check = verifyInstallerFile(cached!.filePath)
    expect(check.ok).toBe(true)
  })

  it('rejects corrupt files', () => {
    const bad = join(dir, 'bad.exe')
    writeFileSync(bad, 'nope', 'utf-8')
    expect(verifyInstallerFile(bad).ok).toBe(false)
  })

  it('prunes to the newest MAX_CACHED_INSTALLERS', () => {
    for (const v of ['1.0.0', '1.0.1', '1.0.2']) {
      cacheInstaller(makeExe(v), v)
    }
    const list = listCachedInstallers()
    expect(list.map((c) => c.version)).toEqual(['1.0.2', '1.0.1'])
  })

  it('picks the newest cached version older than the current one', () => {
    for (const v of ['1.0.0', '1.0.1']) {
      cacheInstaller(makeExe(v), v)
    }
    const rollback = pickRollbackInstaller('1.0.2')
    expect(rollback?.version).toBe('1.0.1')
    expect(pickRollbackInstaller('1.0.0')).toBeNull()
  })

  it('names installers with the release convention', () => {
    expect(cachedInstallerFileName('1.2.0')).toBe('silver-knight-1.2.0-setup.exe')
  })

  it('launchInstallerDetached spawns the installer detached', () => {
    const cached = cacheInstaller(makeExe('1.1.0'), '1.1.0')
    mockSpawn.mockReturnValue({ unref: () => undefined })
    launchInstallerDetached(cached!.filePath)
    expect(mockSpawn).toHaveBeenCalled()
  })

  it('installInstallerBlocking resolves on exit code 0', async () => {
    mockSpawn.mockReturnValue({
      once: (event: string, cb: (code?: number) => void) => {
        if (event === 'exit') setTimeout(() => cb(0), 10)
      },
      kill: () => undefined
    })
    const result = await installInstallerBlocking(join(dir, 'x.exe'))
    expect(result.ok).toBe(true)
    expect(result.exitCode).toBe(0)
  })
})
