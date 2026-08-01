import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { readFileSync } from 'fs'
import { createHash } from 'crypto'
import { app } from 'electron'
import { loadEnvForChild } from './config'
import { log } from './logger'

const execAsync = promisify(exec)

export type DockerStatus = 'installed' | 'not-installed' | 'running' | 'stopped'
export type ComposeStatus = 'running' | 'stopped' | 'starting' | 'error'
export type BackendStatus = 'ready' | 'starting' | 'error'

interface DockerInfo {
  installed: boolean
  running: boolean
  version?: string
}

interface ComposeInfo {
  serverRunning: boolean
  dbRunning: boolean
}

function getComposeDir(): string {
  if (app.isPackaged) {
    return process.resourcesPath
  }
  return path.join(__dirname, '..', '..', '..')
}

function getComposeCmd(): string {
  return 'docker compose'
}

function getChildEnv(): Record<string, string> {
  return {
    ...process.env,
    ...loadEnvForChild(),
    COMPOSE_PROJECT_NAME: 'silverknight'
  } as Record<string, string>
}

export async function checkDockerInstalled(): Promise<DockerInfo> {
  try {
    const { stdout } = await execAsync('docker --version', { timeout: 5000 })
    const versionMatch = stdout.match(/Docker version ([\d.]+)/)
    const version = versionMatch ? versionMatch[1] : 'unknown'
    log('check', `Docker installed: v${version}`)
    return { installed: true, running: false, version }
  } catch {
    log('check', 'Docker not installed')
    return { installed: false, running: false }
  }
}

export async function checkDockerRunning(): Promise<boolean> {
  try {
    await execAsync('docker info', { timeout: 5000 })
    log('check', 'Docker daemon is running')
    return true
  } catch {
    log('check', 'Docker daemon is not running')
    return false
  }
}

export async function launchDockerDesktop(): Promise<boolean> {
  const possiblePaths = [
    'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
    'C:\\Program Files (x86)\\Docker\\Docker\\Docker Desktop.exe'
  ]

  for (const exePath of possiblePaths) {
    try {
      const { execSync } = await import('child_process')
      execSync(`start "" "${exePath}"`, { timeout: 5000 })
      log('launch', `Launched Docker Desktop from ${exePath}`)
      return true
    } catch {
      continue
    }
  }

  log('launch', 'Could not find Docker Desktop executable')
  return false
}

export async function waitForDocker(timeoutMs = 30000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await checkDockerRunning()) return true
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}

export async function checkComposeStatus(): Promise<ComposeInfo> {
  const dir = getComposeDir()
  try {
    const { stdout } = await execAsync(`${getComposeCmd()} ps --format json`, {
      cwd: dir,
      timeout: 10000
    })

    let serverRunning = false
    let dbRunning = false

    const lines = stdout.trim().split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const svc = JSON.parse(line)
        if (svc.Service === 'server' && svc.State === 'running') serverRunning = true
        if (svc.Service === 'db' && svc.State === 'running') dbRunning = true
      } catch {
        if (line.includes('silverknight-server') && line.includes('running')) serverRunning = true
        if (line.includes('silverknight-db') && line.includes('running')) dbRunning = true
      }
    }

    log('compose', `Status — server: ${serverRunning}, db: ${dbRunning}`)
    return { serverRunning, dbRunning }
  } catch {
    log('compose', 'Could not determine compose status')
    return { serverRunning: false, dbRunning: false }
  }
}

