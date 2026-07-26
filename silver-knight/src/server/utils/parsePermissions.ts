import { permissionModules } from '../validation/schemas'

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

export function resolvePermissions(raw: string | null, role: string): string[] {
  if (role === 'root') return [...permissionModules]
  const parsed = parsePermissions(raw)
  if (parsed && parsed.length > 0) return parsed
  return [...permissionModules]
}
