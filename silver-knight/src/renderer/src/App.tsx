import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from './contexts/useAuth'
import type { PermissionModule } from './lib/api'
import LoginPage from './pages/LoginPage'
import SetupWizardPage from './pages/SetupWizardPage'
import EnvSetupPage from './pages/EnvSetupPage'
import DashboardPage from './pages/DashboardPage'
import InventoryPage from './pages/InventoryPage'
import ProductsPage from './pages/ProductsPage'
import CategoriesPage from './pages/CategoriesPage'
import CustomersPage from './pages/CustomersPage'
import SettingsPage from './pages/SettingsPage'
import FiscalControlPage from './pages/FiscalControlPage'
import IvaBooksPage from './pages/IvaBooksPage'
import InventoryEntriesPage from './pages/InventoryEntriesPage'
import ReportsPage from './pages/ReportsPage'
import UsersPage from './pages/UsersPage'
import POSPage from './pages/POSPage'
import InvoiceViewPage from './pages/InvoiceViewPage'
import SuppliersPage from './pages/SuppliersPage'
import DataMigrationPage from './pages/DataMigrationPage'

const rlog = (tag: string, msg: string): void => {
  try { window.electron?.send('renderer-log', 'INFO', tag, msg) } catch {}
}

function ProtectedRoute({
  children,
  module
}: {
  children: React.ReactNode
  module: PermissionModule
}): React.ReactElement {
  const { user, hasPermission } = useAuth()

  if (!user) return <Navigate to="/" replace />
  if (!hasPermission(module)) return <Navigate to="/" replace />
  return <>{children}</>
}

function App(): React.JSX.Element {
  const { user, company, loading } = useAuth()
  const [envReady, setEnvReady] = useState<boolean | null>(null)

  useEffect(() => {
    window.api.config.exists().then((exists) => {
      setEnvReady(exists)
    }).catch(() => {
      setEnvReady(true)
    })
  }, [])

  rlog('app', `render: loading=${loading}, company=${!!company}, user=${!!user}, envReady=${envReady}`)

  if (envReady === null) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Verificando configuración...</p>
      </div>
    )
  }

  if (!envReady) {
    return (
      <Routes>
        <Route path="*" element={<EnvSetupPage />} />
      </Routes>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  if (!company) {
    return (
      <Routes>
        <Route path="*" element={<SetupWizardPage />} />
      </Routes>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute module="inventory">
              <InventoryPage />
            </ProtectedRoute>
          }
        >
          <Route index element={<ProductsPage embedded />} />
          <Route path="entries" element={<InventoryEntriesPage embedded />} />
        </Route>
        <Route
          path="/products/categories"
          element={
            <ProtectedRoute module="categories">
              <CategoriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute module="products">
              <ProductsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute module="products">
              <SuppliersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory-entries"
          element={
            <ProtectedRoute module="inventory-entries">
              <InventoryEntriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute module="customers">
              <CustomersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute module="settings">
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/fiscal-control"
          element={
            <ProtectedRoute module="fiscal-control">
              <FiscalControlPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/data-migration"
          element={
            <ProtectedRoute module="data-migration">
              <DataMigrationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/iva"
          element={
            <ProtectedRoute module="iva-books">
              <IvaBooksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute module="reports">
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute module="users">
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pos"
          element={
            <ProtectedRoute module="pos">
              <POSPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoices/:id"
          element={
            <ProtectedRoute module="invoices">
              <InvoiceViewPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
