import express, { Request, Response } from 'express'
import cors from 'cors'
import { prisma } from '../database/prisma'

export function createServer(): ReturnType<typeof express> {
  const app = express()

  app.use(cors())
  app.use(express.json())

  app.get('/api/health', async (_req: Request, res: Response) => {
    const companyCount = await prisma.company.count()
    res.json({ ok: true, service: 'silver-knight-api', companyCount })
  })

  return app
}
