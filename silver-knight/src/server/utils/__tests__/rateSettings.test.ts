import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { evaluateRateVigency, parseVigencyDays } from '../rateSettings'

const FIXED_NOW = new Date('2026-07-04T12:00:00Z')

describe('rateSettings', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('parseVigencyDays', () => {
    it('defaults to 1 day when absent', () => {
      expect(parseVigencyDays(undefined)).toBe(1)
    })

    it('parses a valid numeric string', () => {
      expect(parseVigencyDays('5')).toBe(5)
    })

    it('clamps to a minimum of 1 day', () => {
      expect(parseVigencyDays('0')).toBe(1)
      expect(parseVigencyDays('-3')).toBe(1)
    })

    it('falls back to 1 for invalid input', () => {
      expect(parseVigencyDays('abc')).toBe(1)
    })
  })

  describe('evaluateRateVigency', () => {
    it('is invalid when there is no rate date', () => {
      expect(evaluateRateVigency({ vigencyDays: 1, rateDate: undefined })).toEqual({
        vigencyDays: 1,
        valid: false
      })
    })

    it('is valid for a rate newer than the vigency window', () => {
      const result = evaluateRateVigency({
        vigencyDays: 1,
        rateDate: new Date('2026-07-04T11:00:00Z') // 1h ago
      })
      expect(result.valid).toBe(true)
    })

    it('is invalid when the rate is older than the vigency window', () => {
      const result = evaluateRateVigency({
        vigencyDays: 1,
        rateDate: new Date('2026-06-30T11:00:00Z') // 4 days ago
      })
      expect(result.valid).toBe(false)
      expect(result.rateAgeDays).toBeGreaterThan(1)
    })

    it('respects a configured longer vigency', () => {
      const result = evaluateRateVigency({
        vigencyDays: 7,
        rateDate: new Date('2026-06-30T11:00:00Z') // 4 days ago
      })
      expect(result.valid).toBe(true)
    })

    it('returns exact age in days', () => {
      const result = evaluateRateVigency({
        vigencyDays: 1,
        rateDate: new Date('2026-07-02T12:00:00Z') // exactly 2 days
      })
      expect(result.valid).toBe(false)
      expect(result.rateAgeDays).toBe(2)
    })
  })
})
