# Plan: Auto-Updates — Bugs, Tests, Integración docker-updater

## Fase 1: Corregir bugs

### 1.1 Progress bar real en UpdateNotification.tsx

**Archivo:** `silver-knight/src/renderer/src/components/UpdateNotification.tsx`

- Agregar `progress: number` al state inicial (línea ~7)
- En `onProgress` (línea ~34), recibir el parámetro `percent`:
  ```tsx
  const onProgress = (percent: number): void => {
    setState((prev) => ({ ...prev, status: 'downloading', progress: percent }))
  }
  ```
- En el JSX de downloading (línea ~104-109), reemplazar el `width: '60%'` hardcodeado:
  ```tsx
  <div
    className="bg-blue-600 h-1.5 rounded-full transition-all"
    style={{ width: `${state.progress}%` }}
  />
  ```

### 1.2 Cleanup de listeners IPC en preload + UpdateNotification.tsx

**Archivo:** `silver-knight/src/preload/index.ts`

Cambiar cada `onUpdate*` para que retorne una función de cleanup usando `removeListener`:

```tsx
onUpdateAvailable: (callback: (version: string) => void): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, version: string): void => callback(version)
  ipcRenderer.on('update-available', handler)
  return () => { ipcRenderer.removeListener('update-available', handler) }
},
// Repetir para: onUpdateNotAvailable, onUpdateProgress, onUpdateDownloaded, onUpdateError, onUpdateChecking
```

**Archivo:** `silver-knight/src/preload/index.d.ts`

Actualizar tipos para que cada `onUpdate*` retorne `() => void`:

```tsx
onUpdateAvailable: (callback: (version: string) => void) => (() => void)
onUpdateNotAvailable: (callback: () => void) => (() => void)
onUpdateProgress: (callback: (percent: number) => void) => (() => void)
onUpdateDownloaded: (callback: () => void) => (() => void)
onUpdateError: (callback: (error: string) => void) => (() => void)
onUpdateChecking: (callback: () => void) => (() => void)
```

**Archivo:** `silver-knight/src/renderer/src/components/UpdateNotification.tsx`

En el `useEffect`, capturar las funciones de cleanup y retornarlas:

```tsx
useEffect(() => {
  // ... existing logic ...
  const cleanups = [
    window.api.onUpdateChecking(onChecking),
    window.api.onUpdateAvailable(onAvailable),
    window.api.onUpdateNotAvailable(onNotAvailable),
    window.api.onUpdateProgress(onProgress),
    window.api.onUpdateDownloaded(onDownloaded),
    window.api.onUpdateError(onError)
  ]
  return () => { cleanups.forEach((fn) => fn()) }
}, [])
```

**Archivo:** `silver-knight/src/renderer/src/pages/SettingsPage.tsx` (líneas 222-237)

Aplicar el mismo patrón de cleanup en el useEffect de update listeners.

### 1.3 Eliminar sendSync para getVersion

**Archivo:** `silver-knight/src/preload/index.ts`

Agregar `getVersionAsync`:
```tsx
getVersionAsync: (): Promise<string> => ipcRenderer.invoke('get-app-version') as Promise<string>,
```

**Archivo:** `silver-knight/src/preload/index.d.ts`

Agregar tipo:
```tsx
getVersionAsync: () => Promise<string>
```

**Archivo:** `silver-knight/src/main/updater.ts` (línea 90-92)

El handler `ipcMain.on('get-app-version')` ya existe. Agregar también un handler invoke:
```tsx
ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})
```

**Archivo:** `silver-knight/src/renderer/src/pages/SettingsPage.tsx`

Cambiar la inicialización de `appVersion` de sync a async (buscar `getVersion` en el archivo).

## Fase 2: Tests

### 2.1 Tests para AppUpdater

**Archivo nuevo:** `silver-knight/src/main/updater.spec.ts`

Tests a escribir:
- Constructor: autoDownload=false, autoInstallOnAppQuit=true
- checkForUpdates: status → checking → available
- checkForUpdates: error handling
- downloadUpdate: solo procede si status=available
- installUpdate: solo procede si status=downloaded
- send: no crashea con mainWindow null
- startAutoCheck/stopAutoCheck: gestiona intervalo correctamente
- sendSync 'get-update-status': retorna estado correcto

Mockear: `electron-updater` (autoUpdater), `electron` (ipcMain, BrowserWindow)

### 2.2 Tests para checkAndRebuildServer

**Archivo nuevo:** `silver-knight/src/main/docker-updater.spec.ts`

Tests a escribir:
- Versiones coinciden → no rebuild, retorna {rebuilt: false}
- Versiones difieren → build + stop + start, retorna {rebuilt: true}
- Build falla → retorna error
- Start falla después de build → retorna error
- Version file no existe → treated as empty string

Mockear: `electron` (app), `fs`, `./docker` (buildCompose, stopCompose, startCompose)

## Fase 3: Integrar docker-updater

**Archivo:** `silver-knight/src/main/index.ts`

Importar:
```tsx
import { checkAndRebuildServer } from './docker-updater'
```

En el path de producción (después de `startBackend()`, antes o después de `appUpdater.startAutoCheck()`):
```tsx
const rebuildResult = await checkAndRebuildServer((line) => {
  sendSplash('splash-status', line)
})
if (rebuildResult.error) {
  log('docker-updater', `Server rebuild failed: ${rebuildResult.error}`)
}
```

Colocar esto **antes** de cerrar el splash window (línea ~330-333) para que el usuario vea el progreso.

También integrar en el handler `splash-retry` (línea ~271-297).

## Fase 4: Verificación

```bash
npm run test
npm run typecheck
npm run lint
```