export async function cleanupStaleContainers(): Promise<void> {
  try {
    const { stdout } = await execAsync(
      'docker ps -a --filter name=silverknight --format "{{.ID}} {{.Names}}"',
      { timeout: 10000 }
    )

    const toRemove: string[] = []
    for (
      const line of stdout
        .trim()
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    ) {
      const [id, name] = line.split(/\s+/, 2)
      // Never force-kill the DB container: `docker rm -f` on Postgres leaves an
      // unclean shutdown that forces crash recovery on the next start, which is
      // slow with a production-sized pgdata volume. Compose up reconciles it.
      if (name === 'silverknight-db') continue
      if (id) toRemove.push(id)
    }

    if (toRemove.length > 0) {
      log('cleanup', `Removing stale containers: ${toRemove.join(', ')}`)
      await execAsync(`docker rm -f ${toRemove.join(' ')}`, { timeout: 20000 })
      log('cleanup', 'Stale containers removed')
    }
  } catch (err) {
    log('cleanup', `Cleanup error: ${err}`)
  }
}

export async function startCompose(
  onOutput?: (line: string) => void
): Promise<{ success: boolean; error?: string }> {
  const dir = getComposeDir()
  log('compose', `Starting docker compose in ${dir}`)

  const run = (): Promise<{ success: boolean; error?: string }> =>
    new Promise((resolve) => {
      const proc = spawn('docker', ['compose', 'up', '-d'], {
        cwd: dir,
        env: getChildEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      })

      let stderr = ''

      proc.stdout.on('data', (data: Buffer) => {
        const line = data.toString().trim()
        if (line) {
          log('compose', line)
          onOutput?.(line)
        }
      })

      proc.stderr.on('data', (data: Buffer) => {
        const line = data.toString().trim()
        if (line) {
          stderr += line + '\n'
          log('compose', `[stderr] ${line}`)
          onOutput?.(line)
        }
      })

      proc.on('close', (code) => {
        if (code === 0) {
          log('compose', 'Docker compose started successfully')
          resolve({ success: true })
        } else {
          log('compose', `Docker compose failed with code ${code}`)
          resolve({ success: false, error: stderr || `Exit code ${code}` })
        }
      })

      proc.on('error', (err) => {
        log('compose', `Spawn error: ${err.message}`)
        resolve({ success: false, error: err.message })
      })
    })

  const result = await run()

  if (
    !result.success &&
    result.error &&
    /conflict|already in use|already in progress|port is already allocated|address already in use/i.test(
      result.error
    )
  ) {
    log('compose', 'Container name conflict detected, cleaning stale containers and retrying...')
    onOutput?.('Limpiando contenedores obsoletos...')
    await cleanupStaleContainers()
    return run()
  }

  return result
}

export async function stopCompose(): Promise<void> {
  const dir = getComposeDir()
  log('compose', 'Stopping docker compose')

  try {
    await execAsync(`${getComposeCmd()} down`, { cwd: dir, env: getChildEnv(), timeout: 30000 })
    log('compose', 'Docker compose stopped')
  } catch (err) {
    log('compose', `Error stopping compose: ${err}`)
  }
}

export async function restartCompose(
  onOutput?: (line: string) => void
): Promise<{ success: boolean; error?: string }> {
  const dir = getComposeDir()
  log('compose', 'Restarting docker compose')

  return new Promise((resolve) => {
    const proc = spawn('docker', ['compose', 'down'], {
      cwd: dir,
      env: getChildEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    })

    proc.on('close', (code) => {
      if (code === 0) {
        startCompose(onOutput).then(resolve)
      } else {
        resolve({ success: false, error: `docker compose down failed with code ${code}` })
      }
    })

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
  })
}

export async function buildCompose(
  onOutput?: (line: string) => void
): Promise<{ success: boolean; error?: string }> {
  const dir = getComposeDir()
  log('compose', 'Building docker compose images')

  return new Promise((resolve) => {
    const proc = spawn('docker', ['compose', 'build'], {
      cwd: dir,
      env: getChildEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    })

    let stderr = ''

    proc.stdout.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      if (line) {
        log('build', line)
        onOutput?.(line)
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      if (line) {
        stderr += line + '\n'
        log('build', `[stderr] ${line}`)
        onOutput?.(line)
      }
    })

    proc.on('close', (code) => {
      if (code === 0) {
        log('build', 'Build completed successfully')
        resolve({ success: true })
      } else {
        log('build', `Build failed with code ${code}`)
        resolve({ success: false, error: stderr || `Exit code ${code}` })
      }
    })

    proc.on('error', (err) => {
      log('build', `Spawn error: ${err.message}`)
      resolve({ success: false, error: err.message })
    })
  })
}

