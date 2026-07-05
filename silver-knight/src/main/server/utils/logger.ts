const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
type LogLevel = keyof typeof LOG_LEVELS

const currentLevel: LogLevel = (process.env['LOG_LEVEL'] as LogLevel) || 'info'

function timestamp(): string {
  return new Date().toISOString()
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function fmt(val: unknown): string {
  if (val instanceof Error) return val.stack || val.message
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val)
    } catch {
      return String(val)
    }
  }
  return String(val)
}

function formatArgs(module: string, message: string, args?: unknown[]): string {
  const base = `[${timestamp()}] [${module}] ${message}`
  if (!args || args.length === 0) return base
  return `${base} ${args.map(fmt).join(' ')}`
}

function log(
  level: LogLevel,
  consoleFn: (...a: unknown[]) => void,
  module: string,
  message: unknown,
  args: unknown[]
): void {
  if (!shouldLog(level)) return
  const msgStr = fmt(message)
  consoleFn(formatArgs(module, msgStr, args))
}

export const logger = {
  info(module: string, message: unknown, ...args: unknown[]): void {
    log('info', console.log, module, message, args)
  },
  warn(module: string, message: unknown, ...args: unknown[]): void {
    log('warn', console.warn, module, message, args)
  },
  error(module: string, message: unknown, ...args: unknown[]): void {
    log('error', console.error, module, message, args)
  },
  debug(module: string, message: unknown, ...args: unknown[]): void {
    log('debug', console.debug, module, message, args)
  }
}
