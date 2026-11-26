import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Check } from 'lucide-react'
import { io } from 'socket.io-client'
import { api, unwrap } from '../services/api'
import { Notice, Success } from './AdminFeedback'
import { useAuth } from '../contexts/AuthContext'

const notifications = ['notifications']
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const load = (params) => api.get('/notifications', { params }).then(unwrap)
const allowedLinks = new Set(['/admin/convites', '/admin/perguntas', '/setor/perguntas', '/admin/retornos'])

export function NotificationBell() {
  const client = useQueryClient()
  const { data } = useQuery({
    queryKey: [...notifications, 'count'], queryFn: () => load({ limit: 1 }), refetchInterval: 30000,
  })
  const socketUrl = import.meta.env.VITE_SOCKET_URL
  const { token } = useAuth()
  useEffect(() => {
    if (!socketUrl || !token) return undefined
    const socket = io(socketUrl.replace(/\/+$/, '') + '/notifications', { auth: { token } })
    const refresh = () => client.invalidateQueries({ queryKey: notifications })
    socket.on('connect', refresh)
    socket.on('notifications:update', refresh)
    return () => socket.disconnect()
  }, [client, socketUrl, token])
  const unread = data?.unread ?? 0
  return <Link className="notification-bell" to="/notificacoes" aria-label={'Notificações: ' + unread + ' não lidas'}>
    <Bell size={20} aria-hidden="true" />{unread > 0 && <span aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
  </Link>
}

export function NotificationInbox() {
  const client = useQueryClient()
  const [unreadOnly, setUnread] = useState(false)
  const query = useQuery({
    queryKey: [...notifications, unreadOnly],
    queryFn: () => load({ limit: 50, unread: String(unreadOnly) }),
    refetchInterval: 30000,
  })
  const mark = useMutation({
    mutationFn: id => api.patch(id ? '/notifications/' + id + '/read' : '/notifications/read-all', {}),
    onSuccess: () => client.invalidateQueries({ queryKey: notifications }),
  })
  const rows = query.data?.items ?? []
  return <>
    <header className="section-heading"><h1>Notificações</h1><p>{query.data?.unread ?? 0} não lidas</p></header>
    <div className="toolbar">
      <label className="checkbox-field"><input type="checkbox" checked={unreadOnly} onChange={event => setUnread(event.target.checked)} /> Mostrar apenas não lidas</label>
      <button className="secondary" type="button" disabled={mark.isPending || !query.data?.unread} onClick={() => mark.mutate(null)}>
        <Check size={17} aria-hidden="true" /> Marcar todas como lidas
      </button>
    </div>
    <Notice error={mark.error} /><Success message={mark.data?.message} />
    <Notice error={query.error} loading={query.isLoading} empty={query.data && !rows.length && 'Nenhuma notificação nesta lista.'} />
    <ul className="notification-list">
      {rows.map(item => <li className="card" key={item.id} data-unread={!item.readAt}>
        <div className="notification-meta"><time dateTime={item.createdAt}>{date.format(new Date(item.createdAt))}</time>
          {!item.readAt && <span className="badge">Não lida</span>}</div>
        <h2>{item.title}</h2><p>{item.message}</p>
        <div className="row-actions">
          {(allowedLinks.has(item.href) || /^\/admin\/avaliacoes\?overallMax=(?:[0-9]|10)$/.test(item.href)) && <Link to={item.href}>Abrir seção</Link>}
          {!item.readAt && <button className="secondary" type="button" onClick={() => mark.mutate(item.id)} disabled={mark.isPending}>Marcar como lida</button>}
        </div>
      </li>)}
    </ul>
  </>
}
