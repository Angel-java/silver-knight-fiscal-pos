import { describe, it, expect } from 'vitest'
import { connectionFailureMessage } from '../connectionError'

describe('connectionFailureMessage', () => {
  it('detects fetch failed', () => {
    expect(connectionFailureMessage(new Error('fetch failed'))).toContain('No hay conexión')
  })

  it('detects DNS/ENOTFOUND', () => {
    expect(connectionFailureMessage(new Error('getaddrinfo ENOTFOUND api.example.com'))).toContain(
      'No hay conexión'
    )
  })

  it('detects ECONNREFUSED / ECONNRESET', () => {
    expect(connectionFailureMessage(new Error('connect ECONNREFUSED 127.0.0.1:3000'))).toContain(
      'No hay conexión'
    )
    expect(connectionFailureMessage(new Error('read ECONNRESET'))).toContain('No hay conexión')
  })

  it('detects network errors and timeouts', () => {
    expect(connectionFailureMessage(new Error('network error'))).toContain('No hay conexión')
    expect(connectionFailureMessage(new Error('The operation was aborted'))).toContain(
      'No hay conexión'
    )
    expect(connectionFailureMessage(new TypeError('Failed to fetch'))).toContain('No hay conexión')
  })

  it('includes the technical cause in the message', () => {
    const msg = connectionFailureMessage(new Error('fetch failed'))
    expect(msg).toContain('fetch failed')
  })

  it('returns null for non-connection errors', () => {
    expect(connectionFailureMessage(new Error('Invalid credentials'))).toBeNull()
    expect(connectionFailureMessage(new Error('HTTP 500 Internal Server Error'))).toBeNull()
    expect(connectionFailureMessage(new Error('Validation failed'))).toBeNull()
    expect(connectionFailureMessage('some plain string')).toBeNull()
  })
})
