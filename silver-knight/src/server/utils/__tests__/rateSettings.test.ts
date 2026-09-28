import { describe, it, expect } from 'vitest'
import {
  caracasDayStart,
  caracasDayEnd,
  rateEffectiveDayStart,
  rateValidUntil,
  isRateOld,
  resolveActiveRate,
  type RateLike
} from '../rateSettings'

// Caracas = UTC-4 fijo. El día calendario de Caracas del 2026-07-04 va de
// 2026-07-04T04:00:00Z a 2026-07-05T03:59:59.999Z.
const day = (iso: string): Date => new Date(iso)

const rate = (id: string, iso: string, value = 50, effectiveDate?: string | null): RateLike => ({
  id,
  rate: value,
  source: 'manual',
  date: new Date(iso),
  ...(effectiveDate === undefined ? {} : { effectiveDate: effectiveDate ? new Date(effectiveDate) : null })
})

describe('caracasDayStart / caracasDayEnd', () => {
  it('resuelve el inicio del día de Caracas (UTC-4)', () => {
    expect(caracasDayStart(day('2026-07-04T12:00:00Z').getTime())).toBe(
      day('2026-07-04T04:00:00Z').getTime()
    )
  })

  it('una hora antes de la medianoche UTC aún es el día anterior en Caracas', () => {
    expect(caracasDayStart(day('2026-07-04T03:00:00Z').getTime())).toBe(
      day('2026-07-03T04:00:00Z').getTime()
    )
  })

  it('resuelve el fin del día de Caracas', () => {
    expect(caracasDayEnd(day('2026-07-04T12:00:00Z').getTime())).toBe(
      day('2026-07-05T03:59:59.999Z').getTime()
    )
  })
})

describe('rateEffectiveDayStart — el día al que corresponde la tasa', () => {
  it('usa effectiveDate cuando está presente (tasa publicada con anticipación)', () => {
    // Capturada el viernes 24 pero corresponde al lunes 27 (publicada con anticipación).
    const r = rate('fri', '2026-07-24T14:00:00Z', 50, '2026-07-27T12:00:00Z')
    expect(rateEffectiveDayStart(r)).toBe(day('2026-07-27T04:00:00Z').getTime())
  })

  it('sin effectiveDate usa el día de captura (tasas antiguas)', () => {
    const r = rate('legacy', '2026-07-24T22:00:00Z')
    expect(rateEffectiveDayStart(r)).toBe(day('2026-07-24T04:00:00Z').getTime())
  })

  it('effectiveDate explícitamente null cae al día de captura', () => {
    const r = rate('legacy', '2026-07-24T22:00:00Z', 50, null)
    expect(rateEffectiveDayStart(r)).toBe(day('2026-07-24T04:00:00Z').getTime())
  })
})

describe('rateValidUntil — vigente hasta que se acabe el día', () => {
  it('el fin del día es la medianoche de Caracas del día siguiente (último ms)', () => {
    const r = rate('mon', '2026-07-27T14:00:00Z', 55)
    expect(rateValidUntil(r)).toBe(day('2026-07-28T03:59:59.999Z').getTime())
  })

  it('una tasa con fecha del lunes es válida hasta que se acabe el lunes', () => {
    const r = rate('fri', '2026-07-24T14:00:00Z', 50, '2026-07-27T12:00:00Z')
    expect(rateValidUntil(r)).toBe(day('2026-07-28T03:59:59.999Z').getTime())
  })
})

describe('isRateOld — la tasa queda vieja cuando se pasa su día', () => {
  it('antes de que se acabe el día NO está vieja', () => {
    const r = rate('today', '2026-07-27T09:00:00Z')
    expect(isRateOld(r, day('2026-07-27T23:00:00Z'))).toBe(false)
  })

  it('en cuanto se acaba el día está vieja', () => {
    const r = rate('yesterday', '2026-07-26T09:00:00Z')
    expect(isRateOld(r, day('2026-07-27T04:00:00Z'))).toBe(true)
  })

  it('publicada el viernes con fecha del lunes: no está vieja el fin de semana', () => {
    const r = rate('fri', '2026-07-24T14:00:00Z', 50, '2026-07-27T12:00:00Z')
    expect(isRateOld(r, day('2026-07-26T15:00:00Z'))).toBe(false) // sábado
    expect(isRateOld(r, day('2026-07-27T23:00:00Z'))).toBe(false) // lunes
    expect(isRateOld(r, day('2026-07-28T04:00:00Z'))).toBe(true) // martes 0:00 Caracas
  })
})

describe('resolveActiveRate — la captura más reciente es la activa', () => {
  it('sin capturas -> rate null y old false', () => {
    const r = resolveActiveRate([], day('2026-07-26T12:00:00Z'))
    expect(r.rate).toBeNull()
    expect(r.old).toBe(false)
  })

  it('una captura futura nunca es activa', () => {
    const future = [rate('future', '2026-08-03T14:00:00Z', 60)]
    const r = resolveActiveRate(future, day('2026-07-24T12:00:00Z'))
    expect(r.rate).toBeNull()
  })

  it('antes de una captura usa la inmediatamente anterior', () => {
    const rates = [rate('friday', '2026-07-24T14:00:00Z'), rate('monday', '2026-07-27T14:00:00Z', 55)]
    const r = resolveActiveRate(rates, day('2026-07-25T18:00:00Z'))
    expect(r.rate?.id).toBe('friday')
  })

  it('en cuanto llega una captura nueva, la usa', () => {
    const rates = [rate('friday', '2026-07-24T14:00:00Z'), rate('monday', '2026-07-27T14:00:00Z', 55)]
    const r = resolveActiveRate(rates, day('2026-07-27T15:00:00Z'))
    expect(r.rate?.id).toBe('monday')
    expect(r.rate?.rate).toBe(55)
  })

  it('capturas múltiples el mismo día: manda la más reciente (timestamp)', () => {
    const rates = [
      rate('early', '2026-07-27T08:00:00Z'),
      rate('late', '2026-07-27T20:00:00Z', 52)
    ]
    const r = resolveActiveRate(rates, day('2026-07-27T21:00:00Z'))
    expect(r.rate?.id).toBe('late')
  })
})

describe('resolveActiveRate — old: se deriva del día de la tasa, nunca bloquea', () => {
  it('tasa vigente -> old false', () => {
    const rates = [rate('today', '2026-07-27T09:00:00Z', 52)]
    const r = resolveActiveRate(rates, day('2026-07-27T15:00:00Z'))
    expect(r.rate?.id).toBe('today')
    expect(r.old).toBe(false)
  })

  it('tasa del lunes publicada el viernes -> vigente el fin de semana, vieja el martes', () => {
    const rates = [rate('fri', '2026-07-24T14:00:00Z', 50, '2026-07-27T12:00:00Z')]
    const sabado = resolveActiveRate(rates, day('2026-07-26T15:00:00Z'))
    expect(sabado.rate?.id).toBe('fri')
    expect(sabado.old).toBe(false)

    const martes = resolveActiveRate(rates, day('2026-07-28T12:00:00Z'))
    expect(martes.rate?.id).toBe('fri') // sigue siendo la única/activa
    expect(martes.old).toBe(true)
  })

  it('tasa antigua (día de captura ya pasado) -> old true pero sigue activa', () => {
    const rates = [rate('old', '2026-06-01T12:00:00Z', 40)]
    const r = resolveActiveRate(rates, day('2026-07-26T15:00:00Z'))
    expect(r.rate?.id).toBe('old')
    expect(r.old).toBe(true)
  })
})