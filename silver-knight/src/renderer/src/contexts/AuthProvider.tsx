import { useState, useEffect, useCallback, type ReactNode, type JSX } from 'react'
import { api, type User, type Company, type PermissionModule } from '../lib/api'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async (): Promise<void> => {
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
    }
    init()
  }, [])

  const login = useCallback(async (username: string, pin: string): Promise<void> => {
    const res = await api.login(username, pin)
    localStorage.setItem('token', res.token)
    setUser(res.user)
    const companyRes = await api.getCompany()
    setCompany(companyRes.company)
  }, [])

  const setup = useCallback(
    async (
      companyData: { name: string; rif: string; address?: string; phone?: string; email?: string },
      adminUser: { username: string; fullName?: string; pin: string }
    ): Promise<void> => {
      const res = await api.setup(companyData, adminUser)
      localStorage.setItem('token', res.token)
      setUser(res.user)
      setCompany(res.company)
    },
    []
  )

  const logout = useCallback((): void => {
    localStorage.removeItem('token')
    setUser(null)
  }, [])

  const hasPermission = useCallback(
    (module: PermissionModule | string): boolean => {
      if (!user) return false
      const role = user.role
      if (role === 'admin') return true
      if (role === 'operador' || role === 'gerente') {
        return user.permissions?.includes(module) ?? false
      }
      return false
    },
    [user]
  )

  return (
    <AuthContext.Provider
      value={{ user, company, loading, isReady: !loading, login, setup, logout, hasPermission }}
    >
      {children}
    </AuthContext.Provider>
  )
}
