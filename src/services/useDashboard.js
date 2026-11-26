import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import { api, unwrap } from './api'
import { useAuth } from '../contexts/AuthContext'

const queryKey = ['dashboard-overview']

export function useDashboard(filters) {
  const queryClient = useQueryClient()
  const socketUrl = import.meta.env.VITE_SOCKET_URL
  const { token } = useAuth()
  useEffect(() => {
    if (!socketUrl || !token) return
    const socket = io(socketUrl, { auth: { token } })
    const update = () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['dashboard-dimension'] })
    }
    socket.on('connect', update)
    socket.on('dashboard:update', update)
    return () => socket.disconnect()
  }, [queryClient, socketUrl, token])

  return useQuery({
    queryKey: [...queryKey, filters],
    queryFn: () => api.get('/admin/dashboard/overview', { params: filters }).then(unwrap),
    refetchInterval: 30000,
  })
}
