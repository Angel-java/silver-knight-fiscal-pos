const CONNECTION_PATTERNS = [
  /fetch failed/i,
  /failed to fetch/i,
  /ENOTFOUND/i,
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /EAI_AGAIN/i,
  /network error/i,
  /unable to connect/i,
  /UND_ERR_CONNECT/i,
  /connect ECONNREFUSED/i,
  /socket hang up/i,
  /getaddrinfo/i,
  /read ECONNRESET/i,
  /abort/i,
  /timed?out/i,
  /The operation was aborted/i
]

const CLEAR_MESSAGE = 'No hay conexión a internet. Verifica tu conexión e inténtalo de nuevo.'

/**
 * Returns a human-readable Spanish message describing a connection failure, or
 * null when the error does not look like a connectivity/timeout problem.
 *
 * Used by internet-dependent features (BCV, sync, auto-update) so the operator
 * gets a clear "sin conexión" message instead of a raw technical error.
 */
export function connectionFailureMessage(err: unknown): string | null {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  for (const pattern of CONNECTION_PATTERNS) {
    if (pattern.test(message)) {
      return `${CLEAR_MESSAGE} (${err instanceof Error ? err.message : String(err)})`
    }
  }
  return null
}
