import EmbeddedPostgres from 'embedded-postgres'
import { execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'

const PG_PORT = Number(process.env['POSTGRES_PORT']) || 55432
const PG_USER = process.env['POSTGRES_USER'] || 'silverknight'
const PG_PASSWORD = process.env['POSTGRES_PASSWORD'] || loadPasswordFromEnv()
const PG_DB = process.env['POSTGRES_DB'] || 'silverknight'
const PG_DATA = join(process.cwd(), '.pgdata')

function loadPasswordFromEnv(): string {
  try {
    const envPath = join(process.cwd(), '.env')
    if (!existsSync(envPath)) return 'CHANGEME'
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex).trim()
      if (key === 'POSTGRES_PASSWORD') {
        let value = trimmed.slice(eqIndex + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        return value
      }
    }
  } catch {
    // ignore
  }
  return 'CHANGEME'
}

async function main(): Promise<void> {
  console.log('[1/4] Starting embedded PostgreSQL...')
  const isNew = !existsSync(PG_DATA)
  if (isNew) mkdirSync(PG_DATA, { recursive: true })

  const pg = new EmbeddedPostgres({
    databaseDir: PG_DATA,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    listen: '127.0.0.1'
  })

  if (isNew) {
    await pg.initialise()
  }
  await pg.start()
  console.log('[1/4] PostgreSQL running on port ' + PG_PORT)

  try {
    await pg.createDatabase(PG_DB)
    console.log('[2/4] Database created')
  } catch {
    console.log('[2/4] Database already exists')
  }

  const dbUrl = `postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${PG_DB}?schema=public`

  console.log('[3/4] Pushing Prisma schema...')
  execSync(`npx prisma db push --accept-data-loss`, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: dbUrl }
  })
  console.log('[3/4] Schema synced')

  console.log('[4/4] Starting Express server...')
  process.env.DATABASE_URL = dbUrl
  process.env.PORT = '3001'
  process.env.NODE_ENV = 'development'

  const mod = await import('./src/server/index.js')
  const app = await mod.createServer()
  const server = app.listen(3001, '127.0.0.1', () => {
    console.log('')
    console.log('========================================')
    console.log('  Silver Knight Server - RUNNING')
    console.log('  http://127.0.0.1:3001/api/health')
    console.log('========================================')
    console.log('')
  })

  process.on('SIGINT', async () => {
    server.close()
    await pg.stop()
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    server.close()
    await pg.stop()
    process.exit(0)
  })
}

main().catch(async (err) => {
  console.error('[FATAL]', err.message || err)
  process.exit(1)
})
