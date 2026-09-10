import { app, BrowserWindow, ipcMain, clipboard } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { log } from './logger'
import { readBootState, markBootFailed } from './bootState'
import {
  listCachedInstallers,
  pickRollbackInstaller,
  launchInstallerDetached,
  verifyInstallerFile
} from './installerCache'
import { getApplicableOfflineInstaller } from './offlineUpdate'
import type { AppUpdater } from './updater'

let recoveryWindow: BrowserWindow | null = null
let recoveryIpcRegistered = false
let recoveryReason = ''

export type RecoveryLoad = { window: BrowserWindow | null; handled: boolean; detail: string }

/**
 * Attempts an automatic rollback before the backend starts: if the previous
 * update already broke the machine twice, silently reinstall the last good
 * cached version and relaunch. Never throws.
 */
export async function maybeAutoRepair(): Promise<{ repaired: boolean; detail: string }> {
  if (!app.isPackaged) return { repaired: false, detail: 'dev' }
  const state = readBootState()
  if (!(state.failuresAfterUpdate >= 2)) {
    return { repaired: false, detail: `ok (failuresAfterUpdate=${state.failuresAfterUpdate})` }
  }
  const rollback = pickRollbackInstaller(app.getVersion())
  if (!rollback) {
    log('recovery', 'Rollback needed but no cached previous installer available')
    return { repaired: false, detail: 'no-rollback-installer' }
  }
  const check = verifyInstallerFile(rollback.filePath)
  if (!check.ok) {
    log('recovery', `Rollback installer failed verification: ${check.reason}`)
    return { repaired: false, detail: `rollback-verify-${check.reason}` }
  }
  log('recovery', `Rollback: reinstalling previous version ${rollback.version}`)
  launchInstallerDetached(rollback.filePath)
  setImmediate(() => {
    try {
      app.quit()
    } catch {
      // ignore
    }
  })
  return { repaired: true, detail: rollback.version }
}

/**
 * Final fallback when the app cannot boot. If an update is already downloaded,
 * quit so autoInstallOnAppQuit applies it. Otherwise open the recovery window.
 * The caller must NOT continue booting afterwards.
 */
export async function handleUnrecoverableStartup(
  reason: string,
  updater: AppUpdater
): Promise<RecoveryLoad> {
  log('recovery', `Unrecoverable startup (${reason})`)
  markBootFailed(reason)
  if (!app.isPackaged) return { window: null, handled: false, detail: 'dev' }
  if (updater.hasDownloadedUpdate()) {
    log('recovery', 'Downloaded update pending → quitting to install it on exit')
    app.quit()
    return { window: null, handled: true, detail: 'quit-to-install' }
  }
  await createRecoveryWindow(reason)
  return { window: recoveryWindow, handled: true, detail: 'recovery-window' }
}

