import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import path from 'path'
import { log } from './logger'

const execAsync = promisify(exec)

/**
 * Docker CLI resolution.
 *
 * On some machines (slow disks, antivirus scanning every new process, stale PATH
 * inside the packaged app) a plain `docker --version` can take several seconds.
 * The old 5s timeout made those machines report "Docker not installed" even when
 * it was installed and working in a normal terminal.
 *
 * Strategy:
 * - Generous timeout per probe (20s).
 * - Probe bare `docker` (PATH) first, then well-known absolute install locations.
 * - Retry the whole resolution a few times before giving up.
 * - Cache the winning executable so every later spawn/exec uses the same path
 *   without paying the lookup cost again.
 */

export const DOCKER_CHECK_TIMEOUT_MS = 20000
export const DOCKER_CHECK_ATTEMPTS = 3
export const DOCKER_CHECK_RETRY_DELAY_MS = 1500

export interface ResolvedDocker {
  exe: string
  version: string
}

let resolvedExe: string | null = null
let resolvedVersion: string | null = null

/** Synchronous accessor for the resolved docker CLI ('docker' until resolved). */
export function getCachedDockerExe(): string {
  return resolvedExe ?? 'docker'
}

/** Well-known docker.exe install locations (Windows). */
export function getDockerCandidatePaths(): string[] {
  if (process.platform !== 'win32') return []
  const candidates = [
    'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
    'C:\\Program Files (x86)\\Docker\\Docker\\resources\\bin\\docker.exe'
  ]
  if (process.env.LOCALAPPDATA) {
    candidates.push(
      path.join(process.env.LOCALAPPDATA, 'Docker', 'Docker', 'resources', 'bin', 'docker.exe')
    )
  }
  return candidates
}

/** Runs `<target> --version`; returns the parsed version or null on any failure. */
export async function probeDockerVersion(target: string): Promise<string | null> {
  const start = Date.now()
  try {
    const { stdout } = await execAsync(`"${target}" --version`, {
      timeout: DOCKER_CHECK_TIMEOUT_MS,
      windowsHide: true
    })
    const match = /Docker version ([^\s,]+)/.exec(stdout)
    if (!match) {
      log('check', `"${target}" --version gave unparseable output after ${Date.now() - start}ms`)
      return null
    }
    log('check', `"${target}" --version ok: v${match[1]} (${Date.now() - start}ms)`)
    return match[1]
  } catch (err) {
    const code = (err as { killed?: boolean }).killed ? ' (timed out)' : ''
    log('check', `"${target}" --version failed after ${Date.now() - start}ms${code}`)
    return null
  }
}

/**
 * Resolves the docker CLI once. Returns the cached result on subsequent calls;
 * otherwise probes PATH first and then falls back to known install locations.
 */
export async function resolveDockerOnce(): Promise<ResolvedDocker | null> {
  if (resolvedExe && resolvedVersion) {
    return { exe: resolvedExe, version: resolvedVersion }
  }

  const viaPath = await probeDockerVersion('docker')
  if (viaPath) {
    resolvedExe = 'docker'
    resolvedVersion = viaPath
    return { exe: resolvedExe, version: viaPath }
  }

  for (const candidate of getDockerCandidatePaths()) {
    if (!existsSync(candidate)) continue
    const version = await probeDockerVersion(candidate)
    if (version) {
      resolvedExe = candidate
      resolvedVersion = version
      return { exe: candidate, version }
    }
  }

  return null
}

/**
 * Resolves the docker CLI with retries and short backoff between attempts.
 * A machine where `docker --version` intermittently stalls gets multiple
 * chances instead of an immediate false "not installed".
 */
export async function resolveDockerWithRetry(
  onAttempt?: (message: string) => void
): Promise<ResolvedDocker | null> {
  const start = Date.now()
  for (let attempt = 1; attempt <= DOCKER_CHECK_ATTEMPTS; attempt++) {
    const resolved = await resolveDockerOnce()
    if (resolved) return resolved

    const elapsed = Date.now() - start
    const message = `Docker not detected (attempt ${attempt}/${DOCKER_CHECK_ATTEMPTS}, elapsed ${elapsed}ms)`
    log('check', message)
    onAttempt?.(message)

    if (attempt < DOCKER_CHECK_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, DOCKER_CHECK_RETRY_DELAY_MS * attempt))
    }
  }
  return null
}

/** Test-only helper to reset the cached resolution between tests. */
export function __resetDockerResolutionForTests(): void {
  resolvedExe = null
  resolvedVersion = null
}
