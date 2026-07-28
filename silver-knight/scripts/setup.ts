import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs'
import { join } from 'path'
import crypto from 'crypto'

const ROOT = join(__dirname, '..')
const ENV_PATH = join(ROOT, '.env')
const ENV_EXAMPLE_PATH = join(ROOT, '.env.example')

function generatePin(length = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.randomBytes(length)
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('')
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

function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

function buildEnvContent(vars: Record<string, string | undefined>): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) continue
    if (key === 'DATABASE_URL' || key === 'ROOT_PIN' || key === 'JWT_SECRET' || key === 'POSTGRES_PASSWORD') {
      lines.push(`${key}="${value}"`)
    } else {
      lines.push(`${key}=${value}`)
    }
  }
  return lines.join('\n') + '\n'
}

function isDefault(key: string, value: string): boolean {
  const defaults: Record<string, string[]> = {
    ROOT_PIN: ['Alucard/17432292/', ''],
    POSTGRES_PASSWORD: ['skpass', 'CHANGEME', ''],
    JWT_SECRET: ['tu-secreto-aqui', ''],
    DATABASE_URL: [
      'postgresql://silverknight:skpass@localhost:5432/silverknight?schema=public',
      'postgresql://silverknight:CHANGEME@localhost:5432/silverknight?schema=public',
      ''
    ]
  }
  return defaults[key]?.includes(value) ?? value === ''
}

function main(): void {
  console.log('')
  console.log('  Silver Knight — Setup de Seguridad')
  console.log('  ====================================')
  console.log('')

  if (!existsSync(ENV_EXAMPLE_PATH)) {
    console.error('  ERROR: .env.example no encontrado')
    process.exit(1)
  }

  if (!existsSync(ENV_PATH)) {
    console.log('  [1/3] .env no existe, creando desde .env.example')
    copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH)
  } else {
    console.log('  [1/3] .env existente encontrado')
  }

  const envContent = readFileSync(ENV_PATH, 'utf-8')
  const vars = parseEnv(envContent)

  console.log('  [2/3] Generando credenciales seguras...')
  console.log('')

  const generated: Record<string, string> = {}

  if (isDefault('ROOT_PIN', vars['ROOT_PIN'] || '')) {
    generated['ROOT_PIN'] = generatePin()
    vars['ROOT_PIN'] = generated['ROOT_PIN']
    console.log('    ROOT_PIN:          ' + generated['ROOT_PIN'] + ' (nuevo)')
  } else {
    console.log('    ROOT_PIN:          (ya configurado, no se modifica)')
  }

  if (isDefault('POSTGRES_PASSWORD', vars['POSTGRES_PASSWORD'] || '')) {
    generated['POSTGRES_PASSWORD'] = generatePassword()
    vars['POSTGRES_PASSWORD'] = generated['POSTGRES_PASSWORD']
    console.log('    POSTGRES_PASSWORD: ' + generated['POSTGRES_PASSWORD'] + ' (nuevo)')
  } else {
    console.log('    POSTGRES_PASSWORD: (ya configurado, no se modifica)')
  }

  if (isDefault('JWT_SECRET', vars['JWT_SECRET'] || '')) {
    generated['JWT_SECRET'] = generateSecret()
    vars['JWT_SECRET'] = generated['JWT_SECRET']
    console.log('    JWT_SECRET:        ' + generated['JWT_SECRET'].slice(0, 8) + '... (nuevo, 64 chars)')
  } else {
    console.log('    JWT_SECRET:        (ya configurado, no se modifica)')
  }

  const pgUser = vars['POSTGRES_USER'] || 'silverknight'
  const pgPassword = vars['POSTGRES_PASSWORD']
  const pgHost = vars['POSTGRES_HOST'] || 'localhost'
  const pgPort = vars['POSTGRES_PORT'] || '5432'
  const pgDb = vars['POSTGRES_DB'] || 'silverknight'

  const newDbUrl = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDb}?schema=public`

  if (isDefault('DATABASE_URL', vars['DATABASE_URL'] || '') || vars['DATABASE_URL'] !== newDbUrl) {
    vars['DATABASE_URL'] = newDbUrl
    generated['DATABASE_URL'] = '(reconstruido con nuevo password)'
    console.log('    DATABASE_URL:      reconstruido con nuevo password')
  } else {
    console.log('    DATABASE_URL:      (ya configurado, no se modifica)')
  }

  console.log('')
  console.log('  [3/3] Guardando .env')

  const envOutput = buildEnvContent(vars)
  writeFileSync(ENV_PATH, envOutput, 'utf-8')

  console.log('')
  console.log('  ====================================')
  console.log('  Setup completo. Credenciales guardadas en:')
  console.log('    .env  (app + prisma + docker)')
  console.log('')
  console.log('  IMPORTANTE: No commitear .env al repo.')
  console.log('  ====================================')
  console.log('')
}

main()
