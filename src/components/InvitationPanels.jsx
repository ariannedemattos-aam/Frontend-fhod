import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Download, Link2, Share2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, unwrap } from '../services/api'
import { surveyService } from '../services/surveyService'
import { useSurvey } from '../contexts/SurveyContext'
import { Notice, Pagination, Success } from './AdminFeedback'

const channels = { manual: 'Link manual', email: 'E-mail', whatsapp: 'WhatsApp' }
const states = { active: 'Ativo', used: 'Utilizado', expired: 'Expirado' }
const deliveries = { demo: 'Demonstração', accepted: 'Aceito pelo provedor', failed: 'Falha', processing: 'Em processamento' }
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const renderDate = value => value ? date.format(new Date(value)) : '—'
const invitationKey = ['invitations']

function DeliveryForm({ invite, modes }) {
  const client = useQueryClient()
  const [channel, setChannel] = useState(invite.channel === 'whatsapp' ? 'whatsapp' : 'email')
  const mode = modes?.[channel]
  const [attempt, setAttempt] = useState(null)
  const send = useMutation({
    gcTime: 0,
    mutationFn: payload => api.post('/admin/invitations/' + invite.id + '/communications', { ...payload, token: invite.token }),
    onSettled: () => client.invalidateQueries({ queryKey: invitationKey }),
  })
  function submit(event) {
    event.preventDefault()
    const contact = new FormData(event.currentTarget).get('contact').trim()
    const payload = attempt?.contact === contact && attempt.channel === channel
      ? attempt : { deliveryId: crypto.randomUUID(), channel, contact }
    setAttempt(payload)
    send.mutate(payload)
  }
  return <form className="card form-card" onSubmit={submit}>
    <h3>Comunicação</h3>
    <label className="field">Canal de comunicação<select value={channel} onChange={event => { setChannel(event.target.value); send.reset() }} disabled={send.isPending}>
      <option value="email">E-mail</option><option value="whatsapp">WhatsApp</option>
    </select></label>
    {mode === 'demo' && <p className="state">Modo demonstração. Use um contato fictício. Nenhuma mensagem será enviada.</p>}
    {mode === 'live' && <p className="state">O provedor está configurado para envio real. Confirme o destinatário antes de enviar.</p>}
    {mode === 'disabled' && <p className="state">Este canal está indisponível porque falta configuração.</p>}
    <label className="field">{channel === 'email' ? 'E-mail do destinatário' : 'Telefone internacional'}
      <input name="contact" type={channel === 'email' ? 'email' : 'tel'} required maxLength={255}
        placeholder={channel === 'email' ? 'exemplo@example.invalid' : '+15550100100'} key={channel} disabled={send.isPending} />
    </label>
    <Notice error={send.error} /><Success message={send.data?.message} />
    <button className="primary" disabled={send.isPending || !mode || mode === 'disabled'}>
      {send.isPending ? 'Registrando…' : mode === 'live' ? 'Enviar convite' : 'Simular envio'}
    </button>
  </form>
}

function NewLink({ invite, modes }) {
  const [qr, setQr] = useState('')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState('')
  useEffect(() => {
    let mounted = true
    import('qrcode').then(({ default: QRCode }) =>
      QRCode.toDataURL(invite.link, { width: 300, margin: 3, errorCorrectionLevel: 'M' }))
      .then(image => { if (mounted) setQr(image) })
      .catch(() => { if (mounted) setError(new Error('Não foi possível gerar o QR Code.')) })
    return () => { mounted = false }
  }, [invite.link])
  async function share(native) {
    setError(null)
    setMessage('')
    try {
      if (native && navigator.share) {
        await navigator.share({ title: 'Pesquisa de satisfação FHDOD', url: invite.link })
        return
      }
      await navigator.clipboard.writeText(invite.link)
      setMessage('Link copiado.')
    } catch (failure) {
      if (failure.name !== 'AbortError') setError(new Error('Use o campo do link para copiá-lo manualmente.'))
    }
  }
  return <section className="card invitation-result" aria-label="Convite gerado">
    <div>
      <h2>Convite gerado</h2>
      <p>Copie ou compartilhe antes de sair desta página. O link completo aparece somente na geração.</p>
      <p>Válido até <strong>{renderDate(invite.expiresAt)}</strong>.</p>
      <label className="field">Link individual<input readOnly onFocus={event => event.currentTarget.select()} value={invite.link} /></label>
      <div className="toolbar">
        <button type="button" className="secondary" onClick={() => share(false)}><Copy size={17} aria-hidden="true" /> Copiar link</button>
        <button type="button" className="secondary" onClick={() => share(true)}><Share2 size={17} aria-hidden="true" /> Compartilhar</button>
      </div>
      <Notice error={error} /><Success message={message} />
      <DeliveryForm invite={invite} modes={modes} />
    </div>
    {qr && <figure className="invitation-qr">
      <img src={qr} width="250" height="250" alt="QR Code do link individual de pesquisa" />
      <figcaption><a className="secondary" href={qr} download="convite-fhdod.png"><Download size={17} aria-hidden="true" /> Baixar QR Code</a></figcaption>
    </figure>}
  </section>
}

