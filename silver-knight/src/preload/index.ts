import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  send: (channel: string, ...args: unknown[]): void => ipcRenderer.send(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  },
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke(channel, ...args)
}

const api = {
  checkForUpdates: (): void => ipcRenderer.send('check-for-updates'),
  downloadUpdate: (): void => ipcRenderer.send('download-update'),
  installUpdate: (): void => ipcRenderer.send('install-update'),
  getUpdateStatus: (): Promise<{ status: string; version: string; error: string }> =>
    ipcRenderer.invoke('get-update-status') as Promise<{ status: string; version: string; error: string }>,
  getUpdateStatusAsync: (): Promise<{ status: string; version: string; error: string }> =>
    ipcRenderer.invoke('get-update-status') as Promise<{ status: string; version: string; error: string }>,
  getVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version') as Promise<string>,
  getVersionAsync: (): Promise<string> => ipcRenderer.invoke('get-app-version') as Promise<string>,
  onUpdateAvailable: (callback: (version: string) => void): (() => void) => {
    const handler = (_event: unknown, version: string): void => callback(version)
    ipcRenderer.on('update-available', handler)
    return () => {
      ipcRenderer.removeListener('update-available', handler)
    }
  },
  onUpdateNotAvailable: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('update-not-available', handler)
    return () => {
      ipcRenderer.removeListener('update-not-available', handler)
    }
  },
  onUpdateProgress: (callback: (percent: number) => void): (() => void) => {
    const handler = (_event: unknown, percent: number): void => callback(percent)
    ipcRenderer.on('update-download-progress', handler)
    return () => {
      ipcRenderer.removeListener('update-download-progress', handler)
    }
  },
  onUpdateDownloaded: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('update-downloaded', handler)
    return () => {
      ipcRenderer.removeListener('update-downloaded', handler)
    }
  },
  onUpdateError: (callback: (error: string) => void): (() => void) => {
    const handler = (_event: unknown, error: string): void => callback(error)
    ipcRenderer.on('update-error', handler)
    return () => {
      ipcRenderer.removeListener('update-error', handler)
    }
  },
  onUpdateChecking: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('update-checking', handler)
    return () => {
      ipcRenderer.removeListener('update-checking', handler)
    }
  },
  docker: {
    status: (): Promise<{ installed: boolean; running: boolean; version?: string }> =>
      ipcRenderer.invoke('docker:status') as Promise<{
        installed: boolean
        running: boolean
        version?: string
      }>,
    restart: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('docker:restart') as Promise<{ success: boolean; error?: string }>,
    rebuild: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('docker:rebuild') as Promise<{ success: boolean; error?: string }>
  },
  config: {
    exists: (): Promise<boolean> => ipcRenderer.invoke('config:exists') as Promise<boolean>,
    read: (): Promise<Record<string, string>> =>
      ipcRenderer.invoke('config:read') as Promise<Record<string, string>>,
    save: (data: { rootPin: string; postgresPassword?: string }): Promise<Record<string, string>> =>
      ipcRenderer.invoke('config:save', data) as Promise<Record<string, string>>,
    migrate: (): Promise<boolean> => ipcRenderer.invoke('config:migrate') as Promise<boolean>,
    hasExistingDb: (): Promise<boolean> =>
      ipcRenderer.invoke('config:has-existing-db') as Promise<boolean>,
    startBackend: (): Promise<{ success: boolean; error?: string; message?: string; logs?: string }> =>
      ipcRenderer.invoke('config:start-backend') as Promise<{ success: boolean; error?: string; message?: string; logs?: string }>
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
