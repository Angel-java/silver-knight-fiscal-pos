import { useState, useEffect, type FormEvent, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { api, PERMISSION_MODULES, type User } from '../lib/api'

const roleLabels: Record<string, string> = {
  root: 'Root',
  admin: 'Admin',
  gerente: 'Gerente',
  operador: 'Operador'
}

const roleBadgeColors: Record<string, string> = {
  root: 'bg-red-100 text-red-700',
  admin: 'bg-purple-100 text-purple-700',
  gerente: 'bg-orange-100 text-orange-700',
  operador: 'bg-blue-100 text-blue-700'
}

const permissionLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  pos: 'Punto de Venta',
  products: 'Productos',
  categories: 'Categorías',
  inventory: 'Inventario',
  'inventory-entries': 'Entradas/Salidas',
  customers: 'Clientes',
  invoices: 'Facturas',
  reports: 'Reportes',
  settings: 'Configuración',
  'exchange-rates': 'Tasas de Cambio',
  'iva-books': 'Libros IVA',
  'fiscal-control': 'Control Fiscal',
  users: 'Usuarios',
  'data-migration': 'Migración de Datos'
}

export default function UsersPage(): JSX.Element {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const isRoot = currentUser?.role === 'root'
  const isAdmin = currentUser?.role === 'admin'

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState({
    username: '',
    fullName: '',
    pin: '',
    role: 'operador',
    permissions: [] as string[]
  })
  const [saving, setSaving] = useState(false)

  const load = async (): Promise<void> => {
    try {
      const res = await api.users.list()
      setUsers(res.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        const res = await api.users.list()
        setUsers(res.users)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar usuarios')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const openCreate = (): void => {
    setEditing(null)
    setForm({
      username: '',
      fullName: '',
      pin: '',
      role: isRoot ? 'admin' : 'gerente',
      permissions: [...PERMISSION_MODULES]
    })
    setShowModal(true)
  }

  const openEdit = (u: User): void => {
    setEditing(u)
    setForm({
      username: u.username,
      fullName: u.fullName || '',
      pin: '',
      role: u.role,
      permissions: u.permissions || []
    })
    setShowModal(true)
  }

  const togglePermission = (mod: string): void => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(mod)
        ? prev.permissions.filter((p) => p !== mod)
        : [...prev.permissions, mod]
    }))
  }

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')
    if (!form.username) {
      setError('Username requerido')
      return
    }
    if (!editing && !form.pin) {
      setError('PIN requerido')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        username: form.username,
        fullName: form.fullName || null,
        role: form.role,
        permissions: form.permissions
      }
      if (form.pin) payload.pin = form.pin

      if (editing) {
        await api.users.update(editing.id, payload)
        setSuccess('Usuario actualizado')
      } else {
        await api.users.create(payload as any)
        setSuccess('Usuario creado')
      }
      setShowModal(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (u: User): Promise<void> => {
    try {
      await api.users.update(u.id, { isActive: !u.isActive })
      setSuccess(u.isActive ? 'Usuario desactivado' : 'Usuario activado')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar')
    }
  }

  const canEditUser = (u: User): boolean => {
    // No se puede editar a sí mismo
    if (u.id === currentUser?.id) return false
    // Root puede editar a todos
    if (isRoot) return true
    // Admin puede editar gerentes y operadores
    if (isAdmin && (u.role === 'gerente' || u.role === 'operador')) return true
    return false
  }

  const filteredUsers = users

  // Roles disponibles según quién crea
  const availableRoles = isRoot
    ? ['admin', 'gerente', 'operador']
    : isAdmin
      ? ['gerente', 'operador']
      : []

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-gray-500 hover:text-gray-700 text-lg"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
        </div>
        {(isRoot || isAdmin) && (
          <button
            onClick={openCreate}
            className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-colors text-sm"
          >
            + Nuevo Usuario
          </button>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mb-4 bg-red-50 rounded p-3">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-4 bg-green-50 rounded p-3">{success}</p>}

      {loading && <p className="text-gray-500 text-center py-8">Cargando...</p>}

      {!loading && filteredUsers.length === 0 && (
        <p className="text-gray-400 text-center py-8">No hay usuarios registrados</p>
      )}

      {!loading && filteredUsers.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Usuario</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Nombre completo
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Rol</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Creado</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{u.fullName || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${roleBadgeColors[u.role] || 'bg-gray-100 text-gray-700'}`}
                    >
                      {roleLabels[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-red-400'}`}
                    />
                    <span className="text-xs ml-1 text-gray-500">
                      {u.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canEditUser(u) && (
                      <>
                        <button
                          onClick={() => openEdit(u)}
                          className="text-sm text-primary hover:text-primary-dark mr-3"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          className={`text-sm ${u.isActive ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                        >
                          {u.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                      </>
                    )}
                    {u.id === currentUser?.id && (
                      <span className="text-xs text-gray-400 italic">Tú</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-bold mb-4">
              {editing ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de usuario
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Nombre y apellido"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PIN {editing && '(dejar vacío para no cambiar)'}
                </label>
                <input
                  type="password"
                  value={form.pin}
                  maxLength={6}
                  onChange={(e) => setForm({ ...form, pin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder={editing ? '••••••' : 'PIN de 4-6 dígitos'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>
                      {roleLabels[r]}
                    </option>
                  ))}
                </select>
              </div>

              {(form.role === 'admin' || form.role === 'gerente' || form.role === 'operador') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Módulos permitidos
                    {isRoot && form.role === 'admin' && (
                      <span className="text-xs text-gray-400 font-normal ml-2">
                        (Gestionados por ti como Root)
                      </span>
                    )}
                    {isAdmin && (form.role === 'gerente' || form.role === 'operador') && (
                      <span className="text-xs text-gray-400 font-normal ml-2">
                        (Gestionados por ti como Admin)
                      </span>
                    )}
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {PERMISSION_MODULES.map((mod) => (
                      <label
                        key={mod}
                        className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={form.permissions.includes(mod)}
                          onChange={() => togglePermission(mod)}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        {permissionLabels[mod] || mod}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors text-sm"
                >
                  {saving ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
