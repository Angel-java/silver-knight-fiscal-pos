import { app } from 'electron'
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  unlinkSync,
  copyFileSync,
  statSync
} from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import crypto from 'crypto'
import { log } from './logger'
import { autoUpdater } from 'electron-updater'

export const MAX_CACHED_INSTALLERS = 2
export const OFFLINE_UPDATES_DIR = process.env['OFFLINE_UPDATES_DIR'] || 'C:\\SilverKnightUpdates'

export interface VersionedInstaller {
  version: string
  filePath: string
}

export function getInstallersDir(): string {
  return testInstallersDir || join(app.getPath('userData'), 'installers')
}

export function cachedInstallerFileName(version: string): string {
  return `silver-knight-${version}-setup.exe`
}

/** Returns null on invalid input (not x.y.z with numeric parts). */
export function parseVersion(version: string): number[] | null {
  const parts = version.split('.').map((p) => Number.parseInt(p, 10))
  if (!parts.length || parts.some((n) => Number.isNaN(n))) return null
  return parts
}

/** Returns 1 if a > b, -1 if a < b, 0 if equal. Invalid version loses. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa && !pb) return 0
  if (!pa) return -1
  if (!pb) return 1
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da > db) return 1
    if (da < db) return -1
  }
  return 0
}

export function sha512Base64(filePath: string): string {
  const data = readFileSync(filePath)
  return crypto.createHash('sha512').update(data).digest('base64')
}

function shaSidecarPath(filePath: string): string {
  return `${filePath}.sha512`
}

/**
 * Verifies a cached/external installer before executing it: the file must exist,
 * look like a Windows PE executable (MZ header), be non-trivial in size, and — when
 * a sidecar sha512 file exists — match its digest.
 */
export function verifyInstallerFile(filePath: string): { ok: boolean; reason?: string } {
  try {
    if (!existsSync(filePath)) return { ok: false, reason: 'missing' }
    const stat = statSync(filePath)
    if (stat.size < 1_000_000) return { ok: false, reason: `too small (${stat.size} bytes)` }
    const head = readFileSync(filePath, 'latin1').slice(0, 2)
    if (head !== 'MZ') return { ok: false, reason: 'not a PE executable' }
    const sidecar = shaSidecarPath(filePath)
    if (existsSync(sidecar)) {
      const expected = readFileSync(sidecar, 'utf-8').trim()
      const actual = sha512Base64(filePath)
      if (expected !== actual) return { ok: false, reason: 'sha512 mismatch' }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: String(err) }
  }
}

/**
 * Best-effort: returns the file path of the installer that electron-updater
 * just downloaded, or null if it cannot be found.
 */
export function findDownloadedInstallerFile(): string | null {
  try {
    const helper = (
      autoUpdater as unknown as {
        downloadedUpdateHelper?: { downloadedUpdateFile?: string | null }
      }
    ).downloadedUpdateHelper
    if (helper?.downloadedUpdateFile && existsSync(helper.downloadedUpdateFile)) {
      return helper.downloadedUpdateFile
    }
  } catch {
    // fall through to directory scan
  }

  const candidates = new Set<string>([
    join(app.getPath('userData'), '..', 'silver-knight-updater', 'pending'),
    join(app.getPath('userData'), '..', 'SilverKnight-updater', 'pending'),
    join(process.env['LOCALAPPDATA'] || app.getPath('temp'), 'silver-knight-updater', 'pending'),
    join(process.env['LOCALAPPDATA'] || app.getPath('temp'), 'SilverKnight-updater', 'pending')
  ])
  for (const dir of candidates) {
    try {
      if (!existsSync(dir)) continue
      for (const entry of readdirSync(dir)) {
        if (entry.toLowerCase().endsWith('.exe')) {
          const file = join(dir, entry)
          if (statSync(file).size > 0) return file
        }
      }
    } catch {
      // keep scanning
    }
  }
  return null
}

/**
 * Copies an installer into our own cache (kept across updates) so we can
 * roll back to the last good version if an update breaks the machine.
 * Always caches the version *previous* to a fresh install; the currently
 * running installer is not overwritten until it stops being the latest.
 */
export function cacheInstaller(filePath: string, version: string): VersionedInstaller | null {
  try {
    const dir = getInstallersDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const target = join(dir, cachedInstallerFileName(version))
    copyFileSync(filePath, target)
    try {
      writeFileSync(shaSidecarPath(target), sha512Base64(target), 'utf-8')
    } catch (err) {
      log('cache', `Failed to write sha512 sidecar for ${target}: ${err}`)
    }
    pruneInstallers()
    log('cache', `Installer cached: ${target}`)
    return { version, filePath: target }
  } catch (err) {
    log('cache', `Failed to cache installer ${version}: ${err}`)
    return null
  }
}

/** Caches whatever electron-updater just downloaded, keyed by version. */
export function cacheDownloadedInstaller(version: string): VersionedInstaller | null {
  const file = findDownloadedInstallerFile()
  if (!file) {
    log('cache', `No downloaded installer file found to cache for ${version}`)
    return null
  }
  return cacheInstaller(file, version)
}

export function listCachedInstallers(): VersionedInstaller[] {
  try {
    const dir = getInstallersDir()
    if (!existsSync(dir)) return []
    return readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.exe'))
      .map((f) => {
        const match = /silver-knight-([\d.]+)-setup\.exe/i.exec(f)
        return { version: match ? match[1] : f, filePath: join(dir, f) }
      })
      .sort((a, b) => compareVersions(b.version, a.version))
  } catch (err) {
    log('cache', `Failed to list cached installers: ${err}`)
    return []
  }
}

/** Last cached version different from `currentVersion` (the candidate for rollback). */
export function pickRollbackInstaller(currentVersion: string): VersionedInstaller | null {
  const all = listCachedInstallers().filter((c) => compareVersions(c.version, currentVersion) < 0)
  return all.length ? all[0] : null
}

function pruneInstallers(): void {
  const list = listCachedInstallers()
  if (list.length <= MAX_CACHED_INSTALLERS) return
  for (const toRemove of list.slice(MAX_CACHED_INSTALLERS)) {
    try {
      unlinkSync(toRemove.filePath)
      log('cache', `Pruned old installer: ${toRemove.filePath}`)
    } catch (err) {
      log('cache', `Failed to prune ${toRemove.filePath}: ${err}`)
    }
  }
}

/** Launches the installer detached (NSIS /S silent). The installer relaunches the app on finish. */
export function launchInstallerDetached(filePath: string): void {
  const child = spawn(`"${filePath}"`, ['/S'], {
    shell: true,
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  })
  child.unref()
  log('cache', `Launched installer detached: ${filePath}`)
}

/** execFile-free blocking install (used by watchdog): awaits installer exit. */
export function installInstallerBlocking(
  filePath: string,
  timeoutMs = 180_000
): Promise<{ ok: boolean; exitCode: number | null; error?: string }> {
  return new Promise((resolve) => {
    log('cache', `Installing (blocking): ${filePath}`)
    const child = spawn(filePath, ['/S'], {
      shell: false,
      windowsHide: true
    })
    const timer = setTimeout(() => {
      try {
        child.kill()
      } catch {
        // ignore
      }
      resolve({ ok: false, exitCode: null, error: 'Installer timed out' })
    }, timeoutMs)
    child.once('error', (err) => {
      clearTimeout(timer)
      resolve({ ok: false, exitCode: null, error: String(err) })
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      resolve({ ok: code === 0, exitCode: code })
    })
  })
}

export function __setInstallersDirForTests(dir: string | null): void {
  testInstallersDir = dir
}

let testInstallersDir: string | null = null
