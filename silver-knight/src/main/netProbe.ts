import { net } from 'electron'
import { log } from './logger'

const DEFAULT_PROBE_URL = 'https://registry.npmjs.org/'
const PROBE_TIMEOUT_MS = 5000
const PROBE_ATTEMPTS = 2
const RETRY_DELAY_MS = 800

let forceOnlineOverride: boolean | null = null
let forceFetchResult: { ok: boolean; throws?: boolean } | null = null

/**
 * Test hook only. When set, isReallyOnline() returns this value without
 * probing the network, and fetchResult controls the synthetic fetch outcome.
 */
export function __setOnlineOverrideForTests(value: boolean | null): void {
  forceOnlineOverride = value
}

export function __setFetchResultForTests(result: { ok: boolean; throws?: boolean } | null): void {
  forceFetchResult = result
}

async function probeFetch(url: string, deadlineMs: number): Promise<boolean> {
  if (forceFetchResult) {
    if (forceFetchResult.throws) throw new Error('synthetic network error')
    return forceFetchResult.ok
  }
  const res = await fetch(url, {
    method: 'HEAD',
    signal: AbortSignal.timeout(deadlineMs)
  })
  return res.ok || res.status < 500
}

/**
 * Best-effort connectivity check. Returns false only when we are reasonably
 * confident there is no internet, so the caller can safely rely on caches.
 *
 * Order of checks (cheap first, conclusive later):
 *  1. net.isOnline() === false -> queued offline (no probe needed).
 *  2. Otherwise probe a stable host with a short timeout, retrying a couple
 *     of times. A successful response means online; repeated failures mean
 *     we should treat the machine as offline even if net.isOnline() lied true
 *     (falso positivo por DNS/antivirus/red intermedia).
 */
export async function isReallyOnline(): Promise<boolean> {
  if (forceOnlineOverride !== null) {
    log('netprobe', `Offline override (test): ${forceOnlineOverride}`)
    return forceOnlineOverride
  }

  if (!net.isOnline()) {
    log('netprobe', 'net.isOnline() false -> treated as offline (no probe)')
    return false
  }

  let lastErr: unknown = null
  for (let attempt = 1; attempt <= PROBE_ATTEMPTS; attempt++) {
    try {
      const ok = await probeFetch(DEFAULT_PROBE_URL, PROBE_TIMEOUT_MS)
      if (ok) {
        log('netprobe', `Connectivity confirmed (attempt ${attempt})`)
        return true
      }
      lastErr = new Error('probe returned non-OK status')
    } catch (err) {
      lastErr = err
      log('netprobe', `Probe failed (attempt ${attempt}/${PROBE_ATTEMPTS}): ${err}`)
    }
    if (attempt < PROBE_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    }
  }

  log('netprobe', `All probes failed (${PROBE_ATTEMPTS} attempts) -> treated as offline`)
  log('netprobe', `Last probe error: ${lastErr}`)
  return false
}
