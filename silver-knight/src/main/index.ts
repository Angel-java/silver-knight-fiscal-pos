import { app, shell, BrowserWindow, ipcMain, dialog, clipboard, net } from 'electron'
import path from 'path'
import { join } from 'path'
import { execSync, exec } from 'child_process'
import { promisify } from 'util'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  checkDockerInstalled,
  checkDockerRunning,
  waitForDocker,
  startCompose,
  stopCompose,
  waitForBackend,
  waitForBackendWithContainerCheck,
  buildCompose,
  restartCompose,
  launchDockerDesktop,
  getServerContainerLogs,
  getServerContainerState,
  getComposePsText,
  getDbContainerStatus,
  getComposeContainers,
  runPrismaPushOnce,
  computeSchemaHash,
  writeSchemaStateHash,
  restartServerContainer,
  stopServerContainer,
  getDockerSystemDf,
  resetPostgresPassword,
  getImageAvailability,
  pullDbImage
} from './docker'
import { getCachedDockerExe, getDockerCandidatePaths } from './docker-path'
import { appUpdater } from './updater'
import { ensureServerImage } from './server-image'
import {
  ensureConfig,
  readConfig,
  saveConfigFromWizard,
  savePostgresPassword,
  generatePassword,
  migrateFromLegacy,
  migrateConfig,
  loadEnvForChild,
  detectExistingDockerVolume
} from './config'
import { writeLog, log, flushLogsSync } from './logger'

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
let selfHealAttempted = false

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

async function gatherDiagnostics(): Promise<string> {
  const execAsyncDiag = promisify(exec)
  const lines: string[] = []
  lines.push(`Silver Knight diagnostics — app v${app.getVersion()}`)
  lines.push(`Time: ${new Date().toISOString()}`)
  lines.push(`Port: ${process.env['PORT'] || '3001'}`)
  lines.push('')
  lines.push('--- docker cli ---')
  const cliStart = Date.now()
  try {
    const { stdout } = await execAsyncDiag('where docker', { timeout: 10000 })
    const found = stdout
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .join(' | ')
    lines.push(`where docker (${Date.now() - cliStart}ms): ${found || '(no output)'}`)
  } catch (err) {
    lines.push(`where docker failed (${Date.now() - cliStart}ms): ${err}`)
  }
  lines.push(`resolved docker exe: ${getCachedDockerExe()}`)
  for (const candidate of getDockerCandidatePaths()) {
    lines.push(`${candidate}: ${existsSync(candidate) ? 'exists' : 'missing'}`)
  }
  lines.push('')
  lines.push('--- app process PATH ---')
  lines.push(process.env['PATH'] ?? '(not set)')
  lines.push('')
  try {
    lines.push('--- docker ps -a ---')
    lines.push(await getComposeContainers())
  } catch (err) {
    lines.push(`docker ps failed: ${err}`)
  }
  lines.push('')
  lines.push('--- docker compose ps ---')
  lines.push(await getComposePsText())
  lines.push('')
  const dbStatus = await getDbContainerStatus()
  lines.push(`DB status: running=${dbStatus.running}, restarting=${dbStatus.restarting}, health=${dbStatus.health}`)
  const serverState = await getServerContainerState()
  lines.push(`Server container: running=${serverState.running}, status=${serverState.status}, restarts=${serverState.restarts}, oomKilled=${serverState.oomKilled}, exitCode=${serverState.exitCode}`)
  lines.push('')
  lines.push('--- docker system df ---')
  lines.push(await getDockerSystemDf())
  lines.push('')
  lines.push('--- silverknight-server logs (last 50) ---')
  lines.push((await getServerContainerLogs(50)) || '(no logs available)')
  lines.push('')
  try {
    const logPath = join(app.getPath('userData'), 'logs', 'main.log')
    if (existsSync(logPath)) {
      const tail = readFileSync(logPath, 'utf-8')
        .split(/\r?\n/)
        .slice(-100)
        .join('\n')
      lines.push('--- main.log tail (last 100) ---')
      lines.push(tail)
    }
  } catch (err) {
    lines.push(`Could not read main.log: ${err}`)
  }
  return lines.join('\n')
}

async function copyDiagnostics(): Promise<void> {
  try {
    const text = await gatherDiagnostics()
    clipboard.writeText(text)
    log('startup', 'Diagnostics copied to clipboard')
    await dialog.showMessageBox({
      type: 'info',
      title: 'Diagnóstico copiado',
      message: 'El diagnóstico fue copiado al portapapeles.',
      detail:
        'Pégalo en el chat/WhatsApp al soporte técnico para poder ver la causa del error.',
      buttons: ['OK']
    })
  } catch (err) {
    log('startup', `Failed to copy diagnostics: ${err}`)
  }
}

