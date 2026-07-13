import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createServer, stopBcvScheduler } from './server'
import { logger } from './server/utils/logger'
import { resolveDbPath, getDbUrl } from './database/dbPath'
import { runMigrations } from './database/migrations'
import { autoUpdater } from 'electron-updater'

const SERVER_PORT = 3001
let server: ReturnType<typeof import('http').createServer> | null = null

async function initDatabase(): Promise<void> {
  process.env.DATABASE_URL = getDbUrl()
  logger.info('main', `Database URL: ${process.env.DATABASE_URL}`)

  if (app.isPackaged) {
    const result = await runMigrations(resolveDbPath())
    if (!result.success) {
      logger.error('main', `Migration failed: ${result.error}`)
    } else {
      logger.info('main', 'Database migrations applied successfully')
    }
  }
}

function setupAutoUpdate(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  ipcMain.on('check-for-updates', () => {
    autoUpdater.checkForUpdates().catch((err) => {
      logger.error('main', `Update check failed: ${err}`)
    })
  })

  ipcMain.on('download-update', () => {
    autoUpdater.downloadUpdate().catch((err) => {
      logger.error('main', `Update download failed: ${err}`)
    })
  })

  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall()
  })

  autoUpdater.on('update-available', (info) => {
    logger.info('main', `Update available: ${info.version}`)
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send('update-available', info.version)
    })
  })

  autoUpdater.on('update-not-available', () => {
    logger.info('main', 'No updates available')
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send('update-not-available')
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send('update-download-progress', progress.percent)
    })
  })

  autoUpdater.on('update-downloaded', () => {
    logger.info('main', 'Update downloaded, ready to install')
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send('update-downloaded')
    })
  })

  autoUpdater.on('error', (err) => {
    logger.error('main', `Auto-updater error: ${err}`)
  })
}

async function startEmbeddedServer(): Promise<void> {
  const expressApp = await createServer()
  await new Promise<void>((resolve) => {
    server = expressApp.listen(SERVER_PORT, () => {
      logger.info('main', `Express server running on http://localhost:${SERVER_PORT}`)
      resolve()
    })
  })
}

function createWindow(): void {
  // Create the browser window.
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

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.silverknight.pos')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  await initDatabase()

  setupAutoUpdate()

  await startEmbeddedServer()

  ipcMain.on('ping', () => logger.info('main', 'pong'))

  createWindow()

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {})
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  stopBcvScheduler()
  if (server) {
    server.close()
    server = null
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
