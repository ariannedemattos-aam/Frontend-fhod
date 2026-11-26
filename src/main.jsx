import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { AuthProvider } from './contexts/AuthContext'
import { SurveyProvider } from './contexts/SurveyContext'
import './styles.css'
async function bootstrap() {
  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCKS === 'true') { const { worker } = await import('./mocks/browser'); await worker.start({ onUnhandledRequest: 'bypass' }) }
  createRoot(document.getElementById('root')).render(<React.StrictMode><QueryClientProvider client={new QueryClient()}><BrowserRouter><AuthProvider><SurveyProvider><App /></SurveyProvider></AuthProvider></BrowserRouter></QueryClientProvider></React.StrictMode>)
}
bootstrap()