async function runSelfHeal(): Promise<{ ok: boolean; message: string }> {
  log('startup', 'Self-heal: applying database schema via one-shot prisma db push...')
  sendSplash('splash-status', 'Reparando: aplicando esquema de base de datos...')

  const stopped = await stopServerContainer()
  if (!stopped) {
    log('startup', 'Self-heal: could not stop server container, continuing anyway')
  }

  const push = await runPrismaPushOnce()

  if (!push.ok) {
    const output = (push.output || '').slice(0, 2000)
    const exit = push.exitCode
    let reason: string
    if (exit === 137) {
      reason =
        'El proceso fue terminado por falta de memoria (código 137 / OOM).\n\n' +
        'Solución: abre Docker Desktop → Settings → Resources → aumenta la memoria ' +
        '(mínimo 4096 MB) → Apply & Restart. Luego vuelve a abrir Silver Knight.'
    } else if (
      /authentication failed|password authentication failed|P1000|role "silverknight" does not exist|SCRAM/i.test(
        output
      )
    ) {
      reason =
        'La contraseña de PostgreSQL no coincide con la base de datos existente.\n\n' +
        'Solución: abre Silver Knight → Configuración y vuelve a ingresar la contraseña original de la base de datos.'
    } else {
      reason = `prisma db push falló (exit ${exit ?? 'timeout'}):\n\n${output}`
    }
    return { ok: false, message: reason }
  }

  const hash = computeSchemaHash()
  if (hash) {
    await writeSchemaStateHash(hash)
  }

  const restarted = await restartServerContainer()
  if (!restarted) {
    return {
      ok: false,
      message: 'El esquema se aplicó correctamente, pero no se pudo reiniciar el contenedor del servidor.'
    }
  }

  const healthUrl = `http://localhost:${process.env['PORT'] || '3001'}/api/health`
  const result = await waitForBackendWithContainerCheck(healthUrl, 120000)
  if (result.status === 'ready') {
    log('startup', 'Self-heal succeeded: backend ready')
    return { ok: true, message: 'El servidor inició correctamente.' }
  }

  return {
    ok: false,
    message: `El esquema se aplicó correctamente, pero el servidor no respondió al reiniciar (${result.status}).`
  }
}

async function runResetPassword(): Promise<boolean> {
  sendSplash('splash-status', 'Restableciendo contraseña de la base de datos (conserva tus datos)...')
  log('startup', 'Resetting postgres password...')

  const newPassword = generatePassword()
  const res = await resetPostgresPassword(newPassword)

  if (!res.ok) {
    log('startup', `Password reset failed: ${res.output}`)
    return false
  }

  savePostgresPassword(newPassword)
  log('startup', 'Password reset ok, restarting backend with new credentials')
  return startBackend()
}

async function dumpBackendDiagnostics(): Promise<void> {
  log('startup', '--- Diagnostic dump ---')
  const text = await gatherDiagnostics()
  for (const line of text.split('\n')) {
    log('startup', line)
  }
  log('startup', '--- End diagnostic dump ---')
}

