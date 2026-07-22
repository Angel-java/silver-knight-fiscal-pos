import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  send: (channel: string, ...args: unknown[]): void => ipcRenderer.send(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  }
}

const api = {
  checkForUpdates: (): void => ipcRenderer.send('check-for-updates'),
  downloadUpdate: (): void => ipcRenderer.send('download-update'),
  installUpdate: (): void => ipcRenderer.send('install-update'),
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
