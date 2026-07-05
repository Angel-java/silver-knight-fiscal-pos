export interface Payment {
  method: string
  amount: number
  currency: string
  approvalCode?: string
}

export function parsePayments(paymentsJson: string | null | undefined): Payment[] {
  if (!paymentsJson) return []
  try {
    const parsed = JSON.parse(paymentsJson)
    if (Array.isArray(parsed)) return parsed as Payment[]
    return []
  } catch {
    return []
  }
}

const PAY_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Punto de Venta'
}

export function paymentLabel(method: string): string {
  return PAY_LABELS[method] || method
}
