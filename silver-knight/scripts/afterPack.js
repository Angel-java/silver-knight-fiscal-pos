// afterPack hook: copies Prisma generated client and engine binaries
// into the output directory so they're accessible at runtime.
//
// electron-builder excludes .prisma/ (dot-directory) and @prisma/engines
// (not in dependency tree) from the file copy. This hook copies them to
// the correct node_modules location regardless of asar mode.

const { cpSync, existsSync } = require('fs')
const { join } = require('path')

module.exports = function afterPack(context) {
  const { appOutDir, packager } = context
  const projectDir = packager.projectDir || process.cwd()
  const srcNodeModules = join(projectDir, 'node_modules')

  // Determine destination: with asar, files go to app.asar.unpacked;
  // without asar, files go directly to resources/app.
  const appRoot = existsSync(join(appOutDir, 'resources', 'app.asar'))
    ? join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules')
    : join(appOutDir, 'resources', 'app', 'node_modules')

  const dirs = [
    { src: '.prisma', dst: '.prisma' },
    { src: join('@prisma', 'engines'), dst: join('@prisma', 'engines') }
  ]

  for (const { src, dst } of dirs) {
    const srcPath = join(srcNodeModules, src)
    const dstPath = join(appRoot, dst)

    if (!existsSync(srcPath)) {
      console.warn(`[afterPack] Source not found, skipping: ${srcPath}`)
      continue
    }

    cpSync(srcPath, dstPath, { recursive: true })
    console.log(`[afterPack] Copied ${src} -> ${dstPath}`)
  }
}
