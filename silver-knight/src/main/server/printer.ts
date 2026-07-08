import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { prisma } from '../database/prisma'
import { parsePayments } from './utils/payments'

const execAsync = promisify(exec)

const ESC = '\x1b'
const GS = '\x1d'

const CMD = {
  init: `${ESC}@`,
  center: `${ESC}a\x01`,
  left: `${ESC}a\x00`,
  boldOn: `${ESC}E\x01`,
  boldOff: `${ESC}E\x00`,
  doubleOn: `${ESC}!0\x10`,
  normal: `${ESC}!\x00`,
  feed: (n: number) => `${ESC}d${String.fromCharCode(n)}\x00`,
  cut: `${GS}V\x00`,
  cutPartial: `${GS}V\x01`
}

const CHARS_PER_LINE = 40

function padLeft(text: string, width = CHARS_PER_LINE): string {
  const len = text.length
  if (len >= width) return text
  return ' '.repeat(width - len) + text
}

function padRight(text: string, width = CHARS_PER_LINE): string {
  const len = text.length
  if (len >= width) return text.substring(0, width)
  return text + ' '.repeat(width - len)
}

function line(char = '-', width = CHARS_PER_LINE): string {
  return char.repeat(width)
}

function wrapLine(left: string, right: string, width = CHARS_PER_LINE): string {
  const available = width - right.length - 1
  const leftPart = left.length > available ? left.substring(0, available - 1) + '…' : left
  return padRight(leftPart, available + 1) + right
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === 'USD') return `$${amount.toFixed(2)}`
  return `Bs.${amount.toFixed(2)}`
}

interface PrintInvoiceData {
  invoiceNumber: string
  documentType: string
  controlNumber: string | null
  companyName: string
  companyRif: string
  companyAddress: string | null
  companyPhone: string | null
  customerName: string
  customerRif: string | null
  createdAt: string
  currency: string
  exchangeRate: number
  items: Array<{
    productName: string
    quantity: number
    unitPriceUsd: number
    unitPriceVes: number
    ivaRate: number
    totalUsd: number
    totalVes: number
  }>
  totalUsd: number
  totalVes: number
  ivaUsd: number
  ivaVes: number
  payments: Array<{ method: string; amount: number; currency: string }>
  cancelReason: string | null
}

export function buildThermalTicket(data: PrintInvoiceData): string {
  const c = data.currency
  const isUsd = c === 'USD'
  const subtotal = isUsd ? data.totalUsd : data.totalVes
  const iva = isUsd ? data.ivaUsd : data.ivaVes
  const total = subtotal + iva

  const docLabel: Record<string, string> = {
    FACT: 'FACTURA',
    NCR: 'NOTA DE CRÉDITO',
    NDB: 'NOTA DE DÉBITO'
  }
  const payLabels: Record<string, string> = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
    card: 'Punto de Venta'
  }

  let ticket = CMD.init
  ticket += CMD.center + CMD.boldOn + CMD.doubleOn
  ticket += data.companyName + '\n'
  ticket += CMD.normal + CMD.center + CMD.boldOn
  ticket += `RIF: ${data.companyRif}\n`
  ticket += CMD.normal + CMD.center
  if (data.companyAddress) ticket += `${data.companyAddress}\n`
  if (data.companyPhone) ticket += `Telf: ${data.companyPhone}\n`

  ticket += line('=') + '\n'
  ticket += CMD.center + CMD.boldOn + CMD.doubleOn
  ticket += `${docLabel[data.documentType] || 'FACTURA'}\n`
  ticket += CMD.normal + CMD.center
  ticket += `Nº ${data.invoiceNumber}\n`
  if (data.controlNumber) {
    ticket += `CF: ${data.controlNumber}\n`
  }
  ticket += line('-') + '\n'
  ticket += CMD.left
  ticket += `${data.createdAt}\n`
  ticket += `Cliente: ${data.customerName}\n`
  if (data.customerRif) ticket += `RIF: ${data.customerRif}\n`

  if (data.cancelReason) {
    ticket += line('=') + '\n'
    ticket += CMD.center + CMD.boldOn
    ticket += `*** ANULADA ***\n`
    ticket += CMD.normal + CMD.left
    ticket += `Motivo: ${data.cancelReason}\n`
  }

  ticket += line('=') + '\n'
  ticket += `${padRight('CANT')}${padRight('DESCRIPCIÓN', 20)}${padLeft('TOTAL', 12)}\n`
  ticket += line('-') + '\n'

  for (const item of data.items) {
    ticket += `${String(item.quantity).padEnd(4)} ${item.productName.substring(0, 19).padEnd(20)}`
    ticket += `${padLeft(formatCurrency(isUsd ? item.totalUsd : item.totalVes, c), 12)}\n`
  }

  ticket += line('-') + '\n'
  ticket += wrapLine('Subtotal:', formatCurrency(subtotal, c)) + '\n'
  ticket += wrapLine('IVA:', formatCurrency(iva, c)) + '\n'
  ticket += CMD.boldOn
  ticket += wrapLine('TOTAL:', formatCurrency(total, c)) + '\n'
  ticket += CMD.normal

  if (c === 'USD' && data.exchangeRate > 0) {
    ticket += wrapLine('Tasa BCV:', `Bs.${data.exchangeRate.toFixed(2)}`) + '\n'
    ticket +=
      wrapLine('Total en Bs.:', `Bs.${(total * data.exchangeRate).toFixed(2)}`) + '\n'
  } else if (c === 'VES' && data.exchangeRate > 0) {
    ticket += wrapLine('Tasa BCV:', `Bs.${data.exchangeRate.toFixed(2)}`) + '\n'
    ticket += wrapLine('Total en USD:', `$${(total / data.exchangeRate).toFixed(2)}`) + '\n'
  }

  if (data.payments.length > 0) {
    ticket += line('=') + '\n'
    ticket += CMD.center + 'MÉTODOS DE PAGO\n' + CMD.left
    for (const p of data.payments) {
      ticket +=
        wrapLine(payLabels[p.method] || p.method, formatCurrency(p.amount, p.currency)) + '\n'
    }
  }

  ticket += line('=') + '\n'
  ticket += CMD.center
  ticket += 'Gracias por su compra\n'
  ticket += 'www.silverknight.app\n'
  ticket += CMD.feed(3)
  ticket += CMD.cut

  return ticket
}