export function InvitationPanel() {
  const client = useQueryClient()
  const [filters, setFilters] = useState({ page: 1 })
  const list = useQuery({
    queryKey: [...invitationKey, filters],
    queryFn: () => api.get('/admin/invitations', { params: { ...filters, limit: 15 } }),
  })
  const generate = useMutation({
    gcTime: 0,
    mutationFn: body => api.post('/admin/invitations', body).then(unwrap),
    onSuccess: () => client.invalidateQueries({ queryKey: invitationKey }),
  })
  const table = list.data
  const invite = generate.data
  return <>
    <header className="section-heading"><h1>Convites</h1><p>Gere links individuais e acompanhe a validade e a utilização dos convites.</p></header>
    <form className="card analysis-filters" onSubmit={event => {
      event.preventDefault()
      const fields = new FormData(event.currentTarget)
      generate.mutate({ channel: fields.get('channel'), hours: Number(fields.get('hours')) })
    }}>
      <div className="analysis-fields">
        <label className="field">Canal previsto<select name="channel">
          {Object.entries(channels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
        </select></label>
        <label className="field">Validade em horas<input name="hours" type="number" min={1} max={336} step={1} defaultValue={72} required /></label>
      </div>
      <div className="toolbar"><button className="primary" disabled={generate.isPending}><Link2 size={17} aria-hidden="true" /> {generate.isPending ? 'Gerando…' : 'Gerar convite'}</button></div>
      <Notice error={generate.error} />
    </form>
    {invite && <NewLink key={invite.id} invite={invite} modes={table?.communication} />}
    <section aria-labelledby="invitations-table-heading">
      <div className="toolbar catalog-toolbar">
        <h2 id="invitations-table-heading">Convites gerados</h2>
        <label className="field">Status<select value={filters.status ?? ''} onChange={event => setFilters({ ...filters, status: event.target.value || undefined, page: 1 })}>
          <option value="">Todos</option>{Object.entries(states).map(([id, label]) => <option value={id} key={id}>{label}</option>)}
        </select></label>
        <label className="field">Canal<select value={filters.channel ?? ''} onChange={event => setFilters({ ...filters, channel: event.target.value || undefined, page: 1 })}>
          <option value="">Todos</option>{Object.entries(channels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}
        </select></label>
      </div>
      <Notice error={list.error} loading={list.isLoading} empty={table && !table.data.length && 'Nenhum convite corresponde aos filtros.'} />
      {table?.data.length > 0 && <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela de convites">
        <table className="table"><thead><tr><th scope="col">Convite</th><th scope="col">Canal</th><th scope="col">Validade</th>
          <th scope="col">Status</th><th scope="col">Comunicação</th></tr></thead><tbody>
          {table.data.map(item => <tr key={item.id}><td>{item.id.slice(0, 8)}<small>{renderDate(item.createdAt)}</small></td>
            <td>{channels[item.channel]}</td><td>{renderDate(item.expiresAt)}</td>
            <td><span className={'badge invitation-' + item.status}>{states[item.status]}</span>{item.usedAt && <small>{renderDate(item.usedAt)}</small>}</td>
            <td>{deliveries[item.lastDelivery] ?? '—'}</td></tr>)}
        </tbody></table>
      </div>}
      <Pagination pagination={table?.pagination} disabled={list.isFetching} onPage={page => setFilters({ ...filters, page })} />
    </section>
  </>
}

const hex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
async function deviceNonce(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const key = 'fhdod_invitation_' + hex(new Uint8Array(digest))
  const stored = sessionStorage.getItem(key)
  if (stored) return stored
  const value = hex(crypto.getRandomValues(new Uint8Array(32)))
  sessionStorage.setItem(key, value)
  return value
}

export function InvitationEntry() {
  const { hash } = useLocation()
  const navigate = useNavigate()
  const { survey, beginInvitation } = useSurvey()
  const token = hash.slice(1)
  const valid = /^[A-Za-z0-9_-]{43}$/.test(token)
  const redeem = useMutation({
    mutationFn: async () => {
      const nonce = await deviceNonce(token)
      const access = unwrap(await api.post('/public/invitations/redeem', { token, nonce }))
      const state = await surveyService.status(access.id, access.surveyToken)
      if (state.status === 'expired') throw new Error('O prazo para responder a pesquisa terminou.')
      return { ...access, status: state.status }
    },
    onSuccess: access => {
      if (access.status === 'completed') return navigate('/pesquisa/concluida', { replace: true })
      beginInvitation(access)
      navigate(access.status === 'in_progress' ? '/pesquisa/perguntas' : '/pesquisa/atendimento', { replace: true })
    },
  })
  return <section className="card hero">
    <p className="step-label">Pesquisa de satisfação</p><h1>Convite para participar</h1>
    {valid ? <><p>Use seu convite individual para avaliar o atendimento. Sua avaliação permanece anônima.</p>
      {(survey.id || survey.attendances.length > 0) && <p>Um convite diferente pode substituir o rascunho neste navegador.</p>}
      <button type="button" className="primary" onClick={() => redeem.mutate()} disabled={redeem.isPending}>{redeem.isPending ? 'Verificando…' : 'Usar convite'}</button>
    </> : <p className="error" role="alert">Convite inválido. Confira o link ou peça um novo convite.</p>}
    <Notice error={redeem.error} />
  </section>
}
