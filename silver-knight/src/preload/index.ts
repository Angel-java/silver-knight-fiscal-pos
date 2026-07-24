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
  getUpdateStatus: (): { status: string; version: string; error: string } =>
    ipcRenderer.sendSync('get-update-status'),
  getUpdateStatusAsync: (): Promise<{ status: string; version: string; error: string }> =>
    ipcRenderer.invoke('get-update-status'),
  getVersion: (): string => ipcRenderer.sendSync('get-app-version'),
  onUpdateAvailable: (callback: (version: string) => void): void => {
    ipcRenderer.on('update-available', (_event, version) => callback(version))
  },
  onUpdateNotAvailable: (callback: () => void): void => {
    ipcRenderer.on('update-not-available', () => callback())
  },
  onUpdateProgress: (callback: (percent: number) => void): void => {
    ipcRenderer.on('update-download-progress', (_event, percent) => callback(percent))
  },
  onUpdateDownloaded: (callback: () => void): void => {
    ipcRenderer.on('update-downloaded', () => callback())
  },
  onUpdateError: (callback: (error: string) => void): void => {
    ipcRenderer.on('update-error', (_event, error) => callback(error))
  },
  onUpdateChecking: (callback: () => void): void => {
    ipcRenderer.on('update-checking', () => callback())
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
