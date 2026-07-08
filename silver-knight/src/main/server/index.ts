import express, { Request, Response } from 'express'
import cors from 'cors'
import { prisma } from '../database/prisma'
import { errorHandler } from './middleware/errorHandler'
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
import puntoVentaRoutes from './routes/puntoVenta'
import syncRoutes from './routes/sync'
import inventoryEntriesRoutes from './routes/inventoryEntries'
import { ensureDefaultControl } from './routes/fiscalControl'
import { startBcvScheduler } from './scheduler'
import { syncService } from './syncService'

export { stopBcvScheduler } from './scheduler'

export async function createServer(): Promise<ReturnType<typeof express>> {
  const app = express()

  app.use(
    cors({
      origin: process.env['CORS_ORIGIN'] || true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    })
  )
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
  app.use('/api/punto-venta', puntoVentaRoutes)
  app.use('/api/inventory-entries', inventoryEntriesRoutes)
  app.use('/api/sync', syncRoutes)

  app.use(errorHandler)

  syncService.start()
  await startBcvScheduler()
  ensureDefaultControl()

  return app
}
