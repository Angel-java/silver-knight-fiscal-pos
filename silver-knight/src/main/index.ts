import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { execSync } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  checkDockerInstalled,
  checkDockerRunning,
  waitForDocker,
  startCompose,
  stopCompose,
  waitForBackend,
  buildCompose,
  restartCompose,
  launchDockerDesktop,
  getServerContainerLogs,
  getDbContainerStatus,
  getComposeContainers
} from './docker'
import { appUpdater } from './updater'
import {
  ensureConfig,
  readConfig,
  saveConfigFromWizard,
  migrateFromLegacy,
  migrateConfig,
  loadEnvForChild,
  detectExistingDockerVolume
} from './config'
import { writeLog, log } from './logger'

process.on('uncaughtException', (err) => {
  writeLog('FATAL', 'crash', `Uncaught exception: ${err.message}\n${err.stack}`)
})

process.on('unhandledRejection', (reason) => {
  writeLog('FATAL', 'crash', `Unhandled rejection: ${reason}`)
})

const MAIN_WINDOW_WIDTH = 1100
const MAIN_WINDOW_HEIGHT = 720

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null

function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 460,
    height: 380,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  splash.loadFile(join(__dirname, '../renderer/splash.html'))
  return splash
}

function sendSplash(channel: string, ...args: unknown[]): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send(channel, ...args)
  }
}

async function showDockerError(message: string): Promise<void> {
  await dialog.showMessageBox({
    type: 'error',
    title: 'Docker no disponible',
    message: 'Silver Knight requiere Docker Desktop',
    detail: message,
    buttons: ['Entendido']
  })
  app.quit()
}

async function dumpBackendDiagnostics(): Promise<void> {
  log('startup', '--- Diagnostic dump ---')
  try {
    const containers = await getComposeContainers()
    log('startup', `Docker containers:\n${containers}`)
  } catch (err) {
    log('startup', `Could not list containers: ${err}`)
  }
  const dbStatus = await getDbContainerStatus()
  log('startup', `DB status: running=${dbStatus.running}, restarting=${dbStatus.restarting}, health=${dbStatus.health}`)
  const serverLogs = await getServerContainerLogs(50)
  log('startup', `Server container logs (last 50):\n${serverLogs || '(no logs available)'}`)
  log('startup', '--- End diagnostic dump ---')
}

