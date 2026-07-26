import { useState, useEffect, useCallback, type ReactNode, type JSX } from 'react'
import { api, type User, type Company, type PermissionModule } from '../lib/api'
import { AuthContext } from './AuthContext'

const rlog = (tag: string, msg: string): void => {
  try { window.electron?.send('renderer-log', 'INFO', tag, msg) } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    rlog('auth', 'AuthProvider init: loading=' + loading)
    const init = async (): Promise<void> => {
      try {
        const companyRes = await api.getCompany()
        rlog('auth', `getCompany: ${JSON.stringify(companyRes.company)}`)
        setCompany(companyRes.company)

        const token = localStorage.getItem('token')
        if (token) {
          const meRes = await api.me()
          rlog('auth', `me: user=${JSON.stringify(meRes.user)}`)
          setUser(meRes.user)
        } else {
          rlog('auth', 'No token, skipping me()')
        }
      } catch (err) {
        rlog('auth', `init error: ${err}`)
        localStorage.removeItem('token')
      } finally {
        rlog('auth', 'init done, setting loading=false')
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
      profile: 'small' | 'medium' | 'big',
      companyData: { name: string; rif: string; address?: string; phone?: string; email?: string },
      adminUser: { username: string; fullName?: string; pin: string }
    ): Promise<void> => {
      const res = await api.setup(profile, companyData, adminUser)
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
      if (user.role === 'root') return true
      return user.permissions?.includes(module) ?? false
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
