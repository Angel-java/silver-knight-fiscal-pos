import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

interface User {
  id: string
  username: string
  role: string
  isActive: boolean
  createdAt: string
}

export default function UsersPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState({ username: '', pin: '', role: 'operator' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
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
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ username: '', pin: '', role: 'operator' })
    setShowModal(true)
  }

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({ username: u.username, pin: '', role: u.role })
    setShowModal(true)
  }

  const handleSubmit = async (e: FormEvent) => {
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
      if (editing) {
        const payload: { username?: string; pin?: string; role?: string } = {
          username: form.username,
          role: form.role
        }
        if (form.pin) payload.pin = form.pin
        await api.users.update(editing.id, payload)
        setSuccess('Usuario actualizado')
      } else {
        await api.users.create(form)
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

  const toggleActive = async (u: User) => {
    try {
      await api.users.update(u.id, { isActive: !u.isActive })
      setSuccess(u.isActive ? 'Usuario desactivado' : 'Usuario activado')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar')
    }
  }

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
        <button
          onClick={openCreate}
          className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-colors text-sm"
        >
          + Nuevo Usuario
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-4 bg-red-50 rounded p-3">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-4 bg-green-50 rounded p-3">{success}</p>}

      {loading && <p className="text-gray-500 text-center py-8">Cargando...</p>}

      {!loading && users.length === 0 && (
        <p className="text-gray-400 text-center py-8">No hay usuarios registrados</p>
      )}

      {!loading && users.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Usuario</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Rol</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Creado</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        u.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {u.role === 'admin' ? 'Admin' : 'Operador'}
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
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
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
                  <option value="operator">Operador</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
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
