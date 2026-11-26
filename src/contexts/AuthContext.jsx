import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { accessExpiry, authService, renewSession } from '../services/authService'

const Context = createContext(null)
export const useAuth = () => useContext(Context)

export function AuthProvider({ children }) {
  const session = useSyncExternalStore(authService.subscribe, authService.state)
  const client = useQueryClient()
  const previousUser = useRef(null)
  useEffect(() => {
    authService.forgetLegacy()
    if (authService.state().restoring) authService.restore()
  }, [])
  useEffect(() => {
    if (previousUser.current && previousUser.current !== session.user?.id) client.clear()
    previousUser.current = session.user?.id
  }, [client, session.user?.id])
  useEffect(() => {
    if (!session.token) return
    const timeout = setTimeout(() => renewSession().catch(() => {}), Math.max(1000, accessExpiry(session.token) - Date.now() - 30000))
    return () => clearTimeout(timeout)
  }, [session.token])
  return <Context.Provider value={{ ...session, login: authService.login, logout: authService.logout, retry: authService.restore }}>{children}</Context.Provider>
}
