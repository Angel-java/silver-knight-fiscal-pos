import { app, net } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { buildCompose, imageExists, SERVER_IMAGE } from './docker'
import { log } from './logger'

function getSentinelPath(): string {
  return join(app.getPath('userData'), '.server-version')
}

function readServerImageVersion(): string {
  try {
    const file = getSentinelPath()
    if (existsSync(file)) {
      return readFileSync(file, 'utf-8').trim()
    }
  } catch {
    // ignore
  }
  return ''
}

function writeServerImageVersion(version: string): void {
  try {
    writeFileSync(getSentinelPath(), version, 'utf-8')
    log('server-image', `Saved server image version: ${version}`)
  } catch (err) {
    log('server-image', `Failed to write version file: ${err}`)
  }
}

export interface EnsureServerImageResult {
  rebuilt: boolean
  error?: string
  skippedOffline?: boolean
}

export async function ensureServerImage(
  onOutput?: (line: string) => void
): Promise<EnsureServerImageResult> {
  const appVersion = app.getVersion()
  const lastVersion = readServerImageVersion()

  log('server-image', `App v${appVersion}, server image v${lastVersion}`)

  if (appVersion === lastVersion) {
    log('server-image', 'Server image is up to date, no rebuild needed')
    return { rebuilt: false }
  }

  const serverImagePresent = await imageExists(SERVER_IMAGE)

  if (!net.isOnline()) {
    if (serverImagePresent) {
      log(
        'server-image',
        'Offline: skipping rebuild, using cached server image (will rebuild when back online)'
      )
      return { rebuilt: false, skippedOffline: true }
    }
    log('server-image', 'Offline and no cached server image')
    return {
      rebuilt: false,
      skippedOffline: true,
      error: `No se pudo reconstruir la imagen del servidor: no hay conexión a internet y no existe imagen en caché.`
    }
  }

  log('server-image', 'Version mismatch, building server image...')
  onOutput?.(`Preparando servidor v${appVersion}...`)

  const buildResult = await buildCompose(onOutput)
  if (!buildResult.success) {
    log('server-image', `Build failed: ${buildResult.error}`)
    if (serverImagePresent) {
      log('server-image', 'Build failed but cached image exists, continuing with it')
      return { rebuilt: false, error: buildResult.error }
    }
    onOutput?.('No se pudo reconstruir la imagen del servidor.')
    return { rebuilt: false, error: buildResult.error }
  }

  writeServerImageVersion(appVersion)
  log('server-image', 'Server image built and version recorded')
  return { rebuilt: true }
}