async function startBackend(): Promise<boolean> {
  log('startup', 'Checking Docker installation...')
  sendSplash('splash-status', 'Verificando Docker...')

  const dockerInfo = await checkDockerInstalled()
  if (!dockerInfo.installed) {
    await showDockerError(
      'Docker Desktop no está instalado en esta máquina.\n\n' +
        'Por favor instala Docker Desktop desde:\nhttps://www.docker.com/products/docker-desktop/'
    )
    return false
  }

  log('startup', `Docker v${dockerInfo.version} detected`)
  sendSplash('splash-status', `Docker v${dockerInfo.version} detectado`)

  log('startup', 'Checking Docker daemon...')
  sendSplash('splash-status', 'Verificando daemon de Docker...')

  const dockerRunning = await checkDockerRunning()
  if (!dockerRunning) {
    sendSplash('splash-status', 'Docker no está corriendo, intentando abrir Docker Desktop...')

    log('startup', 'Docker daemon not running, launching Docker Desktop...')
    const launched = await launchDockerDesktop()

    if (launched) {
      sendSplash('splash-status', 'Esperando a que Docker inicia (puede tardar 1-2 minutos)...')
    } else {
      sendSplash('splash-status', 'Abre Docker Desktop manualmente y espera a que inicie...')
    }

    log('startup', 'Docker daemon not running, waiting...')
    const started = await waitForDocker(120000)
    if (!started) {
      await showDockerError(
        'Docker Desktop está instalado pero el daemon no inició.\n\n' +
          'Por favor:\n' +
          '1. Abre Docker Desktop desde el menú Inicio\n' +
          '2. Espera a que el ícono de la bandeja se ponga verde\n' +
          '3. Vuelve a abrir Silver Knight'
      )
      return false
    }
  }

  log('startup', 'Docker is running, starting backend...')
  sendSplash('splash-status', 'Iniciando servidor backend...')
  sendSplash('splash-progress', 20)

  const result = await startCompose((line) => {
    if (line.includes('Building')) {
      sendSplash('splash-status', 'Construyendo imagen Docker...')
      sendSplash('splash-progress', 40)
    }
    if (line.includes('Created') || line.includes('Started')) {
      sendSplash('splash-progress', 70)
    }
  })

  if (!result.success) {
    log('startup', `Docker compose failed: ${result.error}`)

    const retry = await dialog.showMessageBox({
      type: 'error',
      title: 'Error al iniciar servidor',
      message: 'No se pudo iniciar el backend.',
      detail: result.error?.substring(0, 500) || 'Error desconocido',
      buttons: ['Reintentar', 'Salir'],
      defaultId: 0
    })

    if (retry.response === 0) {
      return startBackend()
    }
    app.quit()
    return false
  }

  sendSplash('splash-status', 'Esperando a que el servidor esté listo...')
  sendSplash('splash-progress', 80)

  const port = process.env['PORT'] || '3001'
  const healthUrl = `http://localhost:${port}/api/health`

  const backendStatus = await waitForBackend(healthUrl, 120000, (attempt) => {
    const pct = Math.min(80 + attempt * 2, 98)
    sendSplash('splash-progress', pct)
  })

  if (backendStatus === 'error') {
    log('startup', 'Backend failed to start')
    await dumpBackendDiagnostics()

    const retry = await dialog.showMessageBox({
      type: 'error',
      title: 'Servidor no responde',
      message: 'El backend tardó demasiado en iniciar.',
      detail: 'Verifica que el puerto 3001 no esté en uso.',
      buttons: ['Reintentar', 'Salir'],
      defaultId: 0
    })

    if (retry.response === 0) {
      return startBackend()
    }
    app.quit()
    return false
  }

  sendSplash('splash-progress', 100)
  sendSplash('splash-success', 'Servidor listo')
  log('startup', 'Backend is ready!')
  return true
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: MAIN_WINDOW_WIDTH,
    height: MAIN_WINDOW_HEIGHT,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f3f4f6',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levels = ['verbose', 'info', 'warning', 'error']
    const tag = `renderer:${levels[level] || level}`
    writeLog(level >= 2 ? 'WARN' : 'INFO', tag, `${message} (${sourceId}:${line})`)
  })

  win.webContents.on('render-process-gone', (_event, details) => {
    log('renderer', `RENDER PROCESS GONE: ${details.reason} (${details.exitCode})`)
  })

  win.on('unresponsive', () => {
    log('renderer', 'Window became unresponsive')
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    log('startup', 'Second instance detected, focusing main window')
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.silverknight.pos')

  if (!is.dev) {
    // CSP now handled via webSecurity: false in BrowserWindow
  }

  ipcMain.on('renderer-log', (_event, level: string, tag: string, msg: string) => {
    writeLog(level, `renderer:${tag}`, msg)
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => log('ipc', 'pong'))

  ipcMain.handle('config:exists', () => {
    return ensureConfig()
  })

  ipcMain.handle('config:read', () => {
    return readConfig()
  })

  ipcMain.handle('config:save', (_event, data: { rootPin: string; postgresPassword?: string }) => {
    return saveConfigFromWizard(data)
  })

  ipcMain.handle('config:migrate', () => {
    const legacy = migrateFromLegacy()
    if (legacy) return true
    return migrateConfig()
  })

  ipcMain.handle('config:has-existing-db', () => {
    return detectExistingDockerVolume()
  })

  ipcMain.handle('config:start-backend', async () => {
    log('config', 'Starting backend after wizard config')

    const dockerRunning = await checkDockerRunning()
    if (!dockerRunning) {
      log('config', 'Docker is not running')
      return { success: false, error: 'docker-not-running', message: 'Docker no está corriendo. Abre Docker Desktop y vuelve a intentar.' }
    }

    const result = await startCompose((line) => {
      log('config', line)
    })
    if (!result.success) {
      return { success: false, error: 'compose-failed', message: result.error || 'Error al iniciar Docker Compose' }
    }

    const envVars = loadEnvForChild()
    const port = envVars['PORT'] || '3001'
    const healthUrl = `http://localhost:${port}/api/health`
    log('config', `Waiting for backend at ${healthUrl}`)

    const backendStatus = await waitForBackend(healthUrl, 120000)
    if (backendStatus === 'error') {
      log('config', 'Backend failed to respond, checking container status...')

      const dbStatus = await getDbContainerStatus()
      log('config', `DB status: running=${dbStatus.running}, restarting=${dbStatus.restarting}, health=${dbStatus.health}`)

      const serverLogs = await getServerContainerLogs(20)
      log('config', `Server logs:\n${serverLogs}`)

      if (dbStatus.restarting || (dbStatus.health !== 'healthy' && dbStatus.health !== 'unknown')) {
        const isAuthFailure = serverLogs.includes('password authentication failed') ||
          serverLogs.includes('FATAL: password authentication failed') ||
          serverLogs.includes('role "silverknight" does not exist') ||
          serverLogs.includes('SCRAM authentication')

        if (isAuthFailure) {
          return {
            success: false,
            error: 'auth-failure',
            message: 'La contraseña de PostgreSQL no coincide con la base de datos existente. Verifica la contraseña e intenta de nuevo.'
          }
        }
      }

      return {
        success: false,
        error: 'timeout',
        message: 'El servidor tardó demasiado en responder. Verifica que Docker esté funcionando correctamente.',
        logs: serverLogs.substring(0, 500)
      }
    }

    return { success: true }
  })

  ipcMain.on('splash-retry', async () => {
    sendSplash('splash-status', 'Reintentando...')
    const ok = await startBackend()
    if (ok) {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close()
      }
      mainWindow = createMainWindow()
      appUpdater.setMainWindow(mainWindow)
      if (app.isPackaged) {
        try {
          appUpdater.startAutoCheck()
          setTimeout(() => {
            try {
              appUpdater.checkForUpdates().catch((err) => {
                log('updater', `checkForUpdates rejected: ${err}`)
              })
            } catch (err) {
              log('updater', `checkForUpdates threw: ${err}`)
            }
          }, 15000)
        } catch (err) {
          log('updater', `updater init failed: ${err}`)
        }
      }
    }
  })

  if (app.isPackaged) {
    splashWindow = createSplashWindow()

    ipcMain.handle('docker:status', async () => {
      try {
        const installed = await checkDockerInstalled()
        const running = installed.installed ? await checkDockerRunning() : false
        return { installed: installed.installed, running, version: installed.version }
      } catch {
        return { installed: false, running: false, version: undefined }
      }
    })

    ipcMain.handle('docker:restart', async () => {
      log('docker', 'Manual restart requested')
      const result = await restartCompose()
      return result
    })

    ipcMain.handle('docker:rebuild', async () => {
      log('docker', 'Manual rebuild requested')
      const result = await buildCompose()
      if (result.success) {
        await stopCompose()
        return await startCompose()
      }
      return result
    })

    let needsEnvWizard = false

    if (!ensureConfig()) {
      log('startup', 'No config found, trying legacy migration...')
      if (!migrateFromLegacy()) {
        log('startup', 'No legacy config found, will show env wizard')
        needsEnvWizard = true
      } else {
        log('startup', 'Legacy config migrated successfully')
      }
    } else {
      log('startup', 'Config found')
      migrateConfig()
    }

    if (needsEnvWizard) {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close()
        splashWindow = null
      }

      mainWindow = createMainWindow()
    } else {
      const backendReady = await startBackend()

      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close()
        splashWindow = null
      }

      if (!backendReady) {
        app.quit()
        return
      }

      mainWindow = createMainWindow()

      appUpdater.setMainWindow(mainWindow)
      try {
        appUpdater.startAutoCheck()
      } catch (err) {
        log('updater', `startAutoCheck failed: ${err}`)
      }
      setTimeout(() => {
        try {
          appUpdater.checkForUpdates().catch((err) => {
            log('updater', `checkForUpdates rejected: ${err}`)
          })
        } catch (err) {
          log('updater', `checkForUpdates threw: ${err}`)
        }
      }, 15000)
    }
  } else {
    ipcMain.handle('docker:status', async () => {
      return { installed: true, running: true, version: 'dev' }
    })

    ipcMain.handle('docker:restart', async () => {
      return { success: true }
    })

    ipcMain.handle('docker:rebuild', async () => {
      return { success: true }
    })

    mainWindow = createMainWindow()
    appUpdater.setMainWindow(mainWindow)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
      appUpdater.setMainWindow(mainWindow)
    }
  })
  })
}

app.on('before-quit', () => {
  log('shutdown', 'App quitting, stopping Docker compose...')
  appUpdater.stopAutoCheck()

  if (!app.isPackaged) return

  const dir = is.dev ? process.cwd() : process.resourcesPath
  try {
    execSync('docker compose down', {
      cwd: dir,
      env: { ...process.env, ...loadEnvForChild() } as NodeJS.ProcessEnv,
      timeout: 15000,
      stdio: 'ignore'
    })
    log('shutdown', 'Docker compose stopped')
  } catch (err) {
    log('shutdown', `Error stopping compose: ${err}`)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