export async function pullImages(
  onOutput?: (line: string) => void
): Promise<{ success: boolean; error?: string }> {
  const dir = getComposeDir()
  log('compose', 'Pulling latest images')

  return new Promise((resolve) => {
    const proc = spawn('docker', ['compose', 'pull'], {
      cwd: dir,
      env: getChildEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    })

    let stderr = ''

    proc.stdout.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      if (line) {
        log('pull', line)
        onOutput?.(line)
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      if (line) {
        stderr += line + '\n'
        log('pull', `[stderr] ${line}`)
        onOutput?.(line)
      }
    })

    proc.on('close', (code) => {
      if (code === 0) {
        log('pull', 'Pull completed')
        resolve({ success: true })
      } else {
        log('pull', `Pull failed with code ${code}`)
        resolve({ success: false, error: stderr || `Exit code ${code}` })
      }
    })

    proc.on('error', (err) => {
      log('pull', `Spawn error: ${err.message}`)
      resolve({ success: false, error: err.message })
    })
  })
}

export async function getComposeContainers(): Promise<string> {
  try {
    const { stdout } = await execAsync(
      'docker ps -a --format "{{.Names}} | {{.Image}} | {{.Status}}"',
      { timeout: 8000 }
    )
    return stdout.trim()
  } catch (err) {
    return `Could not list containers: ${err}`
  }
}

export async function getServerContainerLogs(lines = 30): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `docker logs --tail ${lines} silverknight-server`,
      { timeout: 5000 }
    )
    return stdout
  } catch {
    return ''
  }
}

export async function getDbContainerStatus(): Promise<{
  running: boolean
  restarting: boolean
  health: string
}> {
  try {
    const { stdout } = await execAsync(
      'docker inspect --format "{{.State.Status}} {{.State.Health.Status}} {{.RestartCount}}" silverknight-db',
      { timeout: 5000 }
    )
    const [status, health, restartCount] = stdout.trim().split(' ')
    return {
      running: status === 'running',
      restarting: (parseInt(restartCount) || 0) > 0,
      health: health || 'unknown'
    }
  } catch {
    return { running: false, restarting: false, health: 'unknown' }
  }
}

export async function getServerContainerState(): Promise<{
  running: boolean
  status: string
  restarts: number
  oomKilled: boolean
  exitCode: number
}> {
  try {
    const { stdout } = await execAsync(
      'docker inspect --format "{{.State.Status}} {{.RestartCount}} {{.State.OOMKilled}} {{.State.ExitCode}}" silverknight-server',
      { timeout: 5000 }
    )
    const [status, restartCount, oomKilled, exitCode] = stdout.trim().split(/\s+/)
    return {
      running: status === 'running',
      status: status || 'unknown',
      restarts: parseInt(restartCount || '0', 10) || 0,
      oomKilled: oomKilled === 'true',
      exitCode: parseInt(exitCode || '0', 10) || 0
    }
  } catch {
    return { running: false, status: 'unknown', restarts: 0, oomKilled: false, exitCode: 0 }
  }
}

export async function getComposePsText(): Promise<string> {
  try {
    const { stdout } = await execAsync(`${getComposeCmd()} ps --format json`, {
      cwd: getComposeDir(),
      env: getChildEnv(),
      timeout: 8000
    })
    return stdout.trim()
  } catch (err) {
    return `docker compose ps failed: ${err}`
  }
}

