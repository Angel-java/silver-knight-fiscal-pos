import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/useAuth'
import LoginPage from './pages/LoginPage'
import SetupWizardPage from './pages/SetupWizardPage'
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

function App(): React.JSX.Element {
  const { user, company, loading } = useAuth()

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
        <Route path="/inventory" element={<InventoryPage />}>
          <Route index element={<ProductsPage embedded />} />
          <Route path="entries" element={<InventoryEntriesPage embedded />} />
        </Route>
        <Route path="/products/categories" element={<CategoriesPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/inventory-entries" element={<InventoryEntriesPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/fiscal-control" element={<FiscalControlPage />} />
        <Route path="/iva" element={<IvaBooksPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/pos" element={<POSPage />} />
        <Route path="/invoices/:id" element={<InvoiceViewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
