import express, { Request, Response } from 'express'
import cors from 'cors'
import { prisma } from '../database/prisma'
import authRoutes from './routes/auth'
import categoriesRoutes from './routes/categories'
import productsRoutes from './routes/products'
import exchangeRatesRoutes from './routes/exchangeRates'
import settingsRoutes from './routes/settings'
import invoicesRoutes from './routes/invoices'
import dashboardRoutes from './routes/dashboard'
import customersRoutes from './routes/customers'
import fiscalControlRoutes from './routes/fiscalControl'
import ivaBooksRoutes from './routes/ivaBooks'
import reportsRoutes from './routes/reports'
import usersRoutes from './routes/users'
import printRoutes from './routes/print'
import { startBcvScheduler } from './scheduler'

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
  app.use('/api/invoices', invoicesRoutes)
  app.use('/api/dashboard', dashboardRoutes)
  app.use('/api/customers', customersRoutes)
  app.use('/api/fiscal-control', fiscalControlRoutes)
  app.use('/api/iva', ivaBooksRoutes)
  app.use('/api/reports', reportsRoutes)
  app.use('/api/users', usersRoutes)
  app.use('/api/print', printRoutes)

  startBcvScheduler()

  return app
}
