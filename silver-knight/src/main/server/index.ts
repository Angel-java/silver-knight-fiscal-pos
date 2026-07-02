import express, { Request, Response } from 'express'
import cors from 'cors'
import { prisma } from '../database/prisma'
import authRoutes from './routes/auth'
import categoriesRoutes from './routes/categories'
import productsRoutes from './routes/products'
import exchangeRatesRoutes from './routes/exchangeRates'
import settingsRoutes from './routes/settings'

export function createServer(): ReturnType<typeof express> {
  const app = express()

  app.use(cors())
  app.use(express.json())

  app.get('/api/health', async (_req: Request, res: Response) => {
    const companyCount = await prisma.company.count()
    res.json({ ok: true, service: 'silver-knight-api', companyCount })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/categories', categoriesRoutes)
  app.use('/api/products', productsRoutes)
  app.use('/api/exchange-rates', exchangeRatesRoutes)
  app.use('/api/settings', settingsRoutes)

  return app
}
