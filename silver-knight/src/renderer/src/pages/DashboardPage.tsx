import { useState, useEffect, useMemo } from 'react'
import type { JSX, ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { api, type PermissionModule } from '../lib/api'
import UpdateNotification from '../components/UpdateNotification'

const icons: Record<string, ReactElement> = {
  pos: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-8 h-8"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  products: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-8 h-8"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  customers: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-8 h-8"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  reports: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-8 h-8"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  users: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-8 h-8"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  migration: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-8 h-8"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  settings: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-8 h-8"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

interface MenuItem {
  label: string
  key: string
  path: string
  module: PermissionModule
}

const allMenuItems: MenuItem[] = [
  { label: 'POS', key: 'pos', path: '/pos', module: 'pos' },
  { label: 'Inventario', key: 'products', path: '/inventory', module: 'inventory' },
  { label: 'Clientes', key: 'customers', path: '/customers', module: 'customers' },
  { label: 'Reportes', key: 'reports', path: '/reports', module: 'reports' },
  { label: 'Usuarios', key: 'users', path: '/users', module: 'users' },
  { label: 'Configuración', key: 'settings', path: '/settings', module: 'settings' }
]

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  gerente: 'Gerente',
  operador: 'Operador'
}

export default function DashboardPage(): JSX.Element {
  const { user, company, logout, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [summary, setSummary] = useState<{
    invoicesCount: number
    totalUsd: number
    totalVes: number
    productsSold: number
  } | null>(null)

  useEffect(() => {
    api.dashboard
      .summary()
      .then((r) => setSummary(r.summary))
      .catch(() => {})
  }, [])

  const menuItems = useMemo(
    () =>
      allMenuItems.filter((item) => hasPermission(item.module)),
    [hasPermission]
  )

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white font-bold">SK</span>
            </div>
            <button onClick={() => navigate('/')} className="text-left">
              <h1 className="font-bold text-gray-800">{company?.name || 'Silver Knight'}</h1>
              <p className="text-xs text-gray-500">{company?.rif}</p>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.fullName || user?.username}{' '}
              <span className="text-xs text-gray-400">
                ({roleLabels[user?.role || ''] || user?.role})
              </span>
            </span>
            <button onClick={logout} className="text-sm text-red-600 hover:text-red-800">
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="bg-white rounded-lg shadow p-6 flex flex-col items-center gap-2 hover:shadow-md transition-shadow"
            >
              <span className="text-3xl text-gray-600">{icons[item.key]}</span>
              <span className="font-medium text-gray-700">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="font-bold text-gray-800 mb-4">Resumen del día</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600 font-medium">Ventas hoy</p>
              <p className="text-2xl font-bold text-blue-800">
                ${summary ? summary.totalUsd.toFixed(2) : '0.00'}
              </p>
              {summary && summary.totalVes > 0 && (
                <p className="text-xs text-blue-500 mt-1">Bs. {summary.totalVes.toFixed(2)}</p>
              )}
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-600 font-medium">Productos vendidos</p>
              <p className="text-2xl font-bold text-green-800">
                {summary ? summary.productsSold : 0}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-purple-600 font-medium">Facturas hoy</p>
              <p className="text-2xl font-bold text-purple-800">
                {summary ? summary.invoicesCount : 0}
              </p>
            </div>
          </div>
        </div>
      </div>
      <UpdateNotification />
    </div>
  )
}
