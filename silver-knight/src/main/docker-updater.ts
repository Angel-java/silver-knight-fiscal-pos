import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { buildCompose, stopCompose, startCompose } from './docker'

function log(tag: string, msg: string): void {
  console.log(`[docker-updater] [${tag}] ${msg}`)
}

function getVersionFile(): string {
  const dir = app.isPackaged
    ? join(process.resourcesPath)
    : join(__dirname, '..', '..', '..')
  return join(dir, '.server-version')
}

function readCurrentServerVersion(): string {
  try {
    const file = getVersionFile()
    if (existsSync(file)) {
      return readFileSync(file, 'utf-8').trim()
    }
  } catch {
    // ignore
  }
  return ''
}

function writeCurrentServerVersion(version: string): void {
  try {
    const file = getVersionFile()
    writeFileSync(file, version, 'utf-8')
    log('version', `Saved server version: ${version}`)
  } catch (err) {
    log('error', `Failed to write version file: ${err}`)
  }
}

export async function checkAndRebuildServer(
  onOutput?: (line: string) => void
): Promise<{ rebuilt: boolean; error?: string }> {
  const appVersion = app.getVersion()
  const lastServerVersion = readCurrentServerVersion()

  log('check', `App v${appVersion}, last server v${lastServerVersion}`)

  if (appVersion === lastServerVersion) {
    log('check', 'Server version matches, no rebuild needed')
    return { rebuilt: false }
  }

  log('check', 'Version mismatch, rebuilding server...')
  onOutput?.(`Actualizando servidor de v${lastServerVersion || 'desconocido'} a v${appVersion}...`)

  const buildResult = await buildCompose(onOutput)
  if (!buildResult.success) {
    log('error', `Build failed: ${buildResult.error}`)
    return { rebuilt: false, error: buildResult.error }
  }

  onOutput?.('Reiniciando contenedores...')
  await stopCompose()
  const startResult = await startCompose(onOutput)

  if (!startResult.success) {
    log('error', `Start failed after rebuild: ${startResult.error}`)
    return { rebuilt: false, error: startResult.error }
  }

  writeCurrentServerVersion(appVersion)
  log('check', 'Server rebuilt and restarted successfully')
  return { rebuilt: true }
}
