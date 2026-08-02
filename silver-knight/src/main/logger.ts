import { app } from 'electron'
import { appendFile, appendFileSync, mkdirSync, existsSync, statSync, renameSync, unlinkSync } from 'fs'
import { join } from 'path'

const MAX_LOG_SIZE = 5 * 1024 * 1024
const MAX_LOG_FILES = 3
const FLUSH_INTERVAL_MS = 1000
const FLUSH_BATCH = 50
const SIZE_CHECK_EVERY = 500

let logPath: string | null = null
let queue: Promise<void> = Promise.resolve()
let pendingLines: string[] = []
let flushTimer: NodeJS.Timeout | null = null
let linesSinceSizeCheck = 0

function getLogPath(): string {
  if (logPath) return logPath
  try {
    const dir = join(app.getPath('userData'), 'logs')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    logPath = join(dir, 'main.log')
  } catch {
    logPath = join(process.cwd(), 'main.log')
  }
  return logPath
}

function rotateIfNeeded(): void {
  const file = getLogPath()
  try {
    if (!existsSync(file)) return
    if (statSync(file).size < MAX_LOG_SIZE) return
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const src = `${file}.${i}`
      const dst = `${file}.${i + 1}`
      try {
        if (existsSync(dst)) unlinkSync(dst)
      } catch {
        // ignore
      }
      if (existsSync(src)) {
        try {
          renameSync(src, dst)
        } catch {
          // ignore
        }
      }
    }
    try {
      renameSync(file, `${file}.1`)
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
}

function drain(): void {
  if (pendingLines.length === 0) return
  const lines = pendingLines
  pendingLines = []

  linesSinceSizeCheck += lines.length
  if (linesSinceSizeCheck >= SIZE_CHECK_EVERY) {
    linesSinceSizeCheck = 0
    rotateIfNeeded()
  }

  queue = queue.then(
    () =>
      new Promise<void>((resolve) => {
        appendFile(getLogPath(), lines.join(''), () => resolve())
      })
  )
}

export function writeLog(level: string, tag: string, message: string): void {
  const line = `[${new Date().toISOString()}] [${level}] [${tag}] ${message}\n`
  console.log(line.trimEnd())
  try {
    pendingLines.push(line)
    if (pendingLines.length >= FLUSH_BATCH) {
      drain()
    } else if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null
        drain()
      }, FLUSH_INTERVAL_MS)
    }
  } catch {
    // ignore
  }
}

export function flushLogs(): Promise<void> {
  drain()
  return queue.catch(() => undefined)
}

export function flushLogsSync(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (pendingLines.length === 0) return
  const lines = pendingLines
  pendingLines = []
  try {
    appendFileSync(getLogPath(), lines.join(''))
  } catch {
    // ignore
  }
}

export function log(tag: string, message: string): void {
  writeLog('INFO', tag, message)
}

export function logError(tag: string, message: string): void {
  writeLog('ERROR', tag, message)
}
