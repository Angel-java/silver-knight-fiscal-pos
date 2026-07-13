import { execFileSync } from 'child_process'
import { copyFileSync, existsSync, readdirSync, unlinkSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import { logger } from '../server/utils/logger'

export interface MigrationResult {
  success: boolean
  applied: number
  error?: string
  backupPath?: string
  integrityPreCheck: boolean
  integrityPostCheck: boolean
}

function getPrismaDir(): string {
  if (!app.isPackaged) {
    return join(process.cwd(), 'prisma')
  }
  return join(app.getAppPath(), 'prisma')
}

export async function runMigrations(dbPath: string): Promise<MigrationResult> {
  const backupPath = `${dbPath}.backup-${Date.now()}`
  let integrityPreCheck = false
  let integrityPostCheck = false

  logger.info('migrations', `Starting migration process for: ${dbPath}`)

  // 1. Backup
  if (existsSync(dbPath)) {
    try {
      copyFileSync(dbPath, backupPath)
      logger.info('migrations', `Backup created: ${backupPath}`)
    } catch (err) {
      logger.error('migrations', `Backup failed: ${err}`)
      return {
        success: false,
        applied: 0,
        error: `Backup failed: ${err}`,
        integrityPreCheck: false,
        integrityPostCheck: false
      }
    }
  }

  try {
    // 2. Pre-migration integrity check
    integrityPreCheck = await checkIntegrity(dbPath)
    if (!integrityPreCheck) {
      logger.error('migrations', 'Pre-migration integrity check FAILED')
      return {
        success: false,
        applied: 0,
        error: 'Database integrity check failed before migration. The database may be corrupted.',
        backupPath,
        integrityPreCheck: false,
        integrityPostCheck: false
      }
    }
    logger.info('migrations', 'Pre-migration integrity check passed')

    // 3. Run prisma migrate deploy
    const schemaPath = join(getPrismaDir(), 'schema.prisma')
    const prismaDir = getPrismaDir()

    logger.info('migrations', `Running prisma migrate deploy from: ${prismaDir}`)

    execFileSync(process.execPath, [
      join('node_modules', 'prisma', 'build', 'index.js'),
      'migrate',
      'deploy',
      '--schema',
      schemaPath
    ], {
      cwd: prismaDir,
      env: {
        ...process.env,
        DATABASE_URL: `file:${dbPath}`
      },
      timeout: 30_000,
      stdio: 'pipe'
    })

    logger.info('migrations', 'prisma migrate deploy completed successfully')

    // 4. Post-migration integrity check
    integrityPostCheck = await checkIntegrity(dbPath)
    if (!integrityPostCheck) {
      logger.error('migrations', 'Post-migration integrity check FAILED — restoring backup')
      if (existsSync(backupPath)) {
        copyFileSync(backupPath, dbPath)
        logger.info('migrations', 'Backup restored successfully')
      }
      return {
        success: false,
        applied: 0,
        error: 'Integrity check failed after migration. Database restored from backup.',
        backupPath,
        integrityPreCheck: true,
        integrityPostCheck: false
      }
    }
    logger.info('migrations', 'Post-migration integrity check passed')

    // 5. Clean old backups (keep last 3)
    cleanOldBackups(dbPath)

    return {
      success: true,
      applied: 1,
      backupPath,
      integrityPreCheck: true,
      integrityPostCheck: true
    }
  } catch (err) {
    logger.error('migrations', `Migration error: ${err}`)

    // Restore backup on any error
    if (existsSync(backupPath)) {
      try {
        copyFileSync(backupPath, dbPath)
        logger.info('migrations', 'Backup restored after migration error')
      } catch (restoreErr) {
        logger.error('migrations', `Failed to restore backup: ${restoreErr}`)
      }
    }

    return {
      success: false,
      applied: 0,
      error: String(err),
      backupPath,
      integrityPreCheck,
      integrityPostCheck: false
    }
  }
}

async function checkIntegrity(dbPath: string): Promise<boolean> {
  if (!existsSync(dbPath)) {
    // New database, no integrity check needed
    return true
  }

  try {
    // Use require() to load better-sqlite3 — it's a native module
    // that must be available at runtime
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3')
    const db = new Database(dbPath, { readonly: true })
    const result = db.pragma('integrity_check')
    db.close()

    const isOk = result && result[0] && result[0].integrity_check === 'ok'
    if (!isOk) {
      logger.error('migrations', `Integrity check result: ${JSON.stringify(result)}`)
    }
    return isOk
  } catch (err) {
    logger.error('migrations', `Integrity check error: ${err}`)
    return false
  }
}

function cleanOldBackups(dbPath: string): void {
  try {
    const dir = dirname(dbPath)
    const baseName = dbPath.split('/').pop() || 'dev.db'
    const prefix = `${baseName}.backup-`

    const backups = readdirSync(dir)
      .filter((f) => f.startsWith(prefix))
      .map((f) => ({
        name: f,
        time: statSync(join(dir, f)).mtimeMs
      }))
      .sort((a, b) => b.time - a.time)

    // Keep only the 3 most recent backups
    for (const backup of backups.slice(3)) {
      unlinkSync(join(dir, backup.name))
      logger.info('migrations', `Cleaned old backup: ${backup.name}`)
    }
  } catch (err) {
    logger.error('migrations', `Backup cleanup error: ${err}`)
  }
}
