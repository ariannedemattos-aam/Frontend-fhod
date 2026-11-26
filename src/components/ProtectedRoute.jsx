import { Navigate } from 'react-router-dom'
import { can } from '../services/profileAccess'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ roles, permissions, children }) {
  const { user, restoring, error, retry } = useAuth()
  if (restoring) return <main className="public"><p className="state" role="status">Verificando sessão…</p></main>
  if (!user && error) return <main className="public">
    <p className="error" role="alert">{error.message}</p>
    <button className="secondary" onClick={retry}>Tentar novamente</button>
  </main>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/403" replace />
  if (permissions && !can(user, ...permissions)) return <Navigate to="/403" replace />
  return children
}
