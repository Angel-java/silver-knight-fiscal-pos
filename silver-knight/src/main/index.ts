import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { autoUpdater } from 'electron-updater'

function log(tag: string, message: string): void {
  console.log(`[main] [${tag}] ${message}`)
}

function setupAutoUpdate(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  ipcMain.on('check-for-updates', () => {
    autoUpdater.checkForUpdates().catch((err) => {
      log('updater', `Update check failed: ${err}`)
    })
  })

  ipcMain.on('download-update', () => {
    autoUpdater.downloadUpdate().catch((err) => {
      log('updater', `Update download failed: ${err}`)
    })
  })

  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall()
  })

  autoUpdater.on('update-available', (info) => {
    log('updater', `Update available: ${info.version}`)
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send('update-available', info.version)
    })
  })

  autoUpdater.on('update-not-available', () => {
    log('updater', 'No updates available')
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send('update-not-available')
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    log('updater', `Download progress: ${progress.percent}%`)
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send('update-download-progress', progress.percent)
    })
  })

  autoUpdater.on('update-downloaded', () => {
    log('updater', 'Update downloaded, ready to install')
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send('update-downloaded')
    })
  })

  autoUpdater.on('error', (err) => {
    log('updater', `Auto-updater error: ${err}`)
  })
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levels = ['verbose', 'info', 'warning', 'error']
    console.log(`[renderer ${levels[level] || level}] ${message} (${sourceId}:${line})`)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.silverknight.pos')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupAutoUpdate()

  ipcMain.on('ping', () => log('ipc', 'pong'))

  createWindow()

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {})
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
