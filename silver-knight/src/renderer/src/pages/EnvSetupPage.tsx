import { useState, useEffect } from 'react'
import type { JSX } from 'react'

type Step = 'loading' | 'pin' | 'existing-db' | 'review' | 'saving' | 'done' | 'error'

interface BackendError {
  code: string
  message: string
}

export default function EnvSetupPage(): JSX.Element {
  const [step, setStep] = useState<Step>('loading')
  const [hasExistingDb, setHasExistingDb] = useState(false)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [existingPassword, setExistingPassword] = useState('')
  const [error, setError] = useState('')
  const [backendError, setBackendError] = useState<BackendError | null>(null)
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        const migrated = await window.api.config.migrate()
        if (migrated) {
          setStatusMsg('Configuración migrada. Iniciando servidor...')
          setStep('saving')
          const result = await window.api.config.startBackend()
          if (result.success) {
            setStep('done')
            setTimeout(() => window.location.reload(), 2000)
          } else {
            setBackendError({
              code: result.error || 'unknown',
              message: result.message || 'Error al iniciar'
            })
            setStep('error')
          }
          return
        }

        const existing = await window.api.config.hasExistingDb()
        setHasExistingDb(existing)
        setStep('pin')
      } catch {
        setStep('pin')
      }
    }
    init()
  }, [])

  const handlePinSubmit = (): void => {
    setError('')
    if (pin.length < 4) {
      setError('El PIN debe tener al menos 4 caracteres')
      return
    }
    if (pin !== confirmPin) {
      setError('Los PIN no coinciden')
      return
    }

    if (hasExistingDb) {
      setStep('existing-db')
    } else {
      setStep('review')
    }
  }

  const handleExistingDbSubmit = (): void => {
    setError('')
    if (!existingPassword.trim()) {
      setError('La contraseña de la base de datos es requerida')
      return
    }
    setStep('review')
  }

  const handleConfirm = async (): Promise<void> => {
    setStep('saving')
    setStatusMsg('Guardando configuración...')
    setError('')

    try {
      await window.api.config.save({
        rootPin: pin,
        postgresPassword: hasExistingDb ? existingPassword : undefined
      })

      setStatusMsg('Iniciando servidor backend...')
      const result = await window.api.config.startBackend()

      if (!result.success) {
        setBackendError({
          code: result.error || 'unknown',
          message: result.message || 'Error al iniciar el servidor'
        })
        setStep('error')
        return
      }

      setStep('done')
      setStatusMsg('Servidor listo. Recargando...')

      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar configuración')
      setStep('review')
    }
  }

  const cardClass = 'bg-white rounded-lg shadow-lg p-8 w-full max-w-md'
  const logoClass = 'w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4'
  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary'

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          <p className="text-gray-500">Verificando configuración...</p>
        </div>
      </div>
    )
  }

  if (step === 'pin') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className={cardClass}>
          <div className={logoClass}>
            <span className="text-white text-2xl font-bold">SK</span>
          </div>
          <h1 className="text-xl font-bold text-center text-gray-800">Configuración de Seguridad</h1>
          <p className="text-sm text-gray-500 text-center mb-6">
            {hasExistingDb ? 'Paso 1 de 3: Define el PIN del administrador' : 'Paso 1 de 2: Define el PIN del administrador'}
          </p>

          <p className="text-sm text-gray-600 mb-4">
            Este PIN se usará para acceder como administrador principal del sistema.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PIN del administrador *
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className={inputClass}
                placeholder="Mínimo 4 caracteres"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && document.getElementById('confirm-pin')?.focus()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar PIN *
              </label>
              <input
                id="confirm-pin"
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className={inputClass}
                placeholder="Repite el PIN"
                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="button"
              onClick={handlePinSubmit}
              className="w-full bg-primary text-white py-2 rounded-md hover:bg-primary-dark transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'existing-db') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className={cardClass}>
          <div className={logoClass}>
            <span className="text-white text-2xl font-bold">SK</span>
          </div>
          <h1 className="text-xl font-bold text-center text-gray-800">Base de Datos Existente</h1>
          <p className="text-sm text-gray-500 text-center mb-6">Paso 2 de 3: Contraseña de la base de datos</p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
            <p className="text-sm text-yellow-800 font-medium">
              Se detectó una base de datos existente.
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Ingresa la contraseña de PostgreSQL que se usó originalmente.
              Si no la recuerdas, la contraseña se generó automáticamente con la instalación anterior.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña de PostgreSQL *
              </label>
              <input
                type="password"
                value={existingPassword}
                onChange={(e) => setExistingPassword(e.target.value)}
                className={inputClass}
                placeholder="Contraseña de la base de datos"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleExistingDbSubmit()}
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('pin')}
                className="flex-1 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={handleExistingDbSubmit}
                className="flex-1 bg-primary text-white py-2 rounded-md hover:bg-primary-dark transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'review') {
    const totalSteps = hasExistingDb ? 3 : 2
    const currentStep = hasExistingDb ? 3 : 2
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-lg">
          <div className={logoClass}>
            <span className="text-white text-2xl font-bold">SK</span>
          </div>
          <h1 className="text-xl font-bold text-center text-gray-800">Configuración de Seguridad</h1>
          <p className="text-sm text-gray-500 text-center mb-4">
            Paso {currentStep} de {totalSteps}: Revisa las credenciales generadas
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
            <p className="text-sm text-yellow-800 font-medium">
              Guarda estas credenciales en un lugar seguro.
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              No se volverán a mostrar. Si las pierdes, necesitarás reinstalar el sistema.
            </p>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex justify-between items-center bg-gray-50 rounded-md p-3">
              <div>
                <p className="text-xs text-gray-500">PIN del Admin</p>
                <p className="font-mono text-sm font-bold">{pin}</p>
              </div>
            </div>
            {!hasExistingDb && (
              <>
                <div className="flex justify-between items-center bg-gray-50 rounded-md p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500">Password Postgres (se generará)</p>
                    <p className="font-mono text-sm font-bold truncate text-gray-400">
                      Se genera al confirmar
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center bg-gray-50 rounded-md p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500">JWT Secret (se generará)</p>
                    <p className="font-mono text-xs truncate text-gray-400">
                      Se genera al confirmar
                    </p>
                  </div>
                </div>
              </>
            )}
            {hasExistingDb && (
              <div className="flex justify-between items-center bg-gray-50 rounded-md p-3">
                <div>
                  <p className="text-xs text-gray-500">Password Postgres</p>
                  <p className="font-mono text-sm font-bold">Usando contraseña existente</p>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(hasExistingDb ? 'existing-db' : 'pin')}
              className="flex-1 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 bg-primary text-white py-2 rounded-md hover:bg-primary-dark transition-colors"
            >
              Guardar e iniciar
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'saving' || step === 'done') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className={cardClass}>
          <div className={logoClass}>
            <span className="text-white text-2xl font-bold">SK</span>
          </div>
          <h1 className="text-xl font-bold text-center text-gray-800">Configuración de Seguridad</h1>
          <p className="text-sm text-gray-500 text-center mb-6">{statusMsg}</p>

          {step === 'saving' && (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}

          {step === 'done' && (
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-600">Configuración completada</p>
            </div>
          )}

          {error && <p className="text-red-600 text-sm mt-4 text-center">{error}</p>}
        </div>
      </div>
    )
  }

  if (step === 'error' && backendError) {
    const handleRetry = (): void => {
      setBackendError(null)
      setError('')
      setStep('review')
    }

    const handleForceGenerate = (): void => {
      setBackendError(null)
      setError('')
      setHasExistingDb(false)
      setStep('review')
    }

    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className={cardClass}>
          <div className={logoClass}>
            <span className="text-white text-2xl font-bold">SK</span>
          </div>
          <h1 className="text-xl font-bold text-center text-gray-800">
            {backendError.code === 'auth-failure' ? 'Error de autenticación' :
             backendError.code === 'docker-not-running' ? 'Docker no disponible' :
             'Error al iniciar servidor'}
          </h1>

          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <p className="text-sm text-red-800">{backendError.message}</p>
          </div>

          {backendError.code === 'auth-failure' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
              <p className="text-xs text-yellow-800">
                Si no recuerdas la contraseña, puedes generar credenciales nuevas.
                Esto creará una nueva base de datos y borrarás los datos anteriores.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleRetry}
              className="flex-1 bg-primary text-white py-2 rounded-md hover:bg-primary-dark transition-colors"
            >
              {backendError.code === 'auth-failure' ? 'Cambiar contraseña' : 'Reintentar'}
            </button>
            {backendError.code === 'auth-failure' && (
              <button
                type="button"
                onClick={handleForceGenerate}
                className="flex-1 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm"
              >
                Generar nuevas credenciales
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return <></>
}
