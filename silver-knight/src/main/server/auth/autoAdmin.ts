import bcrypt from 'bcryptjs'
import { prisma } from '../../database/prisma'

const ALL_PERMISSIONS = [
  'dashboard',
  'pos',
  'products',
  'categories',
  'inventory',
  'inventory-entries',
  'customers',
  'invoices',
  'reports',
  'settings',
  'exchange-rates',
  'iva-books',
  'fiscal-control',
  'users'
]

export const ADMIN_USERNAME = process.env['ADMIN_USERNAME'] || 'admin'
const ADMIN_PIN = process.env['ADMIN_PIN'] || '0000'
const ADMIN_FULL_NAME = process.env['ADMIN_FULL_NAME'] || 'Administrador del Sistema'

export async function autoCreateAdmin(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { username: ADMIN_USERNAME } })
  if (existing) return

  const hashedPin = await bcrypt.hash(ADMIN_PIN, 10)
  await prisma.user.create({
    data: {
      username: ADMIN_USERNAME,
      fullName: ADMIN_FULL_NAME,
      pin: hashedPin,
      role: 'admin',
      permissions: JSON.stringify(ALL_PERMISSIONS)
    }
  })
}
