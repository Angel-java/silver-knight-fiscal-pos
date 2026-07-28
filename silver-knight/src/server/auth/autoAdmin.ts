import bcrypt from 'bcryptjs'
import { prisma } from '../database/prisma'

export const ROOT_USERNAME = process.env['ROOT_USERNAME'] || 'alucard'
const ROOT_PIN = process.env['ROOT_PIN']
const ROOT_FULL_NAME = process.env['ROOT_FULL_NAME'] || 'Dueño del Sistema'

export async function autoCreateRoot(): Promise<void> {
  if (!ROOT_PIN) {
    console.warn('[autoAdmin] ROOT_PIN no configurado — admin root no creado. Ejecuta "npm run setup"')
    return
  }

  const existing = await prisma.user.findUnique({ where: { username: ROOT_USERNAME } })
  if (existing) return

  const hashedPin = await bcrypt.hash(ROOT_PIN, 10)
  await prisma.user.create({
    data: {
      username: ROOT_USERNAME,
      fullName: ROOT_FULL_NAME,
      pin: hashedPin,
      role: 'root',
      permissions: null
    }
  })
}
