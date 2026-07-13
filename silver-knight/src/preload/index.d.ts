import { ElectronAPI } from '@electron-toolkit/preload'

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
