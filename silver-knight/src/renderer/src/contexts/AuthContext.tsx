import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api, type User, type Company } from '../lib/api'

interface AuthState {
  user: User | null
  company: Company | null
  loading: boolean
  isReady: boolean
  login: (username: string, pin: string) => Promise<void>
  setup: (
    company: { name: string; rif: string; address?: string; phone?: string; email?: string },
    adminUser: { username: string; pin: string }
  ) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSession = useCallback(async () => {
    try {
      const companyRes = await api.getCompany()
      setCompany(companyRes.company)

      const token = localStorage.getItem('token')
      if (token) {
        const meRes = await api.me()
        setUser(meRes.user)
      }
    } catch {
      localStorage.removeItem('token')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  const login = useCallback(async (username: string, pin: string) => {
    const res = await api.login(username, pin)
    localStorage.setItem('token', res.token)
    setUser(res.user)
    const companyRes = await api.getCompany()
    setCompany(companyRes.company)
  }, [])

  const setup = useCallback(
    async (
      companyData: { name: string; rif: string; address?: string; phone?: string; email?: string },
      adminUser: { username: string; pin: string }
    ) => {
      const res = await api.setup(companyData, adminUser)
      localStorage.setItem('token', res.token)
      setUser(res.user)
      setCompany(res.company)
    },
    []
  )

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setUser(null)
    setCompany(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, company, loading, isReady: !loading, login, setup, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
