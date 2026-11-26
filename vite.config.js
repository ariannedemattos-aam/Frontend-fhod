import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const api = new URL(env.VITE_API_URL || 'http://localhost:3000/api/v1')
  return { plugins: [react()], server: { proxy: { '/api/v1/auth/web': { target: api.origin, changeOrigin: true } } } }
})