export async function createRecoveryWindow(reason: string): Promise<BrowserWindow> {
  if (recoveryWindow && !recoveryWindow.isDestroyed()) {
    recoveryWindow.focus()
    return recoveryWindow
  }
  recoveryReason = reason
  registerRecoveryIpc()

  recoveryWindow = new BrowserWindow({
    width: 680,
    height: 560,
    show: false,
    autoHideMenuBar: true,
    resizable: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  recoveryWindow.on('ready-to-show', () => {
    recoveryWindow?.show()
  })

  recoveryWindow.on('closed', () => {
    recoveryWindow = null
  })

  const htmlPath = app.isPackaged
    ? join(process.resourcesPath, 'recovery.html')
    : join(__dirname, '../renderer/recovery.html')
  log('recovery', `Loading recovery window from ${htmlPath}`)
  try {
    await recoveryWindow.loadFile(htmlPath)
  } catch (err) {
    log('recovery', `Failed to load recovery.html: ${err}`)
    // Fallback: allow the app to close instead of leaving a stuck window
    app.quit()
  }
  return recoveryWindow
}

function recoveryGetInfo(): Record<string, unknown> {
  const state = readBootState()
  const offline = getApplicableOfflineInstaller(app.getVersion())
  return {
    appVersion: app.getVersion(),
    reason: recoveryReason,
    bootState: state,
    cachedInstallers: listCachedInstallers(),
    offlineInstaller: offline ? { version: offline.version, filePath: offline.filePath } : null
  }
}

function gatherRecoveryText(): string {
  const lines: string[] = []
  lines.push(`Silver Knight recovery report — app v${app.getVersion()}`)
  lines.push(`Time: ${new Date().toISOString()}`)
  lines.push(`Reason: ${recoveryReason}`)
  lines.push('')
  lines.push('--- boot state ---')
  try {
    lines.push(JSON.stringify(readBootState(), null, 2))
  } catch (err) {
    lines.push(`Error reading boot state: ${err}`)
  }
  lines.push('')
  lines.push('--- cached installers ---')
  for (const c of listCachedInstallers()) {
    lines.push(`  ${c.version} → ${c.filePath}`)
  }
  lines.push('')
  lines.push('--- main.log tail (last 200) ---')
  try {
    const logPath = join(app.getPath('userData'), 'logs', 'main.log')
    if (existsSync(logPath)) {
      lines.push(readFileSync(logPath, 'utf-8').split(/\r?\n/).slice(-200).join('\n'))
    } else {
      lines.push('(no main.log found)')
    }
  } catch (err) {
    lines.push(`Could not read main.log: ${err}`)
  }
  return lines.join('\n')
}

/**
 * Registers the recovery IPC handlers (idempotent). Called at startup so the
 * main window can trigger the same self-repair actions from Settings, and when
 * opening the recovery window.
 */
export function registerRecoveryIpc(): void {
  if (recoveryIpcRegistered) return
  recoveryIpcRegistered = true

  ipcMain.handle('recovery:get-info', () => recoveryGetInfo())

  ipcMain.handle('recovery:copy-diagnostics', async () => {
    try {
      clipboard.writeText(gatherRecoveryText())
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('recovery:apply-update', async () => {
    const { appUpdater } = await import('./updater')
    try {
      await appUpdater.downloadAndInstall()
      return { ok: true }
    } catch (err) {
      log('recovery', `apply-update failed: ${err}`)
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('recovery:install-cached', async () => {
    const { appUpdater } = await import('./updater')
    const state = readBootState()
    const currentVersion = app.getVersion()
    const candidates = listCachedInstallers()

    const pending = appUpdater.getPendingUpgradeVersion()
    const target =
      candidates.find((c) => !!pending && c.version === pending) ||
      candidates.find((c) => c.version === (state.pendingUpgrade ?? '')) ||
      candidates[0]

    if (!target) return { ok: false, error: 'No hay instalador en caché.' }

    const check = verifyInstallerFile(target.filePath)
    if (!check.ok) return { ok: false, error: `Instalador inválido (${check.reason}).` }

    try {
      launchInstallerDetached(target.filePath)
      setImmediate(() => {
        try {
          app.quit()
        } catch {
          // ignore
        }
      })
      return { ok: true, version: target.version, note: currentVersion }
    } catch (err) {
      log('recovery', `install-cached failed: ${err}`)
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('recovery:install-offline', async () => {
    const offline = getApplicableOfflineInstaller(app.getVersion())
    if (!offline) return { ok: false, error: 'No hay paquete offline aplicable.' }
    try {
      launchInstallerDetached(offline.filePath)
      setImmediate(() => {
        try {
          app.quit()
        } catch {
          // ignore
        }
      })
      return { ok: true, version: offline.version }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('recovery:relaunch', () => {
    app.relaunch()
    app.exit(0)
  })

  ipcMain.on('recovery:quit', () => {
    app.quit()
  })
}

export function closeRecoveryWindow(): void {
  if (recoveryWindow && !recoveryWindow.isDestroyed()) {
    recoveryWindow.close()
  }
  recoveryWindow = null
}

export function recoveryWindowOpen(): boolean {
  return !!recoveryWindow && !recoveryWindow.isDestroyed()
}
