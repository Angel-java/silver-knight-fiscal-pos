const DEFAULT_VIGENCY_DAYS = 1

export interface RateVigencyInput {
  vigencyDays?: string | number
  rateDate?: Date
}

export interface RateVigencyResult {
  vigencyDays: number
  /** true cuando hay una tasa y su antigüedad no supera la vigencia */
  valid: boolean
  /** edad de la tasa vigente en días, si aplica */
  rateAgeDays?: number
}

/**
 * Evalúa si la tasa registrada (rateDate) sigue en vigencia según la
 * configuración bcvRateVigencyDays. Sin tasa (rateDate undefined) -> no válida.
 */
export function evaluateRateVigency({
  vigencyDays,
  rateDate
}: RateVigencyInput): RateVigencyResult {
  const days = Math.max(1, Math.floor(Number(vigencyDays) || DEFAULT_VIGENCY_DAYS))

  if (!rateDate) {
    return { vigencyDays: days, valid: false }
  }

  const rateTs = new Date(rateDate).getTime()
  if (Number.isNaN(rateTs)) {
    return { vigencyDays: days, valid: false }
  }

  const now = Date.now()
  const ageMs = now - rateTs
  const ageDays = ageMs / (24 * 60 * 60 * 1000)

  if (ageDays <= days) {
    return { vigencyDays: days, valid: true, rateAgeDays: ageDays }
  }

  return { vigencyDays: days, valid: false, rateAgeDays: ageDays }
}

/** Convierte un mapa de settings (string->string) en Result, p. ej. para tests. */
export function parseVigencyDays(raw: string | undefined): number {
  return Math.max(1, Math.floor(Number(raw) || DEFAULT_VIGENCY_DAYS))
}
