import axios from 'axios'
import { authService, renewSession } from './authService'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})
function needsIdentity(url) {
  return /^\/(?:admin\/|questions(?:[/?]|$)|notifications(?:[/?]|$)|auth\/me(?:[?]|$))/.test(url ?? '')
}
api.interceptors.request.use(config => {
  if (needsIdentity(config.url)) {
    const token = authService.accessToken()
    if (token) {
      config.headers.Authorization = 'Bearer ' + token
      config.authUsed = token
    }
  }
  return config
})

async function retryUnauthorized(response) {
  const config = response?.config
  if (response?.status !== 401 || !config?.authUsed || config.authRetried || config.signal?.aborted) return
  config.authRetried = true
  const current = authService.accessToken()
  if (current && current === config.authUsed) await renewSession()
  if (!authService.accessToken()) return
  return api.request(config)
}
api.interceptors.response.use(
  async response => (await retryUnauthorized(response)) ?? response.data,
  async error => {
    const renewed = await retryUnauthorized(error.response)
    if (renewed) return renewed
    const data = error.response?.data
    throw new Error(data?.errors?.[0]?.message || data?.message || 'Não conseguimos carregar as informações. Tente novamente.')
  },
)
export const unwrap = response => response?.data ?? response
export const surveyHeaders = token => ({ headers: { 'X-Survey-Token': token } })
