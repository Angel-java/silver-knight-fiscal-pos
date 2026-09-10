import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { log } from './logger'
import {
  compareVersions,
  installInstallerBlocking,
  verifyInstallerFile,
  sha512Base64
} from './installerCache'

export const DEFAULT_OFFLINE_UPDATES_DIR = 'C:\\SilverKnightUpdates'

export function getOfflineUpdatesDir(): string {
  return offlineTestDir || process.env['OFFLINE_UPDATES_DIR'] || DEFAULT_OFFLINE_UPDATES_DIR
}

export interface OfflineManifest {
  version: string
  file: string
  sha512?: string
}

export interface OfflineInstaller {
  version: string
  filePath: string
  manifest: OfflineManifest
}

export function readOfflineManifest(): OfflineManifest | null {
  const dir = getOfflineUpdatesDir()
  try {
    const manifestPath = join(dir, 'manifest.json')
    if (!existsSync(manifestPath)) return null
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf-8')) as OfflineManifest
    if (!parsed.version || !parsed.file) return null
    return parsed
  } catch (err) {
    log('offline', `Failed to read offline manifest: ${err}`)
    return null
  }
}

/** Resolves the offline installer if the manifest points to a real file. */
export function findOfflineInstaller(): OfflineInstaller | null {
  const manifest = readOfflineManifest()
  if (!manifest) return null
  const filePath = join(getOfflineUpdatesDir(), manifest.file)
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    log('offline', `Offline installer file missing: ${filePath}`)
    return null
  }
  return { version: manifest.version, filePath, manifest }
}

/**
 * Returns the offline installer only when it is newer than the installed app
 * version and its sha512 (when present) matches the file.
 */
export function getApplicableOfflineInstaller(currentVersion: string): OfflineInstaller | null {
  const candidate = findOfflineInstaller()
  if (!candidate) return null
  if (compareVersions(candidate.version, currentVersion) <= 0) {
    log(
      'offline',
      `Offline installer (${candidate.version}) is not newer than installed (${currentVersion})`
    )
    return null
  }
  const verified = verifyInstallerFile(candidate.filePath)
  if (!verified.ok) {
    log('offline', `Offline installer failed verification: ${verified.reason}`)
    return null
  }
  if (candidate.manifest.sha512) {
    const actual = sha512Base64(candidate.filePath)
    if (actual !== candidate.manifest.sha512) {
      log(
        'offline',
        `Offline installer sha512 mismatch (expected ${candidate.manifest.sha512}, got ${actual})`
      )
      return null
    }
  }
  return candidate
}

/** Actually installs the offline package, blocking until the installer exits. */
export async function installOfflinePackage(
  currentVersion: string
): Promise<{ ok: boolean; version?: string; error?: string }> {
  const candidate = getApplicableOfflineInstaller(currentVersion)
  if (!candidate) {
    return { ok: false, error: 'offline-not-applicable' }
  }
  const result = await installInstallerBlocking(candidate.filePath)
  log('offline', `Offline install of ${candidate.version}: ok=${result.ok} exit=${result.exitCode}`)
  if (!result.ok) return { ok: false, error: result.error || `exit ${result.exitCode}` }
  return { ok: true, version: candidate.version }
}

export function __resetOfflineEnvForTests(): void {
  offlineTestDir = null
}

let offlineTestDir: string | null = null

export function __setOfflineDirForTests(dir: string | null): void {
  offlineTestDir = dir
}

export function listOfflineFiles(): string[] {
  const dir = getOfflineUpdatesDir()
  try {
    if (!existsSync(dir)) return []
    return readdirSync(dir)
  } catch (err) {
    log('offline', `Failed to list offline dir ${dir}: ${err}`)
    return []
  }
}
