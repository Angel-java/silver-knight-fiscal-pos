import { createServer } from './index'
import { SERVER_PORT } from './config'
import { logger } from './utils/logger'
import { prisma } from './database/prisma'

async function main(): Promise<void> {
  const app = await createServer()

  const server = app.listen(SERVER_PORT, '0.0.0.0', () => {
    logger.info('server', `Server running on http://0.0.0.0:${SERVER_PORT}`)
  })

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('server', `Received ${signal}, shutting down...`)
    server.close()
    await prisma.$disconnect()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((err) => {
  logger.error('server', `Failed to start: ${err}`)
  process.exit(1)
})