export async function runPrismaPushOnce(): Promise<{
  ok: boolean
  exitCode: number | null
  output: string
}> {
  const dir = getComposeDir()
  log('push', 'Running one-shot prisma db push...')

  return new Promise((resolve) => {
    const proc = spawn(
      'docker',
      [
        'compose',
        'run',
        '--rm',
        '--no-deps',
        '-T',
        '--entrypoint',
        'npx',
        'server',
        'prisma',
        'db',
        'push',
        '--accept-data-loss',
        '--skip-generate'
      ],
      {
        cwd: dir,
        env: getChildEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      }
    )

    let output = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      proc.kill()
    }, 150000)

    const onData = (chunk: Buffer, isErr: boolean): void => {
      const text = chunk.toString()
      output += text
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim()
        if (t) log('push', isErr ? `[stderr] ${t}` : t)
      }
    }

    proc.stdout.on('data', (d: Buffer) => onData(d, false))
    proc.stderr.on('data', (d: Buffer) => onData(d, true))

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) {
        log('push', 'prisma db push timed out (150s)')
        resolve({ ok: false, exitCode: null, output: `${output}\n[timeout tras 150s]` })
      } else {
        log('push', `prisma db push exited with code ${code}`)
        resolve({ ok: code === 0, exitCode: code, output })
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      log('push', `Spawn error: ${err.message}`)
      resolve({ ok: false, exitCode: null, output: `Error al ejecutar docker: ${err.message}` })
    })
  })
}

export function computeSchemaHash(): string | null {
  try {
    const schemaPath = path.join(getComposeDir(), 'prisma', 'schema.prisma')
    const content = readFileSync(schemaPath)
    return createHash('sha256').update(content).digest('hex')
  } catch (err) {
    log('push', `Could not read schema.prisma: ${err}`)
    return null
  }
}

export async function writeSchemaStateHash(hash: string): Promise<boolean> {
  log('push', 'Writing schema hash to schema-state volume...')
  return new Promise((resolve) => {
    const proc = spawn(
      'docker',
      [
        'run',
        '--rm',
        '--entrypoint',
        '/bin/sh',
        '-e',
        `SK_SCHEMA_HASH=${hash}`,
        '-v',
        'silverknight-schema-state:/schema-state',
        'silverknight-server:latest',
        '-c',
        'echo "$SK_SCHEMA_HASH" > /schema-state/schema-hash'
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], shell: false }
    )

    let out = ''
    proc.stdout.on('data', (d: Buffer) => (out += d.toString()))
    proc.stderr.on('data', (d: Buffer) => (out += d.toString()))

    proc.on('close', (code) => {
      log('push', `Schema hash write ${code === 0 ? 'ok' : 'failed'}: ${out.trim()}`)
      resolve(code === 0)
    })
    proc.on('error', () => resolve(false))
  })
}

export async function restartServerContainer(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['compose', 'restart', 'server'], {
      cwd: getComposeDir(),
      env: getChildEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    })
    proc.on('close', (code) => {
      log('push', `Server container restart ${code === 0 ? 'ok' : `failed (code ${code})`}`)
      resolve(code === 0)
    })
    proc.on('error', () => resolve(false))
  })
}

export async function stopServerContainer(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['compose', 'stop', 'server'], {
      cwd: getComposeDir(),
      env: getChildEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    })
    proc.on('close', (code) => {
      log('push', `Server container stop ${code === 0 ? 'ok' : `failed (code ${code})`}`)
      resolve(code === 0)
    })
    proc.on('error', () => resolve(false))
  })
}

export async function getDockerSystemDf(): Promise<string> {
  try {
    const { stdout } = await execAsync('docker system df', { timeout: 8000 })
    return stdout.trim()
  } catch (err) {
    return `docker system df failed: ${err}`
  }
}

