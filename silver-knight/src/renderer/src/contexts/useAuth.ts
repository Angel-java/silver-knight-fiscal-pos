import { useContext } from 'react'
import { AuthContext } from './AuthContext'
import type { User, Company, PermissionModule } from '../lib/api'

export type { User, Company }

export interface AuthState {
  user: User | null
  company: Company | null
  loading: boolean
  isReady: boolean
  login: (username: string, pin: string) => Promise<void>
  setup: (
    profile: 'small' | 'medium' | 'big',
    company: { name: string; rif: string; address?: string; phone?: string; email?: string },
    adminUser: { username: string; fullName?: string; pin: string }
  ) => Promise<void>
  logout: () => void
  hasPermission: (module: PermissionModule | string) => boolean
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
