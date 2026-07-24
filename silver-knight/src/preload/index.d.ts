interface ElectronAPI {
  send: (channel: string, ...args: unknown[]) => void
  on: (channel: string, callback: (...args: unknown[]) => void) => void
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
}

interface DockerAPI {
  status: () => Promise<{ installed: boolean; running: boolean; version?: string }>
  restart: () => Promise<{ success: boolean; error?: string }>
  rebuild: () => Promise<{ success: boolean; error?: string }>
}

interface SilverKnightAPI {
  checkForUpdates: () => void
  downloadUpdate: () => void
  installUpdate: () => void
  getUpdateStatus: () => { status: string; version: string; error: string }
  getUpdateStatusAsync: () => Promise<{ status: string; version: string; error: string }>
  getVersion: () => string
  onUpdateAvailable: (callback: (version: string) => void) => void
  onUpdateNotAvailable: (callback: () => void) => void
  onUpdateProgress: (callback: (percent: number) => void) => void
  onUpdateDownloaded: (callback: () => void) => void
  onUpdateError: (callback: (error: string) => void) => void
  onUpdateChecking: (callback: () => void) => void
  docker: DockerAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: SilverKnightAPI
  }
}

export {}
