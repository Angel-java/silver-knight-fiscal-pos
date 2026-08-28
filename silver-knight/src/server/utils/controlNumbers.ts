import { prisma } from '../database/prisma'
import { AppError } from '../middleware/errorHandler'

const DEFAULT_CONTROLS = [
  { documentType: 'FACT', prefix: '0F' },
  { documentType: 'NCR', prefix: '0C' },
  { documentType: 'NDB', prefix: '0D' }
]

export async function ensureDefaultControl(): Promise<void> {
  for (const dc of DEFAULT_CONTROLS) {
    const exists = await prisma.fiscalControl.findFirst({
      where: { documentType: dc.documentType }
    })
    if (exists) continue
    await prisma.fiscalControl.create({
      data: {
        documentType: dc.documentType,
        resolution: 'INICIAL-DEV',
        prefix: dc.prefix,
        startNumber: 1,
        endNumber: 999999,
        currentNumber: 0,
        issuedAt: new Date()
      }
    })
  }
}

export async function nextControlNumber(
  documentType: string
): Promise<{ number: string; fiscalControlId: string }> {
  await ensureDefaultControl()

  return prisma.$transaction(async (tx) => {
    const control = await tx.fiscalControl.findFirst({
      where: { documentType, isActive: true }
    })
    if (!control) {
      throw new AppError(
        400,
        `No hay un control fiscal activo para ${documentType}. Configúralo en Ajustes > Control Fiscal.`
      )
    }

    const nextNum = control.currentNumber + 1
    if (nextNum > control.endNumber) {
      throw new AppError(
        400,
        `Rango de numeración agotado para ${documentType} (resolución ${control.resolution})`
      )
    }

    const cfNumber = `${control.prefix}${String(nextNum).padStart(10, '0')}`

    await tx.fiscalControl.update({
      where: { id: control.id },
      data: { currentNumber: nextNum }
    })

    return { number: cfNumber, fiscalControlId: control.id }
  })
}

export function buildInvoiceNumber(
  documentType: string,
  controlNumber: string
): string {
  const now = new Date()
  const seqPrefix = `F${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-`
  const docLabel = documentType === 'FACT' ? 'F' : documentType === 'NCR' ? 'NC' : 'ND'
  return `${docLabel}-${seqPrefix}${controlNumber.slice(-4)}`
}
