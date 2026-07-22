export function parsePermissions(raw: string | null): string[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    return null
  } catch {
    return null
  }
}
