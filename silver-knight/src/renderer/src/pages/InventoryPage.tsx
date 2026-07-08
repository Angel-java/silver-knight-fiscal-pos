import { type JSX } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

const tabs = [
  { label: 'Productos', path: '/inventory' },
  { label: 'Movimientos', path: '/inventory/entries' }
]

export default function InventoryPage(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 py-4 pr-2 text-lg">
            ←
          </button>
          <h1 className="font-bold text-gray-800 text-lg py-4">Inventario</h1>
          <nav className="flex gap-1 ml-4">
            {tabs.map((t) => (
              <button
                key={t.path}
                onClick={() => navigate(t.path)}
                className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                  location.pathname === t.path
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
      <div className="max-w-7xl mx-auto">
        <Outlet />
      </div>
    </div>
  )
}
