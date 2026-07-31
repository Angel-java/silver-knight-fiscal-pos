import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockAutoUpdater } = vi.hoisted(() => ({
  mockAutoUpdater: {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    forceDevUpdateConfig: false,
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    on: vi.fn()
  }
}))

vi.mock('electron', () => ({
  app: { getVersion: vi.fn(() => '1.0.0') },
  BrowserWindow: vi.fn(),
  ipcMain: {
    on: vi.fn(),
    handle: vi.fn()
  }
}))

vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater
}))

vi.mock('./docker', () => ({
  stopCompose: vi.fn().mockResolvedValue(undefined)
}))

import { AppUpdater } from './updater'
import { stopCompose } from './docker'

describe('AppUpdater', () => {
  let updater: AppUpdater
  let eventHandlers: Record<string, (...args: unknown[]) => void>

  beforeEach(() => {
    vi.clearAllMocks()
    eventHandlers = {}
    mockAutoUpdater.on.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      eventHandlers[event] = handler
    })
    updater = new AppUpdater()
  })

  afterEach(() => {
    updater.stopAutoCheck()
  })

  it('configures autoUpdater correctly on construction', () => {
    expect(mockAutoUpdater.autoDownload).toBe(false)
    expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true)
    expect(mockAutoUpdater.forceDevUpdateConfig).toBe(false)
  })

  it('registers all event listeners on construction', () => {
    const expectedEvents = [
      'update-available',
      'update-not-available',
      'download-progress',
      'update-downloaded',
      'error'
    ]
    for (const event of expectedEvents) {
      expect(mockAutoUpdater.on).toHaveBeenCalledWith(event, expect.any(Function))
    }
  })

  it('starts with idle status', () => {
    expect(updater.getStatus()).toEqual({
      status: 'idle',
      version: '',
      error: ''
    })
  })

  it('transitions to checking on checkForUpdates', async () => {
    mockAutoUpdater.checkForUpdates.mockResolvedValue(undefined)
    await updater.checkForUpdates()
    expect(updater.getStatus().status).toBe('checking')
  })

  it('transitions to error when checkForUpdates fails', async () => {
    mockAutoUpdater.checkForUpdates.mockRejectedValue(new Error('network error'))
    await updater.checkForUpdates()
    expect(updater.getStatus().status).toBe('error')
    expect(updater.getStatus().error).toBe('network error')
  })

  it('ignores checkForUpdates when downloading', async () => {
    eventHandlers['download-progress']({ percent: 50 })
    expect(updater.getStatus().status).toBe('downloading')
    await updater.checkForUpdates()
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('updates status on update-available event', () => {
    eventHandlers['update-available']({ version: '2.0.0' })
    expect(updater.getStatus()).toEqual({
      status: 'available',
      version: '2.0.0',
      error: ''
    })
  })

  it('resets status on update-not-available event', () => {
    eventHandlers['update-not-available']()
    expect(updater.getStatus().status).toBe('idle')
  })

  it('transitions to downloading on download-progress event', () => {
    eventHandlers['download-progress']({ percent: 45.5 })
    expect(updater.getStatus().status).toBe('downloading')
  })

  it('transitions to downloaded on update-downloaded event', () => {
    eventHandlers['update-downloaded']()
    expect(updater.getStatus().status).toBe('downloaded')
  })

  it('transitions to error on error event', () => {
    eventHandlers['error'](new Error('download failed'))
    expect(updater.getStatus().status).toBe('error')
    expect(updater.getStatus().error).toBe('download failed')
  })

  it('downloadUpdate proceeds only when status is available', async () => {
    mockAutoUpdater.downloadUpdate.mockResolvedValue(undefined)
    await updater.downloadUpdate()
    expect(mockAutoUpdater.downloadUpdate).not.toHaveBeenCalled()

    eventHandlers['update-available']({ version: '2.0.0' })
    await updater.downloadUpdate()
    expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalled()
  })

  it('downloadUpdate handles errors', async () => {
    eventHandlers['update-available']({ version: '2.0.0' })
    mockAutoUpdater.downloadUpdate.mockRejectedValue(new Error('disk full'))
    await updater.downloadUpdate()
    expect(updater.getStatus().status).toBe('error')
    expect(updater.getStatus().error).toBe('disk full')
  })

  it('installUpdate proceeds only when status is downloaded', async () => {
    await updater.installUpdate()
    expect(mockAutoUpdater.quitAndInstall).not.toHaveBeenCalled()

    eventHandlers['update-downloaded']()
    await updater.installUpdate()
    expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true)
  })

  it('installUpdate stops docker compose before quitting', async () => {
    eventHandlers['update-downloaded']()
    await updater.installUpdate()
    expect(stopCompose).toHaveBeenCalled()
  })

  it('send does not crash when mainWindow is null', () => {
    expect(() => {
      eventHandlers['update-available']({ version: '2.0.0' })
    }).not.toThrow()
  })

  it('startAutoCheck sets interval', () => {
    vi.useFakeTimers()
    updater.startAutoCheck(1000)
    mockAutoUpdater.checkForUpdates.mockResolvedValue(undefined)
    vi.advanceTimersByTime(1000)
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('stopAutoCheck clears interval', () => {
    vi.useFakeTimers()
    updater.startAutoCheck(1000)
    updater.stopAutoCheck()
    mockAutoUpdater.checkForUpdates.mockResolvedValue(undefined)
    vi.advanceTimersByTime(2000)
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('startAutoCheck replaces previous interval', () => {
    vi.useFakeTimers()
    updater.startAutoCheck(1000)
    updater.startAutoCheck(2000)
    mockAutoUpdater.checkForUpdates.mockResolvedValue(undefined)
    vi.advanceTimersByTime(1500)
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('send sends to mainWindow webContents when window is valid', () => {
    const mockSend = vi.fn()
    const mockWin = {
      isDestroyed: () => false,
      webContents: { send: mockSend }
    } as unknown as import('electron').BrowserWindow
    updater.setMainWindow(mockWin)

    eventHandlers['update-available']({ version: '2.0.0' })
    expect(mockSend).toHaveBeenCalledWith('update-available', '2.0.0')
  })

  it('send skips destroyed window', () => {
    const mockSend = vi.fn()
    const mockWin = {
      isDestroyed: () => true,
      webContents: { send: mockSend }
    } as unknown as import('electron').BrowserWindow
    updater.setMainWindow(mockWin)

    eventHandlers['update-available']({ version: '2.0.0' })
    expect(mockSend).not.toHaveBeenCalled()
  })
})
