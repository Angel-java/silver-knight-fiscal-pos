import { type JSX } from 'react'
import type { CartItem } from './types'

interface CartPanelProps {
  cart: CartItem[]
  exchangeRate: number
  subtotalUsd: number
  subtotalVes: number
  ivaUsd: number
  ivaVes: number
  customer: { id: string; name: string; rif?: string | null } | null
  onUpdateQty: (productId: string, qty: number) => void
  onOpenCustomerModal: () => void
  onOpenPayment: () => void
}

export default function CartPanel({
  cart,
  exchangeRate,
  subtotalUsd,
  subtotalVes,
  ivaUsd,
  ivaVes,
  customer,
  onUpdateQty,
  onOpenCustomerModal,
  onOpenPayment
}: CartPanelProps): JSX.Element {
  const unitPriceVes = (item: CartItem): number => item.unitPriceUsd * exchangeRate
  const formatVes = (value: number): string =>
    exchangeRate > 0 ? value.toFixed(2) : '—'
  return (
    <div className="w-full lg:w-80 xl:w-96 bg-white shadow-lg flex flex-col lg:border-l max-h-[45vh] lg:max-h-none border-t lg:border-t-0">
      <div className="p-3 sm:p-4 border-b shrink-0">
        <h2 className="font-bold text-gray-800 mb-3">Carrito</h2>
        <button
          onClick={onOpenCustomerModal}
          className="w-full text-left px-3 py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:border-primary hover:text-primary transition-colors"
        >
          {customer
            ? `${customer.name}${customer.rif ? ` — ${customer.rif}` : ''}`
            : '+ Agregar cliente'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {cart.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">Carrito vacío</p>
        )}
        {cart.map((item) => (
          <div key={item.productId} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 line-clamp-2">{item.productName}</p>
              <p className="text-xs text-gray-500">
                ${item.unitPriceUsd.toFixed(2)}{' '}
                <span className="text-gray-400">/ Bs.{formatVes(unitPriceVes(item))} c/u</span>
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdateQty(item.productId, item.quantity - 1)}
                className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 text-gray-600 font-bold text-sm"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
              <button
                onClick={() => onUpdateQty(item.productId, item.quantity + 1)}
                className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 text-gray-600 font-bold text-sm"
              >
                +
              </button>
            </div>
            <div className="text-right text-sm font-bold text-gray-800 shrink-0">
              <p>${(item.unitPriceUsd * item.quantity).toFixed(2)}</p>
              <p className="text-xs font-medium text-gray-500">
                Bs.{formatVes(unitPriceVes(item) * item.quantity)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t p-3 sm:p-4 space-y-2 shrink-0">
        <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
          <span className="font-medium">Tasa (Bs./USD)</span>
          {exchangeRate > 0 ? (
            <span className="font-bold text-gray-700">Bs. {exchangeRate.toFixed(2)}</span>
          ) : (
            <span className="text-yellow-600 font-semibold">Sin tasa registrada</span>
          )}
        </div>
        <div className="flex justify-between text-sm text-gray-500">
          <span>Subtotal</span>
          <span className="text-right">
            ${subtotalUsd.toFixed(2)}
            <span className="text-gray-400"> · Bs.{formatVes(subtotalVes)}</span>
          </span>
        </div>
        <div className="flex justify-between text-sm text-gray-500">
          <span>IVA</span>
          <span className="text-right">
            ${ivaUsd.toFixed(2)}
            <span className="text-gray-400"> · Bs.{formatVes(ivaVes)}</span>
          </span>
        </div>
        <div className="flex flex-col items-end text-lg font-bold text-gray-800 border-t pt-2">
          <span>Total</span>
          <span className="text-right">
            ${(subtotalUsd + ivaUsd).toFixed(2)} · Bs.
            {formatVes(subtotalVes + ivaVes)}
          </span>
        </div>
        <button
          onClick={onOpenPayment}
          disabled={cart.length === 0}
          className="w-full py-2 sm:py-3 bg-primary text-white rounded-lg font-bold text-base sm:text-lg hover:bg-primary-dark disabled:opacity-50 transition-colors mt-2"
        >
          Cobrar
        </button>
      </div>
    </div>
  )
}
