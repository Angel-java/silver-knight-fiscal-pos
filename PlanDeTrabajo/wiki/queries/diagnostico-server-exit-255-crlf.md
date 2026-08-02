---
type: query
tags: [diagnostic, docker, crash, crlf, release]
created: 2026-08-01
updated: 2026-08-02
sources: [v1.1.11, v1.1.10]
---

# Diagnóstico — Server crash loop exit 255 tras v1.1.11

## Síntoma
Tras actualizar a v1.1.11, el contenedor `silverknight-server` entra en crash loop:
`Restarting (255)`, `restarts=8`, `oomKilled=false`, y **sin logs** (`docker logs` vacío). La DB (`silverknight-db`) queda `healthy`. El self-heal de la app no lo resuelve: el one-shot `prisma db push` funciona, pero el server vuelve a morir.

## Causa raíz
El instalador v1.1.11 empaqueta `docker-entrypoint.sh` con **CRLF** (39 pares CRLF), mientras que el blob en git es **LF puro**. El checkout de CI en `windows-latest` convierte LF→CRLF (no había `.gitattributes`). La imagen Docker se construye en la máquina del usuario desde `resources/` vía `buildCompose`, así que el entrypoint llega al contenedor con CRLF.

Como el Dockerfile usa `ENTRYPOINT ["/docker-entrypoint.sh"]` (exec form, sin wrapper shell), el kernel lee el shebang `#!/bin/sh\r` → no existe el intérprete `/bin/sh\r` → el contenedor muere **antes de ejecutar cualquier línea**, con exit **255 y cero output**. Por eso no hay logs y el one-shot de prisma sí funciona (`runPrismaPushOnce` pasa `--entrypoint npx`, un binario real que evita el script shell).

## Verificación (evidencia)
- Blob git `HEAD:silver-knight/docker-entrypoint.sh`: LF puro (0 CR).
- `silver-knight-1.1.11-setup.exe` extraído con 7-Zip → `resources\docker-entrypoint.sh` = **39 CRLF**.
- `silver-knight-1.1.10-setup.exe` extraído → `resources\docker-entrypoint.sh` = **0 CRLF** (LF correcto, por eso v1.1.10 funcionaba).
- También CRLF en v1.1.11: `Dockerfile`, `docker-compose.yml`, `schema.prisma` (no fatales: solo el script shell ejecuta shebang).

## Fix aplicado (v1.1.12)
1. `.gitattributes` en raíz: `*.sh text eol=lf` (más `Dockerfile`, `*.yml`, `*.yaml`, `*.prisma`) → el checkout de CI ya no produce CRLF.
2. `Dockerfile`: `RUN sed -i 's/\r$//' /docker-entrypoint.sh` tras el COPY → defensa definitiva aunque el source llegue con CRLF.

## Verificación v1.1.12 publicada
- Setup v1.1.12 extraído con 7-Zip → `docker-entrypoint.sh` CRLF=0, `Dockerfile` CRLF=0, `docker-compose.yml` CRLF=0.
- CI release success (run 30729006469, 2m48s); `/releases/latest` → v1.1.12; `latest.yml` correcto.

## Auto-publicación de releases (fix CI post-v1.1.12)
- Hallazgo: electron-builder (`--publish always`) crea la release como **draft**, no la marca Latest y pierde el `.blockmap` (sube los assets antes de crear la release). Con el blockmap ausente electron-updater cae a descarga completa (funciona, no diferencial).
- Fix: paso "Finalize release (publish + latest + blockmap)" en `.github/workflows/release.yml` — `gh release edit <ref> --draft=false --latest` + `gh release upload <ref> dist/*.blockmap --clobber`, con `shell: bash` (los runners Windows usan pwsh por defecto; el primer intento falló con `ParserError: Missing '(' after 'if'`).
- Verificado: run 30729322485 success; v1.1.12 isDraft=false, blockmap subido, Latest resuelto.
- Implicación: futuras releases quedan publicadas y Latest automáticamente; ya no es necesario `gh release edit` manual.

## Relación
- [[docker-deployment]] — modelo de deployment Docker
- [[auditoria-optimizacion-cuelgues]] — fixes de v1.1.11 (que introdujeron el empaquetado que rompió el entrypoint)
- [[diagnostico-error-3001-post-update]] — problema de backend anterior (no relacionado)
