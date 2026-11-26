const marker = 'fhdod_browser_session'
const storage = typeof sessionStorage === 'undefined' ? null : sessionStorage
const roles = { userAdmin: 'UserAdmin', userSetor: 'UserSetor' }
const listeners = new Set()
let state = { user: null, token: null, restoring: Boolean(storage?.getItem(marker)), error: null }
let renewing
let revision = 0

function update(next) {
  state = next
  listeners.forEach(listener => listener())
}

function save(data) {
  storage?.setItem(marker, data.user.id)
  const user = { ...data.user, role: roles[data.user.role] ?? data.user.role }
  update({ user, token: data.accessToken, restoring: false, error: null })
  return user
}

function end(error = null) {
  storage?.removeItem(marker)
  update({ user: null, token: null, restoring: false, error })
}

async function request(path, data) {
  let response
  try {
    response = await fetch('/api/v1/auth/web/' + path, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data ?? {}),
      signal: AbortSignal.timeout(18000),
    })
  } catch { throw new Error('Conexão indisponível. Tente novamente.') }
  if (response.status === 204) return null
  const result = await response.json().catch(() => ({}))
  if (!response.ok || !result.data) {
    const error = new Error(result.errors?.[0]?.message || result.message || 'Não foi possível verificar a sessão.')
    error.status = response.status
    throw error
  }
  return result.data
}

function exclusive(work) {
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('fhdod-auth-session', work)
    : work()
}

export function renewSession() {
  if (renewing) return renewing
  const expectedUser = state.user?.id || storage?.getItem(marker)
  if (!expectedUser) return Promise.reject(new Error('Faça login para continuar.'))
  const starting = revision
  renewing = exclusive(async () => {
    if (starting !== revision) return
    if (!state.user) update({ ...state, restoring: true, error: null })
    try {
      let session
      try { session = await request('refresh') }
      catch (error) {
        if (error.status !== 409) throw error
        await new Promise(resolve => setTimeout(resolve, 350))
        session = await request('refresh')
      }
      if (starting === revision) {
        if (session.user.id !== expectedUser) {
          const error = new Error('A conta da sessão mudou. Faça login para continuar.')
          error.status = 401
          throw error
        }
        save(session)
      }
    } catch (error) {
      if (starting === revision) {
        if (error.status === 401) end()
        else if (!state.user) update({ ...state, restoring: false, error })
      }
      throw error
    }
  }).finally(() => { renewing = undefined })
  return renewing
}

export const authService = {
  state: () => state,
  subscribe: listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  accessToken: () => state.token,
  restore: () => renewSession().catch(() => {}),
  forgetLegacy: () => {
    for (const key of ['fhdod_token', 'fhdod_refresh_token', 'fhdod_user']) storage?.removeItem(key)
  },
  async login(credentials) {
    ++revision
    return exclusive(async () => save(await request('login', credentials)))
  },
  async logout() {
    ++revision
    await exclusive(async () => {
      try { await request('logout'); end() }
      catch {
        end()
        throw new Error('Sessão local encerrada. A conexão impediu confirmar o encerramento no servidor.')
      }
    })
  },
}

export function accessExpiry(token) {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(encoded)).exp * 1000
  } catch { return 0 }
}
