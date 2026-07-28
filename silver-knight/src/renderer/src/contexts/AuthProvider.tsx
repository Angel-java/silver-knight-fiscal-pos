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

    const waitForServer = async (maxRetries = 10, delayMs = 2000): Promise<boolean> => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          rlog('auth', `Health check attempt ${i + 1}/${maxRetries}`)
          await api.health()
          return true
        } catch {
          rlog('auth', `Server not ready, retrying in ${delayMs}ms...`)
          await new Promise((r) => setTimeout(r, delayMs))
        }
      }
      return false
    }

    const init = async (): Promise<void> => {
      try {
        const serverReady = await waitForServer()
        if (!serverReady) {
          rlog('auth', 'Server did not become ready after retries')
          setLoading(false)
          return
        }

        rlog('auth', 'Server is ready, fetching data...')
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
