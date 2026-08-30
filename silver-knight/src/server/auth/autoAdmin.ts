import bcrypt from 'bcryptjs'
import { prisma } from '../database/prisma'

export const ROOT_USERNAME = process.env['ROOT_USERNAME'] || 'admin'
const ROOT_PIN = process.env['ROOT_PIN']
const ROOT_FULL_NAME = process.env['ROOT_FULL_NAME'] || 'Dueño del Sistema'

// El .env (ROOT_USERNAME / ROOT_PIN) es la fuente de verdad de la identidad del root.
// Este bloque se ejecuta en cada arranque y RECONCILIA la BD con el .env (no solo crea).
// Evita el drift de credenciales: si se cambia ROOT_PIN en el .env, la BD se actualiza sola.
export async function autoCreateRoot(): Promise<void> {
  if (!ROOT_PIN) {
    console.warn('[autoAdmin] ROOT_PIN no configurado — admin root no creado. Ejecuta "npm run setup"')
    return
  }

  const hashedPin = await bcrypt.hash(ROOT_PIN, 10)

  const byName = await prisma.user.findUnique({ where: { username: ROOT_USERNAME } })
  if (byName) {
    const pinMatches = await bcrypt.compare(ROOT_PIN, byName.pin)
    if (!pinMatches || byName.role !== 'root') {
      await prisma.user.update({
        where: { id: byName.id },
        data: { pin: hashedPin, role: 'root' }
      })
      console.log(`[autoAdmin] Root "${ROOT_USERNAME}" reconciliado con el PIN/rol de ROOT_PIN`)
    }
    return
  }

  const legacyRoot = await prisma.user.findFirst({ where: { role: 'root' } })
  if (legacyRoot) {
    await prisma.user.update({
      where: { id: legacyRoot.id },
      data: { username: ROOT_USERNAME, pin: hashedPin, fullName: ROOT_FULL_NAME }
    })
    console.log(`[autoAdmin] Root renombrado de "${legacyRoot.username}" a "${ROOT_USERNAME}" y PIN actualizado`)
    return
  }

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