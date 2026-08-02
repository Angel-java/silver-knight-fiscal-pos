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

interface ConfigAPI {
  exists: () => Promise<boolean>
  read: () => Promise<Record<string, string>>
  save: (data: { rootPin: string; postgresPassword?: string }) => Promise<Record<string, string>>
  migrate: () => Promise<boolean>
  hasExistingDb: () => Promise<boolean>
  startBackend: () => Promise<{ success: boolean; error?: string; message?: string; logs?: string }>
}

interface SilverKnightAPI {
  checkForUpdates: () => void
  downloadUpdate: () => void
  installUpdate: () => void
  getUpdateStatus: () => Promise<{ status: string; version: string; error: string }>
  getUpdateStatusAsync: () => Promise<{ status: string; version: string; error: string }>
  getVersion: () => Promise<string>
  getVersionAsync: () => Promise<string>
  onUpdateAvailable: (callback: (version: string) => void) => (() => void)
  onUpdateNotAvailable: (callback: () => void) => (() => void)
  onUpdateProgress: (callback: (percent: number) => void) => (() => void)
  onUpdateDownloaded: (callback: () => void) => (() => void)
  onUpdateError: (callback: (error: string) => void) => (() => void)
  onUpdateChecking: (callback: () => void) => (() => void)
  docker: DockerAPI
  config: ConfigAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: SilverKnightAPI
  }
}

export {}
