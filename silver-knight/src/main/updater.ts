import { app, BrowserWindow, ipcMain, net } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import { stopCompose } from './docker'
import { log } from './logger'

const RETRY_POLL_MS = 30_000

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'

export class AppUpdater {
  private status: UpdateStatus = 'idle'
  private availableVersion = ''
  private lastError = ''
  private checkInterval: ReturnType<typeof setInterval> | null = null
  private retryTimer: ReturnType<typeof setInterval> | null = null
  private mainWindow: BrowserWindow | null = null
  private pendingCheck = false

  constructor() {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.forceDevUpdateConfig = false

    this.setupListeners()
  }

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win
  }

  private setupListeners(): void {
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      log('event', `Update available: v${info.version}`)
      this.status = 'available'
      this.availableVersion = info.version
      this.send('update-available', info.version)
    })

    autoUpdater.on('update-not-available', () => {
      log('event', 'No updates available')
      this.status = 'idle'
      this.send('update-not-available')
    })

    autoUpdater.on('download-progress', (progress) => {
      log('event', `Download progress: ${progress.percent.toFixed(1)}%`)
      this.status = 'downloading'
      this.send('update-download-progress', progress.percent)
    })

    autoUpdater.on('update-downloaded', () => {
      log('event', 'Update downloaded, ready to install')
      this.status = 'downloaded'
      this.send('update-downloaded')
    })

    autoUpdater.on('error', (err: Error) => {
      log('error', `Update error: ${err.message}`)
      this.status = 'error'
      this.lastError = err.message
      this.send('update-error', err.message)
    })

    ipcMain.on('check-for-updates', () => {
      this.checkForUpdates()
    })

    ipcMain.on('download-update', () => {
      this.downloadUpdate()
    })

    ipcMain.on('install-update', () => {
      this.installUpdate()
    })

    ipcMain.handle('get-update-status', () => {
      return {
        status: this.status,
        version: this.availableVersion,
        error: this.lastError
      }
    })

    ipcMain.handle('get-app-version', () => {
      return app.getVersion()
    })
  }

  private send(channel: string, ...args: unknown[]): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, ...args)
    }
  }

  async checkForUpdates(): Promise<void> {
    if (this.status === 'downloading') return
    if (!net.isOnline()) {
      log('check', 'Offline, update check skipped (will retry when connection is back)')
      this.pendingCheck = true
      this.startRetryPoll()
      return
    }
    this.pendingCheck = false
    this.stopRetryPoll()
    log('check', 'Checking for updates...')
    this.status = 'checking'
    this.send('update-checking')
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      log('error', `Check failed: ${err}`)
      this.status = 'error'
      this.lastError = err instanceof Error ? err.message : String(err)
      this.send('update-error', this.lastError)
    }
  }

  private startRetryPoll(): void {
    if (this.retryTimer) return
    this.retryTimer = setInterval(() => {
      this.tryRunPendingCheck().catch(() => {})
    }, RETRY_POLL_MS)
  }

  private stopRetryPoll(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer)
      this.retryTimer = null
    }
  }

  private async tryRunPendingCheck(): Promise<void> {
    if (!this.pendingCheck) {
      this.stopRetryPoll()
      return
    }
    if (net.isOnline()) {
      log('scheduler', 'Connection restored, running pending update check')
      await this.checkForUpdates()
    }
  }

  async downloadUpdate(): Promise<void> {
    if (this.status !== 'available') return
    log('download', 'Starting download...')
    this.status = 'downloading'
    try {
      await autoUpdater.downloadUpdate()
    } catch (err) {
      log('error', `Download failed: ${err}`)
      this.status = 'error'
      this.lastError = err instanceof Error ? err.message : String(err)
      this.send('update-error', this.lastError)
    }
  }

  async installUpdate(): Promise<void> {
    if (this.status !== 'downloaded') return
    log('install', 'Quitting and installing update...')
    this.send('update-installing')
    try {
      log('install', 'Stopping docker compose before update...')
      await stopCompose()
    } catch (err) {
      log('install', `Error stopping compose before update: ${err}`)
    }
    autoUpdater.quitAndInstall(false, true)
  }

  startAutoCheck(intervalMs = 4 * 60 * 60 * 1000): void {
    if (this.checkInterval) clearInterval(this.checkInterval)
    this.checkInterval = setInterval(() => {
      this.checkForUpdates().catch(() => {})
    }, intervalMs)
    log('scheduler', `Auto-check every ${intervalMs / 1000 / 60} minutes`)
  }

  stopAutoCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.stopRetryPoll()
    this.pendingCheck = false
  }

  getStatus(): { status: UpdateStatus; version: string; error: string } {
    return {
      status: this.status,
      version: this.availableVersion,
      error: this.lastError
    }
  }
}

export const appUpdater = new AppUpdater()
