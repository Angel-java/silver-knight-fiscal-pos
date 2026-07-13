import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'

export function resolveDbPath(): string {
  if (!app.isPackaged) {
    return join(process.cwd(), 'prisma', 'dev.db')
  }

  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'silver-knight')
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }
  return join(dbDir, 'dev.db')
}

export function getDbUrl(): string {
  return `file:${resolveDbPath()}`
}
