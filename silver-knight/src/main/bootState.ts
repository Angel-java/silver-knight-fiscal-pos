import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { log } from './logger'

export interface BootState {
  appVersion: string
  lastCleanShutdown: boolean
  consecutiveFailures: number
  lastUpdateAppliedVersion: string | null
  failuresAfterUpdate: number
  pendingUpgrade: string | null
  lastBootAt: string | null
}

const DEFAULT_BOOT_STATE: BootState = {
  appVersion: '',
  lastCleanShutdown: true,
  consecutiveFailures: 0,
  lastUpdateAppliedVersion: null,
  failuresAfterUpdate: 0,
  pendingUpgrade: null,
  lastBootAt: null
}

let testUserDataDir: string | null = null

// Test hook: redirects the userData path without needing a real electron app.
export function __setUserDataDirForTests(dir: string | null): void {
  testUserDataDir = dir
}

function currentUserDataDir(): string {
  return testUserDataDir || app.getPath('userData')
}

function bootStatePath(): string {
  return join(currentUserDataDir(), 'bootState.json')
}

export function readBootState(): BootState {
  try {
    const raw = readFileSync(bootStatePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<BootState>
    return { ...DEFAULT_BOOT_STATE, ...parsed }
  } catch {
    return { ...DEFAULT_BOOT_STATE }
  }
}

function writeBootState(state: BootState): void {
  try {
    const dir = currentUserDataDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(bootStatePath(), JSON.stringify(state, null, 2), 'utf-8')
  } catch (err) {
    log('bootstate', `Failed to write boot state: ${err}`)
  }
}

/**
 * Called once at app startup (before anything heavy). If the previous boot did
 * not end with a clean shutdown this boot is counted as a failure, which drives
 * the recovery window and the automatic rollback of a broken update.
 */
export function initBootState(): BootState {
  const state = readBootState()
  const version = app.getVersion()
  log(
    'bootstate',
    `Boot start. version=${version} clean=${state.lastCleanShutdown} failures=${state.consecutiveFailures}`
  )
  const next: BootState = {
    ...state,
    appVersion: version,
    lastBootAt: new Date().toISOString()
  }
  if (!state.lastCleanShutdown) {
    next.consecutiveFailures = (state.consecutiveFailures || 0) + 1
    if (state.lastUpdateAppliedVersion && state.lastUpdateAppliedVersion === version) {
      next.failuresAfterUpdate = (state.failuresAfterUpdate || 0) + 1
    }
  } else {
    next.consecutiveFailures = 0
    next.failuresAfterUpdate = 0
  }
  next.lastCleanShutdown = false
  writeBootState(next)
  return next
}

/** The boot succeeded (backend up + main window shown). Clears the failure flags. */
export function markBootReady(): void {
  const state = readBootState()
  const next: BootState = {
    ...state,
    lastCleanShutdown: true,
    consecutiveFailures: 0,
    failuresAfterUpdate: 0,
    pendingUpgrade:
      state.pendingUpgrade && state.pendingUpgrade === state.appVersion
        ? null
        : state.pendingUpgrade
  }
  writeBootState(next)
  log('bootstate', 'Boot ready, health flags cleared')
}

/** An unrecoverable startup failure happened; next boot will be counted as failed. */
export function markBootFailed(reason: string): void {
  const state = readBootState()
  writeBootState({ ...state, lastCleanShutdown: false })
  log('bootstate', `Boot failure recorded: ${reason}`)
}

/** A crash (uncaught exception / renderer gone / unresponsive) happened while running. */
export function markCrash(reason: string): void {
  const state = readBootState()
  writeBootState({ ...state, lastCleanShutdown: false })
  log('bootstate', `Crash recorded: ${reason}`)
}

/** An update was installed; used to detect "broken update" rollback scenarios. */
export function markUpdateApplied(version: string): void {
  const state = readBootState()
  writeBootState({
    ...state,
    lastUpdateAppliedVersion: version,
    failuresAfterUpdate: 0,
    pendingUpgrade: version
  })
  log('bootstate', `Update applied marked for version ${version}`)
}

export function setPendingUpgrade(version: string | null): void {
  const state = readBootState()
  writeBootState({ ...state, pendingUpgrade: version })
  log('bootstate', `Pending upgrade = ${version ?? '(none)'}`)
}

export function __resetBootStateForTests(baseDir: string | null): void {
  testUserDataDir = baseDir
}