export async function resetPostgresPassword(newPassword: string): Promise<{
  ok: boolean
  exitCode: number | null
  output: string
}> {
  const dir = getComposeDir()
  const pgUser = loadEnvForChild()['POSTGRES_USER'] || 'silverknight'
  log('push', `Resetting postgres password via local trust auth (user ${pgUser})...`)

  try {
    await execAsync(`${getComposeCmd()} up -d db`, {
      cwd: dir,
      env: getChildEnv(),
      timeout: 60000
    })
    log('push', 'db container ensured running')
  } catch (err) {
    log('push', `Failed to ensure db container running: ${err}`)
  }

  const sql = `"ALTER USER ${pgUser} PASSWORD '${newPassword}';"`

  return new Promise((resolve) => {
    const proc = spawn(
      'docker',
      ['compose', 'exec', '-T', 'db', 'psql', '-w', '-U', pgUser, '-c', sql],
      {
        cwd: dir,
        env: getChildEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      }
    )

    let output = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      proc.kill()
    }, 60000)

    const onData = (chunk: Buffer, isErr: boolean): void => {
      const text = chunk.toString()
      output += text
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim()
        if (t) log('push', isErr ? `[stderr] ${t}` : t)
      }
    }

    proc.stdout.on('data', (d: Buffer) => onData(d, false))
    proc.stderr.on('data', (d: Buffer) => onData(d, true))

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) {
        log('push', 'psql ALTER USER timed out (60s)')
        resolve({ ok: false, exitCode: null, output: `${output}\n[timeout tras 60s]` })
      } else {
        log('push', `psql ALTER USER exited with code ${code}`)
        resolve({ ok: code === 0, exitCode: code, output })
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      log('push', `Spawn error: ${err.message}`)
      resolve({ ok: false, exitCode: null, output: `Error al ejecutar docker: ${err.message}` })
    })
  })
}

export async function waitForBackend(
  url: string,
  timeoutMs = 180000,
  onProgress?: (attempt: number) => void
): Promise<BackendStatus> {
  log('backend', `Waiting for backend at ${url} (timeout: ${timeoutMs}ms)`)
  const start = Date.now()
  let attempt = 0

  while (Date.now() - start < timeoutMs) {
    attempt++
    onProgress?.(attempt)
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        log('backend', `Backend ready after ${attempt} attempts`)
        return 'ready'
      }
    } catch {
      // not ready yet
    }
    if (attempt % 10 === 0) {
      log(
        'backend',
        `Still waiting for backend (attempt ${attempt}, elapsed ${Date.now() - start}ms)`
      )
    }
    await new Promise((r) => setTimeout(r, 2000))
  }

  log('backend', 'Backend timeout')
  return 'error'
}

export type BackendStartResult =
  | { status: 'ready' }
  | {
      status: 'container-crashed'
      containerState: string
      restarts: number
      oomKilled: boolean
      exitCode: number
    }
  | { status: 'timeout' }

export async function waitForBackendWithContainerCheck(
  url: string,
  timeoutMs = 180000,
  onProgress?: (attempt: number) => void
): Promise<BackendStartResult> {
  log('backend', `Waiting for backend at ${url} (timeout: ${timeoutMs}ms)`)
  const start = Date.now()
  let attempt = 0

  while (Date.now() - start < timeoutMs) {
    attempt++
    onProgress?.(attempt)
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        log('backend', `Backend ready after ${attempt} attempts`)
        return { status: 'ready' }
      }
    } catch {
      // not ready yet
    }

    if (attempt >= 3 && attempt % 2 === 0) {
      const state = await getServerContainerState()
      if (!state.running) {
        log(
          'backend',
          `Server container crashed: status=${state.status}, restarts=${state.restarts}, oomKilled=${state.oomKilled}`
        )
        return {
          status: 'container-crashed',
          containerState: state.status,
          restarts: state.restarts,
          oomKilled: state.oomKilled,
          exitCode: state.exitCode
        }
      }
    }

    if (attempt % 10 === 0) {
      log(
        'backend',
        `Still waiting for backend (attempt ${attempt}, elapsed ${Date.now() - start}ms)`
      )
    }
    await new Promise((r) => setTimeout(r, 2000))
  }

  log('backend', 'Backend timeout')
  return { status: 'timeout' }
}
