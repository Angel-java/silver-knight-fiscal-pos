import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { buildCompose } from './docker'
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

export async function ensureServerImage(
  onOutput?: (line: string) => void
): Promise<{ rebuilt: boolean; error?: string }> {
  const appVersion = app.getVersion()
  const lastVersion = readServerImageVersion()

  log('server-image', `App v${appVersion}, server image v${lastVersion}`)

  if (appVersion === lastVersion) {
    log('server-image', 'Server image is up to date, no rebuild needed')
    return { rebuilt: false }
  }

  log('server-image', 'Version mismatch, building server image...')
  onOutput?.(`Preparando servidor v${appVersion}...`)

  const buildResult = await buildCompose(onOutput)
  if (!buildResult.success) {
    log('server-image', `Build failed: ${buildResult.error}`)
    onOutput?.('No se pudo reconstruir la imagen del servidor.')
    return { rebuilt: false, error: buildResult.error }
  }

  writeServerImageVersion(appVersion)
  log('server-image', 'Server image built and version recorded')
  return { rebuilt: true }
}