async function startBackend(): Promise<boolean> {
  log('startup', 'Checking Docker installation...')
  sendSplash('splash-status', 'Verificando Docker...')

  const dockerInfo = await checkDockerInstalled()
  if (!dockerInfo.installed) {
    const retry = await dialog.showMessageBox({
      type: 'error',
      title: 'Docker no detectado',
      message: 'No se pudo ejecutar Docker en esta máquina',
      detail:
        'Silver Knight necesita Docker Desktop.\n\n' +
        'Si Docker Desktop SÍ está instalado, es posible que el equipo tarde en responderlo ' +
        '(antivirus o inicio lento): pulsa "Reintentar".\n\n' +
        'Si no está instalado, descárgalo desde:\nhttps://www.docker.com/products/docker-desktop/',
      buttons: ['Reintentar', 'Copiar diagnóstico', 'Salir'],
      defaultId: 0,
      cancelId: 2
    })
    if (retry.response === 0 || retry.response === 1) {
      if (retry.response === 1) {
        await copyDiagnostics()
      }
      return startBackend()
    }
    app.quit()
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

  if (app.isPackaged) {
    const images = await getImageAvailability()
    const online = net.isOnline()
    log('startup', `Image availability — db: ${images.db}, server: ${images.server}; online: ${online}`)

    if (!images.db || !images.server) {
      if (!online) {
        log('startup', 'Offline and required images missing, asking for one online start')
        const offlineMsg =
          'Silver Knight necesita conectarse a internet una vez para descargar los componentes de su servidor.\n\n' +
          'En este momento el equipo está sin conexión y faltan las imágenes de Docker necesarias ' +
          '(PostgreSQL y el servidor de Silver Knight).\n\n' +
          'Conecta el equipo a internet y pulsa "Reintentar". ' +
          'Después de esta configuración inicial, la aplicación funcionará sin conexión.'
        const offlineRetry = await dialog.showMessageBox({
          type: 'info',
          title: 'Se necesita internet una sola vez',
          message: 'Primera configuración requiere internet',
          detail: offlineMsg,
          buttons: ['Reintentar', 'Copiar diagnóstico', 'Salir'],
          defaultId: 0,
          cancelId: 2
        })
        if (offlineRetry.response === 0) {
          return startBackend()
        }
        if (offlineRetry.response === 1) {
          await copyDiagnostics()
          return startBackend()
        }
        app.quit()
        return false
      }

      log('startup', 'Online and images missing, pre-warming image cache...')
      if (!images.server) {
        const imageResult = await ensureServerImage((line) => {
          if (line.includes('Building')) {
            sendSplash('splash-status', 'Construyendo imagen Docker...')
            sendSplash('splash-progress', 40)
          } else {
            sendSplash('splash-status', line)
          }
        })
        if (imageResult.error) {
          log('server-image', `Rebuild failed, continuing: ${imageResult.error}`)
        }
      }
      if (!images.db) {
        const dbPull = await pullDbImage((line) => {
          sendSplash('splash-status', line)
        })
        if (!dbPull.success) {
          log('image', `Postgres pull failed, compose will retry: ${dbPull.error}`)
        }
      }
    } else {
      const imageResult = await ensureServerImage((line) => {
        if (line.includes('Building')) {
          sendSplash('splash-status', 'Construyendo imagen Docker...')
          sendSplash('splash-progress', 40)
        } else {
          sendSplash('splash-status', line)
        }
      })
      if (imageResult.error && !imageResult.skippedOffline) {
        log('server-image', `Rebuild failed, continuing with existing image: ${imageResult.error}`)
      }
    }
  }

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
      buttons: ['Reintentar', 'Copiar diagnóstico', 'Salir'],
      defaultId: 0,
      cancelId: 2
    })

    if (retry.response === 0) {
      return startBackend()
    }
    if (retry.response === 1) {
      await copyDiagnostics()
      return startBackend()
    }
    app.quit()
    return false
  }

  sendSplash('splash-status', 'Esperando a que el servidor esté listo...')
  sendSplash('splash-progress', 80)

  const port = process.env['PORT'] || '3001'
  const healthUrl = `http://localhost:${port}/api/health`

  const backendResult = await waitForBackendWithContainerCheck(healthUrl, 180000, (attempt) => {
    const pct = Math.min(80 + attempt * 2, 98)
    sendSplash('splash-progress', pct)
  })

  if (backendResult.status !== 'ready') {
    log('startup', `Backend failed to start: ${backendResult.status}`)
    await dumpBackendDiagnostics()

    const serverLogs = (await getServerContainerLogs(100)) || '(sin logs disponibles)'

    const authPattern =
      /P1000|password authentication failed|FATAL: password authentication failed|role "silverknight" does not exist|SCRAM authentication|Authentication failed against database server/i
    const isAuthFailure = authPattern.test(serverLogs)

    const isOom = backendResult.status === 'container-crashed' && backendResult.oomKilled

    let healMessage = ''
    if (backendResult.status === 'container-crashed' && !selfHealAttempted) {
      selfHealAttempted = true
      sendSplash('splash-status', 'Detecté un fallo del servidor. Reparando automáticamente...')
      log('startup', 'Self-healing automatically (container crashed)')
      const healed = await runSelfHeal()
      if (healed.ok) {
        sendSplash('splash-progress', 100)
        sendSplash('splash-success', 'Servidor listo')
        log('startup', 'Auto self-heal succeeded')
        return true
      }
      healMessage = healed.message
    }

    const isAuthProblem = isAuthFailure || (!!healMessage && authPattern.test(healMessage))

    let detail: string
    if (isAuthProblem) {
      detail =
        'La contraseña de PostgreSQL guardada no coincide con la base de datos existente (error P1000).\n\n' +
        'La base de datos (volumen silverknight-pgdata) conserva sus datos y su contraseña original.\n' +
        'Pulsa "Restablecer contraseña" para cambiarla dentro de la base de datos SIN borrar tus datos.\n\n' +
        `Últimos logs del contenedor:\n${serverLogs.slice(0, 1500)}`
    } else if (isOom) {
      detail =
        'El contenedor del servidor fue terminado por falta de memoria (OOM).\n\n' +
        'La máquina no tiene suficiente RAM para PostgreSQL + el servidor.\n' +
        'Solución: abre Docker Desktop → Settings → Resources → aumenta la memoria (mínimo 4096 MB) → Apply & Restart.\n\n' +
        `Código de salida: ${backendResult.exitCode}, reinicios: ${backendResult.restarts}`
    } else if (backendResult.status === 'container-crashed') {
      detail =
        `El contenedor del servidor no está corriendo (estado: ${backendResult.containerState}, reinicios: ${backendResult.restarts}, exit ${backendResult.exitCode}).\n\n` +
        `Últimos logs del contenedor:\n${serverLogs.slice(0, 2000)}`
    } else {
      detail =
        `El backend tardó demasiado en iniciar. Verifica que el puerto ${port} no esté en uso.\n\n` +
        `Últimos logs del contenedor:\n${serverLogs.slice(0, 2000)}`
    }

    if (healMessage && !isAuthProblem) {
      detail = healMessage + '\n\n---\n\n' + detail
    }

    const buttons = isAuthProblem
      ? ['Restablecer contraseña', 'Reintentar', 'Copiar diagnóstico', 'Salir']
      : ['Reintentar', 'Copiar diagnóstico', 'Salir']
    const resetIdx = 0
    const retryIdx = isAuthProblem ? 1 : 0
    const copyIdx = isAuthProblem ? 2 : 1

    const retry = await dialog.showMessageBox({
      type: 'error',
      title: 'Servidor no responde',
      message: 'El backend no está respondiendo.',
      detail,
      buttons,
      defaultId: 0,
      cancelId: buttons.length - 1
    })

    if (isAuthProblem && retry.response === resetIdx) {
      const resetOk = await runResetPassword()
      if (resetOk) {
        return true
      }
      const retry2 = await dialog.showMessageBox({
        type: 'error',
        title: 'No se pudo restablecer',
        message: 'El restablecimiento de contraseña no funcionó.',
        detail: 'Usa "Copiar diagnóstico" para reportar el problema con los logs.',
        buttons: ['Reintentar', 'Salir'],
        defaultId: 0,
        cancelId: 1
      })
      if (retry2.response === 0) {
        return startBackend()
      }
      app.quit()
      return false
    }

    if (retry.response === retryIdx) {
      return startBackend()
    }
    if (retry.response === copyIdx) {
      await copyDiagnostics()
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

  ipcMain.handle(
    'save-file',
    async (
      _event,
      data: { buffer: ArrayBuffer; defaultName: string; defaultDir?: string }
    ) => {
      try {
        const defaultPath =
          data.defaultDir && data.defaultDir.trim()
            ? path.join(data.defaultDir.trim(), data.defaultName)
            : data.defaultName

        if (data.defaultDir && data.defaultDir.trim()) {
          const { mkdirSync } = await import('fs')
          mkdirSync(data.defaultDir.trim(), { recursive: true })
        }

        const result = await dialog.showSaveDialog({
          defaultPath,
          filters: [
            { name: 'Todos los archivos', extensions: ['*'] },
            { name: 'JSON', extensions: ['json'] },
            { name: 'CSV', extensions: ['csv'] }
          ]
        })
        if (result.canceled || !result.filePath) return { canceled: true }
        writeFileSync(result.filePath, Buffer.from(data.buffer))
        return { canceled: false, filePath: result.filePath }
      } catch (e) {
        log('ipc', `save-file error: ${e instanceof Error ? e.message : String(e)}`)
        return { canceled: true, error: e instanceof Error ? e.message : String(e) }
      }
    }
  )

  ipcMain.handle('select-directory', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      })
      if (result.canceled || !result.filePaths[0]) return { canceled: true }
      return { canceled: false, path: result.filePaths[0] }
    } catch (e) {
      log('ipc', `select-directory error: ${e instanceof Error ? e.message : String(e)}`)
      return { canceled: true }
    }
  })

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

    const backendStatus = await waitForBackend(healthUrl, 180000)
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
  flushLogsSync()

  if (!app.isPackaged) return

  const dir = is.dev ? process.cwd() : process.resourcesPath
  try {
    execSync(`"${getCachedDockerExe()}" compose down`, {
      cwd: dir,
      env: {
        ...process.env,
        ...loadEnvForChild(),
        COMPOSE_PROJECT_NAME: 'silverknight'
      } as NodeJS.ProcessEnv,
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
