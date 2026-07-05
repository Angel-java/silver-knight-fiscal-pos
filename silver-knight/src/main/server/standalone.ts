import { createServer } from './index'

const PORT = parseInt(process.env['PORT'] || '3001', 10)

async function main(): Promise<void> {
  const app = await createServer()
  app.listen(PORT, () => {
    console.log(`[silver-knight] Server running on http://0.0.0.0:${PORT}`)
  })
}

main().catch((err) => {
  console.error('[silver-knight] Failed to start:', err)
  process.exit(1)
})
