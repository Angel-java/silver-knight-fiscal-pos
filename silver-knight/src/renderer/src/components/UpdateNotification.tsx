import { useState, useEffect, useCallback } from 'react'

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'

export default function UpdateNotification(): React.ReactElement | null {
  const [state, setState] = useState<{ status: UpdateStatus; version: string; progress: number }>({
    status: 'idle',
    version: '',
    progress: 0
  })
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.api
      .getUpdateStatusAsync()
      .then((s) => {
        if (s.status === 'available' || s.status === 'downloaded') {
          setState({ status: s.status as UpdateStatus, version: s.version, progress: 0 })
        }
      })
      .catch(() => {})

    const onChecking = (): void => {
      setState({ status: 'checking', version: '', progress: 0 })
      setError('')
    }
    const onAvailable = (v: string): void => {
      setState({ status: 'available', version: v, progress: 0 })
      setDismissed(false)
    }
    const onNotAvailable = (): void => {
      setState({ status: 'idle', version: '', progress: 0 })
    }
    const onProgress = (percent: number): void => {
      setState((prev) => ({ ...prev, status: 'downloading', progress: percent }))
    }
    const onDownloaded = (): void => {
      setState((prev) => ({ ...prev, status: 'downloaded' }))
    }
    const onError = (err: string): void => {
      setState((prev) => ({ ...prev, status: 'error' }))
      setError(err)
    }

    const cleanups = [
      window.api.onUpdateChecking(onChecking),
      window.api.onUpdateAvailable(onAvailable),
      window.api.onUpdateNotAvailable(onNotAvailable),
      window.api.onUpdateProgress(onProgress),
      window.api.onUpdateDownloaded(onDownloaded),
      window.api.onUpdateError(onError)
    ]

    return () => {
      cleanups.forEach((fn) => fn())
    }
  }, [])

  const handleCheck = useCallback((): void => {
    window.api.checkForUpdates()
  }, [])

  const handleDownload = useCallback((): void => {
    window.api.downloadUpdate()
  }, [])

  const handleInstall = useCallback((): void => {
    window.api.installUpdate()
  }, [])

  const handleDismiss = useCallback((): void => {
    setDismissed(true)
  }, [])

  if (dismissed) return null
  if (state.status === 'idle' || state.status === 'checking') return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-white rounded-lg shadow-lg border border-gray-200 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {state.status === 'error' ? (
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {state.status === 'available' && (
            <>
              <p className="text-sm font-medium text-gray-900">Actualización disponible</p>
              <p className="text-xs text-gray-500 mt-0.5">Silver Knight v{state.version}</p>
            </>
          )}
          {state.status === 'downloading' && (
            <>
              <p className="text-sm font-medium text-gray-900">Descargando actualización...</p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
            </>
          )}
          {state.status === 'downloaded' && (
            <>
              <p className="text-sm font-medium text-gray-900">Actualización lista</p>
              <p className="text-xs text-gray-500 mt-0.5">Reiniciar para aplicar</p>
            </>
          )}
          {state.status === 'error' && (
            <>
              <p className="text-sm font-medium text-red-600">Error de actualización</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{error}</p>
            </>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        {state.status === 'available' && (
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700"
          >
            Descargar
          </button>
        )}
        {state.status === 'downloaded' && (
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700"
          >
            Reiniciar ahora
          </button>
        )}
        {state.status === 'error' && (
          <button
            onClick={handleCheck}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-200"
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  )
}
