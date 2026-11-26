import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import { api, unwrap } from './api'

const queryKey = ['dashboard-overview']

export function useDashboard() {
  const queryClient = useQueryClient()
  const socketUrl = import.meta.env.VITE_SOCKET_URL
  useEffect(() => {
    const token = sessionStorage.getItem('fhdod_token')
    if (!socketUrl || !token) return
    const socket = io(socketUrl, { auth: { token } })
    socket.on('dashboard:update', () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['dashboard-dimension'] })
    })
    return () => socket.disconnect()
  }, [queryClient, socketUrl])

  return useQuery({
    queryKey,
    queryFn: () => api.get('/admin/dashboard/overview').then(unwrap),
    refetchInterval: 30000,
  })
}
