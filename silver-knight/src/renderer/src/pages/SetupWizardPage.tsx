import { useState, type FormEvent } from 'react'
import type { JSX } from 'react'
import { useAuth } from '../contexts/useAuth'

type Profile = 'small' | 'medium' | 'big'

const PROFILES: { value: Profile; label: string; desc: string; detail: string }[] = [
  { value: 'small', label: 'Small', desc: 'Una máquina', detail: 'Un solo punto de venta local' },
  {
    value: 'medium',
    label: 'Medium',
    desc: 'Red local',
    detail: 'Múltiples puntos en la misma red (LAN)'
  },
  {
    value: 'big',
    label: 'Big',
    desc: 'Multi-sucursal',
    detail: 'Varias sedes conectadas entre sí'
  }
]

export default function SetupWizardPage(): JSX.Element {
  const { setup } = useAuth()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [profile, setProfile] = useState<Profile>('small')
  const [company, setCompany] = useState({ name: '', rif: '', address: '', phone: '', email: '' })
  const [admin, setAdmin] = useState({ username: '', fullName: '', pin: '', confirmPin: '' })

  const handleProfileSubmit = (): void => {
    setError('')
    setStep(1)
  }

  const handleCompanySubmit = (e: FormEvent): void => {
    e.preventDefault()
    setError('')
    if (!company.name.trim() || !company.rif.trim()) {
      setError('Nombre y RIF de la empresa son requeridos')
      return
    }
    setStep(2)
  }

  const handleAdminSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')
    if (!admin.username.trim() || !admin.pin.trim()) {
      setError('Usuario y PIN requeridos')
      return
    }
    if (admin.pin.length < 4) {
      setError('El PIN debe tener al menos 4 dígitos')
      return
    }
    if (admin.pin !== admin.confirmPin) {
      setError('Los PIN no coinciden')
      return
    }

    setSubmitting(true)
    try {
      await setup(
        profile,
        {
          name: company.name,
          rif: company.rif,
          address: company.address || undefined,
          phone: company.phone || undefined,
          email: company.email || undefined
        },
        { username: admin.username, fullName: admin.fullName || undefined, pin: admin.pin }
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al configurar')
    } finally {
      setSubmitting(false)
    }
  }

  const cardClass = (selected: boolean): string =>
    `flex-1 p-4 rounded-lg border-2 text-center cursor-pointer transition-all ${
      selected
        ? 'border-primary bg-primary/5 shadow-sm'
        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
    }`

  if (step === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">SK</span>
          </div>
          <h1 className="text-xl font-bold text-center text-gray-800">Configuración Inicial</h1>
          <p className="text-sm text-gray-500 text-center mb-6">Paso 1: Perfil del sistema</p>

          <p className="text-sm text-gray-600 mb-4">
            Selecciona el alcance de tu sistema. Esto define cómo se conectan tus puntos de venta.
          </p>

          <div className="flex gap-3 mb-4">
            {PROFILES.map((p) => (
              <div key={p.value} className={cardClass(profile === p.value)} onClick={() => setProfile(p.value)}>
                <p className="font-bold text-lg">{p.label}</p>
                <p className="text-xs text-gray-500 mt-1">{p.desc}</p>
                <p className="text-xs text-gray-400 mt-1">{p.detail}</p>
              </div>
            ))}
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="button"
            onClick={handleProfileSubmit}
            className="w-full bg-primary text-white py-2 rounded-md hover:bg-primary-dark transition-colors"
          >
            Siguiente
          </button>
        </div>
      </div>
    )
  }

  if (step === 1) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">SK</span>
          </div>
          <h1 className="text-xl font-bold text-center text-gray-800">Configuración Inicial</h1>
          <p className="text-sm text-gray-500 text-center mb-6">Paso 2: Datos de la empresa</p>

          <form onSubmit={handleCompanySubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la empresa *
              </label>
              <input
                type="text"
                value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RIF *</label>
              <input
                type="text"
                value={company.rif}
                onChange={(e) => setCompany({ ...company, rif: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="J-12345678-9"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input
                type="text"
                value={company.address}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={company.phone}
                  onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={company.email}
                  onChange={(e) => setCompany({ ...company, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="flex-1 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Atrás
              </button>
              <button
                type="submit"
                className="flex-1 bg-primary text-white py-2 rounded-md hover:bg-primary-dark transition-colors"
              >
                Siguiente
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-2xl font-bold">SK</span>
        </div>
        <h1 className="text-xl font-bold text-center text-gray-800">Configuración Inicial</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Paso 3: Usuario gerente</p>

        <form onSubmit={handleAdminSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de usuario *
            </label>
            <input
              type="text"
              value={admin.username}
              onChange={(e) => setAdmin({ ...admin, username: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              value={admin.fullName}
              onChange={(e) => setAdmin({ ...admin, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Nombre y apellido"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PIN *</label>
            <input
              type="password"
              value={admin.pin}
              onChange={(e) => setAdmin({ ...admin, pin: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Mínimo 4 dígitos"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar PIN *</label>
            <input
              type="password"
              value={admin.confirmPin}
              onChange={(e) => setAdmin({ ...admin, confirmPin: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Atrás
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-primary text-white py-2 rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Configurando...' : 'Finalizar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
