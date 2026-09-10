import { app } from 'electron'
import { execSync } from 'child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { get as httpsGet } from 'https'
import { log } from './logger'
import { readBootState } from './bootState'
import {
  compareVersions,
  installInstallerBlocking,
  sha512Base64,
  verifyInstallerFile
} from './installerCache'
import { installOfflinePackage, listOfflineFiles } from './offlineUpdate'

const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const RUN_VALUE = 'SilverKnightWatchdog'
const LATEST_YML_URL =
  'https://github.com/Angel-java/silver-knight-fiscal-pos/releases/latest/download/latest.yml'

/**
 * Registers this app to run `SilverKnight.exe --watchdog` at every Windows
 * login, so a broken install still self-heals even if the user never opens the
 * app. No-op in dev. Best-effort: never throws.
 */
export function ensureWatchdogRegistration(): void {
  if (!app.isPackaged) return
  if (process.argv.includes('--watchdog')) return
  try {
    const exe = process.execPath
    const command = `"${exe}" --watchdog`
    const current = execSync(`reg query "${RUN_KEY}" /v ${RUN_VALUE}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10000
    }).toString()
    if (current.includes(command)) {
      log('watchdog', 'Registry watchdog entry already present')
      return
    }
  } catch {
    // entry missing → (re)create it
  }
  try {
    execSync(
      `reg add "${RUN_KEY}" /v ${RUN_VALUE} /t REG_SZ /d "\\"${process.execPath}\\" --watchdog" /f`,
      { stdio: 'ignore', timeout: 10000 }
    )
    log('watchdog', `Registered watchdog startup: "${process.execPath}" --watchdog`)
  } catch (err) {
    log('watchdog', `Failed to register watchdog: ${err}`)
  }
}

function downloadFile(url: string, dest: string, timeoutMs = 600_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest)
    const request = httpsGet(
      url,
      { headers: { 'User-Agent': 'SilverKnight-Watchdog' } },
      (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          request.destroy()
          downloadFile(response.headers.location, dest, timeoutMs).then(resolve, reject)
          return
        }
        if (response.statusCode !== 200) {
          request.destroy()
          reject(new Error(`HTTP ${response.statusCode} for ${url}`))
          return
        }
        response.pipe(file)
        file.on('finish', () => file.close(() => resolve()))
      }
    )
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Download timed out: ${url}`))
    })
    request.on('error', (err) => {
      try {
        file.destroy()
      } catch {
        // ignore
      }
      reject(err)
    })
  })
}

interface LatestYmlInfo {
  version: string
  sha512?: string
}

/** Parses the github latest.yml produced by electron-builder (first exe asset). */
export function parseLatestYml(text: string): LatestYmlInfo {
  const info: LatestYmlInfo = { version: '' }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.startsWith('version:')) {
      info.version = line.split(':').slice(1).join(':').trim() || ''
      continue
    }
    const shaMatch = line.match(/sha512:\s*([A-Za-z0-9+/=]+)/i)
    if (shaMatch && !info.sha512) info.sha512 = shaMatch[1]
  }
  return info
}

/**
 * Runs completely outside the app: checks for an offline package first, then
 * the GitHub latest release, downloads it, verifies its sha512 and installs
 * it silently (NSIS /S). Returns once finished; the caller then exits.
 */
export async function runWatchdog(): Promise<void> {
  log('watchdog', `Watchdog started (app v${app.getVersion()})`)

  const state = readBootState()
  const sane = state.lastCleanShutdown && !state.pendingUpgrade && state.consecutiveFailures === 0
  if (sane) {
    log('watchdog', 'Boot was clean and no pending upgrade: nothing to do')
    return
  }
  log(
    'watchdog',
    `Machine needs attention: clean=${state.lastCleanShutdown} pending=${state.pendingUpgrade} consecutiveFailures=${state.consecutiveFailures}`
  )

  const offlineResult = await installOfflinePackage(app.getVersion())
  if (offlineResult.ok && offlineResult.version) {
    log('watchdog', `Offline update installed (${offlineResult.version})`)
    return
  }
  if (listOfflineFiles().length) {
    log('watchdog', `Offline update skipped: ${offlineResult.error}`)
  }
  if (!offlineResult.ok && offlineResult.error !== 'offline-not-applicable') {
    log('watchdog', `Offline install check done: ${offlineResult.error}`)
  }

  if (process.env['SK_WATCHDOG_OFFLINE_ONLY'] === '1') {
    log('watchdog', 'Offline-only mode, skipping GitHub')
    return
  }

  try {
    const tmp = join(tmpdir(), 'silver-knight-watchdog')
    if (!existsSync(tmp)) mkdirSync(tmp, { recursive: true })
    log('watchdog', `Fetching ${LATEST_YML_URL}`)
    const ymlPath = join(tmp, 'latest.yml')
    await downloadFile(LATEST_YML_URL, ymlPath, 60_000)
    const info = parseLatestYml(readFileSync(ymlPath, 'utf-8'))
    if (!info.version) {
      log('watchdog', 'Could not parse latest.yml version')
      return
    }
    if (compareVersions(info.version, app.getVersion()) <= 0) {
      log(
        'watchdog',
        `GitHub latest (${info.version}) is not newer than installed (${app.getVersion()})`
      )
      return
    }
    if (!info.sha512) {
      log('watchdog', `No sha512 found for ${info.version}, skipping`)
      return
    }
    const installerPath = join(tmp, `silver-knight-${info.version}-setup.exe`)
    const downloadUrl = `https://github.com/Angel-java/silver-knight-fiscal-pos/releases/latest/download/silver-knight-${info.version}-setup.exe`
    log('watchdog', `Downloading ${downloadUrl}`)
    await downloadFile(downloadUrl, installerPath)
    const check = verifyInstallerFile(installerPath)
    if (!check.ok) {
      log('watchdog', `Downloaded installer failed verification: ${check.reason}`)
      return
    }
    const actual = sha512Base64(installerPath)
    if (actual !== info.sha512) {
      log('watchdog', `sha512 mismatch (expected ${info.sha512}, got ${actual})`)
      return
    }
    const result = await installInstallerBlocking(installerPath)
    log(
      'watchdog',
      `Install of ${info.version}: ok=${result.ok} exit=${result.exitCode} error=${result.error ?? ''}`
    )
  } catch (err) {
    log('watchdog', `Watchdog error: ${err}`)
  }
}
