import { type JSX } from 'react'
import type { Product } from '../../lib/api'

interface ProductGridProps {
  products: Product[]
  search: string
  onSearchChange: (value: string) => void
  onAddToCart: (product: Product) => void
}

export default function ProductGrid({
  products,
  search,
  onSearchChange,
  onAddToCart
}: ProductGridProps): JSX.Element {
  return (
    <div className="flex-1 flex flex-col p-2 sm:p-4 overflow-hidden">
      <div className="flex gap-2 mb-3 sm:mb-4 shrink-0">
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar producto por nombre, código o código de barra..."
          className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base sm:text-lg"
          autoFocus
        />
      </div>

      <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 content-start">
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => onAddToCart(p)}
            disabled={p.stock <= 0}
            className={`bg-white rounded-lg shadow text-left hover:shadow-md transition-shadow border ${
              p.stock <= 0
                ? 'border-red-200 opacity-50 cursor-not-allowed'
                : 'border-transparent hover:border-primary/30'
            } p-2 sm:p-4`}
          >
            <p className="font-medium text-gray-800 truncate text-sm sm:text-base">{p.name}</p>
            <p className="text-base sm:text-lg font-bold text-primary mt-0.5 sm:mt-1">
              ${p.priceUsd.toFixed(2)}
            </p>
            <p className={`text-xs ${p.stock <= 0 ? 'text-red-500' : 'text-gray-400'}`}>
              {p.stock <= 0 ? 'Agotado' : `Stock: ${p.stock}`}
            </p>
          </button>
        ))}
        {products.length === 0 && (
          <p className="col-span-full text-center text-gray-400 py-8">
            Escribe para buscar productos
          </p>
        )}
      </div>
    </div>
  )
}
