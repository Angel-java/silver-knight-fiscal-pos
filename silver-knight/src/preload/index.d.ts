interface ElectronAPI {
  send: (channel: string, ...args: unknown[]) => void
  on: (channel: string, callback: (...args: unknown[]) => void) => void
}

interface SilverKnightAPI {
  checkForUpdates: () => void
  downloadUpdate: () => void
  installUpdate: () => void
  onUpdateAvailable: (callback: (version: string) => void) => void
  onUpdateNotAvailable: (callback: () => void) => void
  onUpdateProgress: (callback: (percent: number) => void) => void
  onUpdateDownloaded: (callback: () => void) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: SilverKnightAPI
  }
}

export {}