export async function getAvailablePrinters(): Promise<string[]> {
  try {
    const { stdout } = await execAsync('lpstat -p 2>/dev/null || echo ""')
    const printers: string[] = []
    for (const line of stdout.split('\n')) {
      const m = line.match(/^printer\s+(\S+)\s+/)
      if (m) printers.push(m[1])
    }
    return printers
  } catch {
    return []
  }
}

export async function printRaw(printerName: string, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const lp = spawn('lp', ['-d', printerName, '-o', 'raw'], { stdio: ['pipe', 'ignore', 'pipe'] })
    lp.stdin.write(data)
    lp.stdin.end()
    lp.on('error', reject)
    lp.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`lp exited with code ${code}`))
    })
  })
}

export async function printInvoice(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true, customer: true }
  })
  if (!invoice) throw new Error('Factura no encontrada')

  const company = await prisma.company.findFirst()
  if (!company) throw new Error('Empresa no configurada')

  const settingRows = await prisma.setting.findMany({ where: { key: 'printerName' } })
  const printerName = settingRows[0]?.value
  if (!printerName) throw new Error('No hay impresora configurada. Configúrala en Ajustes.')

  const payments = parsePayments(invoice.payments)

  const printData: PrintInvoiceData = {
    invoiceNumber: invoice.number,
    documentType: invoice.documentType,
    controlNumber: invoice.controlNumber,
    companyName: company.name,
    companyRif: company.rif,
    companyAddress: company.address,
    companyPhone: company.phone,
    customerName: invoice.customer?.name || 'Consumidor Final',
    customerRif: invoice.customer?.rif || null,
    createdAt: new Date(invoice.createdAt).toLocaleString('es-VE'),
    currency: invoice.currency,
    exchangeRate: invoice.exchangeRate,
    items: invoice.items.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      unitPriceUsd: i.unitPriceUsd,
      unitPriceVes: i.unitPriceVes,
      ivaRate: i.ivaRate,
      totalUsd: i.totalUsd,
      totalVes: i.totalVes
    })),
    totalUsd: invoice.totalUsd,
    totalVes: invoice.totalVes,
    ivaUsd: invoice.ivaUsd,
    ivaVes: invoice.ivaVes,
    payments,
    cancelReason: invoice.cancelReason
  }

  const ticket = buildThermalTicket(printData)
  await printRaw(printerName, ticket)
}
