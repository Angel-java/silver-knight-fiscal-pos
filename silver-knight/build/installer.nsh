; Silver Knight — NSIS custom routine hooks.
; Clean the watchdog startup entry on uninstall so a removed install
; stops trying to self-repair at every login.

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "SilverKnightWatchdog"
!macroend

; Keep the atomic (silent) installer flag for watch mode re-installs.
; runAfterFinish is managed by electron-builder and auto-relaunches the app.