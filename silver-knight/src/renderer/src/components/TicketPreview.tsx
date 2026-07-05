import type { JSX } from 'react'
import type { Invoice } from '../lib/api'

const DOC_LABELS: Record<string, string> = {
  FACT: 'Factura',
  NCR: 'Nota de Crédito',
  NDB: 'Nota de Débito'
}

const PAY_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Punto de Venta'
}

interface TicketPreviewProps {
  invoice: Invoice
}

export default function TicketPreview({ invoice }: TicketPreviewProps): JSX.Element {
  const c = invoice.currency
  const isUsd = c === 'USD'
  const total = isUsd ? invoice.totalUsd : invoice.totalVes
  const iva = isUsd ? invoice.ivaUsd : invoice.ivaVes
  const subtotal = total - iva

  let payments: Array<{ method: string; amount: number; currency: string }> = []
  try {
    if (invoice.payments) payments = JSON.parse(invoice.payments)
  } catch {
    /* */
  }

  return (
    <div
      style={{
        fontFamily: "'Courier New', monospace",
        fontSize: '12px',
        lineHeight: '1.3',
        width: '300px',
        margin: '0 auto',
        background: '#fff',
        padding: '16px',
        border: '1px solid #ddd'
      }}
    >
      <div style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold' }}>
        {invoice.customer?.name || 'Empresa'}
      </div>
      <div style={{ textAlign: 'center' }}>
        {DOC_LABELS[invoice.documentType] || 'FACTURA'} Nº {invoice.number}
      </div>
      <div style={{ textAlign: 'center' }}>
        {new Date(invoice.createdAt).toLocaleString('es-VE')}
      </div>
      {invoice.controlNumber && <div>CF: {invoice.controlNumber}</div>}
      <div>Cliente: {invoice.customer?.name || 'Consumidor Final'}</div>
      {invoice.customer?.rif && <div>RIF: {invoice.customer.rif}</div>}
      {invoice.cancelReason && (
        <div style={{ color: 'red', fontWeight: 'bold', textAlign: 'center' }}>
          *** ANULADA: {invoice.cancelReason} ***
        </div>
      )}
      <div>{'='.repeat(40)}</div>

      <div>
        {'CANT'.padEnd(5)}
        {'DESCRIPCIÓN'.padEnd(20)}
        {'TOTAL'.padStart(15)}
      </div>
      <div>{'-'.repeat(40)}</div>
      {invoice.items.map((item, i) => {
        const amt = isUsd ? item.totalUsd : item.totalVes
        const amtStr = isUsd ? `$${amt.toFixed(2)}` : `Bs.${amt.toFixed(2)}`
        return (
          <div key={i}>
            {String(item.quantity).padEnd(5)}
            {item.productName.substring(0, 19).padEnd(20)}
            {amtStr.padStart(15)}
          </div>
        )
      })}
      <div>{'-'.repeat(40)}</div>
      <div>
        {'Subtotal:'.padEnd(32)}
        {isUsd ? `$${subtotal.toFixed(2)}` : `Bs.${subtotal.toFixed(2)}`}
      </div>
      <div>
        {'IVA:'.padEnd(32)}
        {isUsd ? `$${iva.toFixed(2)}` : `Bs.${iva.toFixed(2)}`}
      </div>
      <div style={{ fontWeight: 'bold' }}>
        {'Total:'.padEnd(32)}
        {isUsd ? `$${total.toFixed(2)}` : `Bs.${total.toFixed(2)}`}
      </div>

      {isUsd && invoice.exchangeRate > 0 && (
        <>
          <div>
            {'Tasa BCV:'.padEnd(10)} Bs.{invoice.exchangeRate.toFixed(2)}
          </div>
          <div>
            {'Total en Bs.:'.padEnd(10)} Bs.{(invoice.totalUsd * invoice.exchangeRate).toFixed(2)}
          </div>
        </>
      )}
      {!isUsd && invoice.exchangeRate > 0 && (
        <>
          <div>
            {'Tasa BCV:'.padEnd(10)} Bs.{invoice.exchangeRate.toFixed(2)}
          </div>
          <div>
            {'Total en USD:'.padEnd(10)} ${(invoice.totalVes / invoice.exchangeRate).toFixed(2)}
          </div>
        </>
      )}

      {payments.length > 0 && (
        <>
          <div>{'='.repeat(40)}</div>
          <div>MÉTODOS DE PAGO</div>
          {payments.map((p, i) => (
            <div key={i}>
              {`${PAY_LABELS[p.method] || p.method}:`.padEnd(22)}
              {p.currency === 'USD' ? `$${p.amount.toFixed(2)}` : `Bs.${p.amount.toFixed(2)}`}
            </div>
          ))}
        </>
      )}

      <div>{'='.repeat(40)}</div>
      <div style={{ textAlign: 'center' }}>Gracias por su compra</div>
    </div>
  )
}
