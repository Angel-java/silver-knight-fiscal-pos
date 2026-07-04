import { createContext } from 'react'
import type { AuthState } from './useAuth'

export const AuthContext = createContext<AuthState | null>(null)
