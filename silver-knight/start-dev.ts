import EmbeddedPostgres from 'embedded-postgres'
import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const PG_PORT = 55432
const PG_USER = 'silverknight'
const PG_PASSWORD = 'skpass'
const PG_DB = 'silverknight'
const PG_DATA = join(process.cwd(), '.pgdata')

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
