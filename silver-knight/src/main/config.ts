import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, chmodSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import crypto from 'crypto'
import { log } from './logger'

const CONFIG_VERSION = '1.0.0'

function getConfigDir(): string {
  return join(app.getPath('userData'), 'config')
}

function getEnvPath(): string {
  return join(getConfigDir(), '.env')
}

function getVersionPath(): string {
  return join(getConfigDir(), '.version')
}

function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

function buildEnvContent(vars: Record<string, string>): string {
  const sensitiveKeys = ['DATABASE_URL', 'ROOT_PIN', 'JWT_SECRET', 'POSTGRES_PASSWORD']
  const lines: string[] = []
  for (const [key, value] of Object.entries(vars)) {
    if (sensitiveKeys.includes(key)) {
      lines.push(`${key}="${value}"`)
    } else {
      lines.push(`${key}=${value}`)
    }
  }
  return lines.join('\n') + '\n'
}

function generatePassword(length = 20): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.randomBytes(length)
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('')
}

function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

function writeEnvSecure(vars: Record<string, string>): void {
  const dir = getConfigDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const envPath = getEnvPath()
  writeFileSync(envPath, buildEnvContent(vars), 'utf-8')

  try {
    chmodSync(envPath, 0o600)
  } catch {
    // chmod may fail on Windows, that's ok
  }

  log('write', `Config saved to ${envPath}`)
}

function writeVersion(version: string): void {
  writeFileSync(getVersionPath(), version, 'utf-8')
}

function readVersion(): string {
  try {
    if (existsSync(getVersionPath())) {
      return readFileSync(getVersionPath(), 'utf-8').trim()
    }
  } catch {
    // ignore
  }
  return ''
}

function rebuildDatabaseUrl(vars: Record<string, string>): string {
  const pgUser = vars['POSTGRES_USER'] || 'silverknight'
  const pgPassword = vars['POSTGRES_PASSWORD']
  const pgHost = vars['POSTGRES_HOST'] || 'localhost'
  const pgPort = vars['POSTGRES_PORT'] || '5432'
  const pgDb = vars['POSTGRES_DB'] || 'silverknight'
  return `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDb}?schema=public`
}

// --- Public API ---

export function loadEnvForChild(): Record<string, string> {
  const envPath = getEnvPath()
  if (!existsSync(envPath)) return {}
  try {
    return parseEnv(readFileSync(envPath, 'utf-8'))
  } catch {
    return {}
  }
}

export function detectExistingDockerVolume(): boolean {
  try {
    const output = execSync(
      'docker volume inspect silverknight-pgdata --format "{{.CreatedAt}}"',
      { timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString().trim()
    const exists = !!output
    log('detect', `Docker volume exists: ${exists}`)
    return exists
  } catch {
    log('detect', 'Docker volume not found')
    return false
  }
}

export function ensureConfig(): boolean {
  const envPath = getEnvPath()
  if (!existsSync(envPath)) {
    log('check', 'No .env found in userData/config/')
    return false
  }

  try {
    const content = readFileSync(envPath, 'utf-8')
    const vars = parseEnv(content)
    if (!vars['POSTGRES_PASSWORD'] || !vars['ROOT_PIN']) {
      log('check', '.env exists but is missing required fields')
      return false
    }
    log('check', 'Config found and valid')
    return true
  } catch {
    log('check', 'Failed to read .env')
    return false
  }
}

export function readConfig(): Record<string, string> {
  const envPath = getEnvPath()
  if (!existsSync(envPath)) return {}
  try {
    return parseEnv(readFileSync(envPath, 'utf-8'))
  } catch {
    return {}
  }
}

export function migrateFromLegacy(): Record<string, string> | null {
  const legacyPaths = [
    join(process.resourcesPath, '.env'),
    join(process.resourcesPath, '..', '.env'),
    join(app.getAppPath(), '.env')
  ]

  for (const legacyPath of legacyPaths) {
    if (!existsSync(legacyPath)) continue

    log('migrate', `Found legacy .env at ${legacyPath}`)

    try {
      const content = readFileSync(legacyPath, 'utf-8')
      const vars = parseEnv(content)

      if (vars['POSTGRES_PASSWORD'] && vars['ROOT_PIN']) {
        writeEnvSecure(vars)
        log('migrate', `Successfully migrated .env from ${legacyPath}`)

        try {
          unlinkSync(legacyPath)
          log('migrate', `Removed legacy .env at ${legacyPath}`)
        } catch {
          log('migrate', `Could not remove legacy .env at ${legacyPath} (non-critical)`)
        }

        return vars
      }

      log('migrate', `Legacy .env at ${legacyPath} missing required fields, skipping`)
    } catch {
      log('migrate', `Failed to read legacy .env at ${legacyPath}`)
    }
  }

  return null
}

export function migrateConfig(): boolean {
  const storedVersion = readVersion()
  if (storedVersion === CONFIG_VERSION) {
    return false
  }

  log('migrate', `Config version mismatch: stored="${storedVersion}", current="${CONFIG_VERSION}"`)

  const vars = readConfig()

  if (!vars['ROOT_USERNAME']) {
    vars['ROOT_USERNAME'] = 'admin'
  }

  writeEnvSecure(vars)
  writeVersion(CONFIG_VERSION)
  log('migrate', `Config migrated to version ${CONFIG_VERSION}`)
  return true
}

export function saveConfigFromWizard(data: {
  rootPin: string
  postgresPassword?: string
}): Record<string, string> {
  const pgPassword = data.postgresPassword || generatePassword()

  const vars: Record<string, string> = {
    POSTGRES_USER: 'silverknight',
    POSTGRES_PASSWORD: pgPassword,
    POSTGRES_DB: 'silverknight',
    POSTGRES_HOST: 'localhost',
    POSTGRES_PORT: '5432',
    DATABASE_URL: '',
    ROOT_PIN: data.rootPin,
    ROOT_USERNAME: 'admin',
    JWT_SECRET: generateSecret(),
    PORT: '3001',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: '*'
  }

  vars['DATABASE_URL'] = rebuildDatabaseUrl(vars)

  writeEnvSecure(vars)
  writeVersion(CONFIG_VERSION)

  log('wizard', 'Config saved from wizard')
  return vars
}
