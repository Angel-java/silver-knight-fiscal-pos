import { app } from 'electron'
import { appendFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

function getLogPath(): string {
  try {
    const dir = join(app.getPath('userData'), 'logs')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return join(dir, 'main.log')
  } catch {
    return join(process.cwd(), 'main.log')
  }
}

export function writeLog(level: string, tag: string, message: string): void {
  const line = `[${new Date().toISOString()}] [${level}] [${tag}] ${message}\n`
  console.log(line.trimEnd())
  try {
    appendFileSync(getLogPath(), line)
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
