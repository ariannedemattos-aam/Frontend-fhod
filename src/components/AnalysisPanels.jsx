import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileSpreadsheet } from 'lucide-react'
import { AdminLayout } from './AdminPanels'
import { Notice, Pagination, Success } from './AdminFeedback'
import { api, unwrap } from '../services/api'

const feedbackKinds = { praise: 'Elogio', positive: 'Ponto positivo', suggestion: 'Sugestão', negative: 'Ponto de melhoria' }
const returnLabels = { open: 'Pendente', in_progress: 'Em atendimento', closed: 'Concluída' }
const nextReturn = { open: 'in_progress', in_progress: 'closed' }
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' })
const date = value => value?.split('-').reverse().join('/') ?? '—'
const format = value => value == null ? '—' : number.format(Number(value))
const textRating = (value, scale) => value == null ? '—' : format(value) + '/' + scale
const pageSize = 15

function usePagedView(key, path, filters) {
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: [key, filters, page],
    queryFn: () => api.get(path, { params: { ...filters, page, limit: pageSize } }),
  })
  const pagination = query.data?.pagination
  useEffect(() => {
    if (pagination && page > Math.max(1, pagination.totalPages)) setPage(Math.max(1, pagination.totalPages))
  }, [pagination, page])
  return { ...query, setPage, pagination, rows: query.data?.data ?? [] }
}

function readFields(form) {
  const fields = new FormData(form)
  return Object.fromEntries([...fields.entries()].map(([key, value]) => [key, value.trim()]).filter(([, value]) => value))
}

function AnalysisFilters({ fields, apply, type, options }) {
  const [sectorId, setSectorId] = useState(fields.sectorId ?? '')
  const [serviceId, setServiceId] = useState(fields.serviceId ?? '')
  const sectorOptions = options?.sectors ?? []
  const serviceOptions = Array.from(new Map((options?.services ?? [])
    .filter(service => !sectorId || service.sectorId === sectorId).map(service => [service.id, service])).values())
  const stages = options?.stages ?? []
  return (
    <form className="card analysis-filters" aria-label="Filtros" onSubmit={event => { event.preventDefault(); apply(readFields(event.currentTarget)) }}>
      <div className="analysis-fields">
        <label className="field">Data inicial (UTC)<input type="date" name="from" defaultValue={fields.from} /></label>
        <label className="field">Data final (UTC)<input type="date" name="to" defaultValue={fields.to} /></label>
        <label className="field">Setor<select name="sectorId" value={sectorId} onChange={event => { setSectorId(event.target.value); setServiceId('') }}>
          <option value="">Todos</option>{sectorOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label className="field">Serviço<select name="serviceId" value={serviceId} onChange={event => setServiceId(event.target.value)}>
          <option value="">Todos</option>{serviceOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label className="field">Etapa<select name="stageId" defaultValue={fields.stageId ?? ''}>
          <option value="">Todas</option>{stages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label className="field">Nota da resposta<select name="score" defaultValue={fields.score ?? ''}>
          <option value="">Todas</option>{[1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score}</option>)}
        </select></label>
        {type === 'feedback' && <label className="field">Tipo<select name="kind" defaultValue={fields.kind ?? ''}>
          <option value="">Todos</option>{Object.entries(feedbackKinds).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
        </select></label>}
        {type !== 'report' && <label className="field">Ordenar<select name="sort" defaultValue={fields.sort ?? 'recent'}>
          <option value="recent">Mais recentes</option><option value="oldest">Mais antigas</option>
          {type === 'evaluation' && <><option value="highest">Maior média</option><option value="lowest">Menor média</option></>}
        </select></label>}
        {type !== 'feedback' && <label className="field">Buscar por código ou atendimento<input name="search" type="search" maxLength={120} defaultValue={fields.search} /></label>}
      </div>
      <div className="toolbar"><button className="primary" type="submit">Aplicar filtros</button>
        <button className="secondary" type="button" onClick={() => apply({})}>Limpar filtros</button></div>
    </form>
  )
}

function Summary({ data }) {
  if (!data) return null
  const cards = [
    ['Avaliações concluídas', format(data.total)],
    ['Respostas registradas', format(data.answers)],
    ['Satisfação média', textRating(data.averageRating, 5)],
  ]
  return <div className="statgrid">{cards.map(([label, value]) => <article className="stat" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
}

function Distribution({ data }) {
  if (!data?.length || !data.some(item => item.responses)) return null
  const max = Math.max(...data.map(item => item.responses))
  return <section className="card dashboard-detail"><h2>Distribuição das notas</h2><div className="bar-list">
    {data.map(item => <div className="bar-row" key={item.score}><span>Nota {format(item.score)}</span>
      <progress aria-label={'Respostas com nota ' + item.score} max={max} value={item.responses} /><span className="bar-value">{format(item.responses)} respostas</span></div>)}
  </div></section>
}

function DownloadActions({ filters }) {
  const [pending, setPending] = useState('')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState('')
  async function download(type) {
    setPending(type)
    setError(null)
    setMessage('')
    try {
      const { sort, ...params } = filters
      const blob = await api.get('/admin/reports/' + type, { params, responseType: 'blob', timeout: 45000, validateStatus: () => true })
      const mime = type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      if (blob.type !== mime) {
        const failure = await blob.text().then(text => JSON.parse(text)).catch(() => ({}))
        throw new Error(failure.errors?.[0]?.message || failure.message || 'Não foi possível gerar o relatório.')
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'fhdod-satisfacao.' + (type === 'pdf' ? 'pdf' : 'xlsx')
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('Relatório gerado.')
    } catch (failure) { setError(failure) } finally { setPending('') }
  }
  return <div className="report-downloads">
    <div className="row-actions">
      <button className="secondary" disabled={Boolean(pending)} onClick={() => download('excel')}><FileSpreadsheet size={18} aria-hidden="true" /> {pending === 'excel' ? 'Gerando Excel…' : 'Baixar Excel'}</button>
      <button className="secondary" disabled={Boolean(pending)} onClick={() => download('pdf')}><Download size={18} aria-hidden="true" /> {pending === 'pdf' ? 'Gerando PDF…' : 'Baixar PDF'}</button>
    </div>
    <Notice error={error} /><Success message={message} />
  </div>
}

function EvaluationDetail({ id, filters, close }) {
  const { sort, ...params } = filters
  const { data, isLoading, error } = useQuery({
    queryKey: ['evaluation-detail', id, params],
    queryFn: () => api.get('/admin/evaluations/' + id, { params }).then(unwrap),
  })
  return <section className="card evaluation-detail" aria-labelledby="evaluation-detail-title">
    <div className="toolbar"><h2 id="evaluation-detail-title">Detalhes da avaliação</h2>
      <button className="secondary" autoFocus type="button" onClick={close}>Fechar detalhes</button></div>
    <Notice error={error} loading={isLoading} />
    {data && <>
      <p><strong>Conclusão:</strong> {date(data.completedDate)} · <strong>Nota geral:</strong> {textRating(data.overallRating, 10)}</p>
      {data.attendances.length > 0 && <ul>{data.attendances.map(({ sector, service, shift }, index) => <li key={index}>{sector} · {service} · {shift}</li>)}</ul>}
      <Notice empty={!data.answers.length && 'Nenhuma resposta registrada para estes filtros.'} />
      <dl className="evaluation-answers">{data.answers.map(answer => <div key={answer.id}>
        <dt>{answer.prompt}</dt>
        <dd>{answer.rating != null ? textRating(answer.rating, 5) : answer.options.length ? answer.options.join(', ') : answer.hasText ? 'Resposta em texto registrada' : 'Sem nota ou opção registrada'}
          <small>{answer.stage ? answer.service + ' · ' + answer.stage : answer.service}</small></dd>
      </div>)}</dl>
    </>}
  </section>
}

export function EvaluationsPanel({ report = false }) {
  const type = report ? 'report' : 'evaluation'
  const [filters, setFilters] = useState({})
  const [filterVersion, resetForm] = useState(0)
  const [detail, setDetail] = useState('')
  const catalog = useQuery({ queryKey: ['analysis-options'], queryFn: () => api.get('/admin/analysis/options').then(unwrap) })
  const view = usePagedView('evaluations', '/admin/evaluations', filters)
  function apply(params) {
    setFilters(params)
    setDetail('')
    view.setPage(1)
    resetForm(version => version + 1)
  }
  return <AdminLayout>
    <header className="section-heading"><h1>{report ? 'Relatórios' : 'Avaliações'}</h1>
      <p>{report ? 'Exporte indicadores e contagens anônimas dos feedbacks.' : 'Consulte pesquisas concluídas. A média usa as notas individuais de 1 a 5.'}</p></header>
    <Notice error={catalog.error} loading={catalog.isLoading} />
    <AnalysisFilters key={filterVersion} fields={filters} apply={apply} type={type} options={catalog.data} />
    <Notice error={view.error} loading={view.isLoading} empty={view.data && !view.pagination.total && 'Nenhuma avaliação corresponde aos filtros.'} />
    <Summary data={view.data?.summary} />
    <DownloadActions filters={filters} />
    {report ? <Distribution data={view.data?.distribution} /> : <>
      {detail && <EvaluationDetail id={detail} filters={filters} close={() => setDetail('')} />}
      {view.rows.length > 0 && <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela de avaliações">
        <table className="table"><thead><tr><th scope="col">Conclusão</th><th scope="col">Atendimento</th>
          <th scope="col">Média</th><th scope="col">Nota geral</th><th scope="col">Ação</th></tr></thead>
          <tbody>{view.rows.map(item => <tr key={item.id}><td>{date(item.completedDate)}<small>{item.id.slice(0, 8)}</small></td>
            <td>{item.attendances || '—'}<small>{format(item.answers)} respostas</small></td>
            <td>{textRating(item.averageRating, 5)}</td><td>{textRating(item.overallRating, 10)}</td>
            <td><button className="secondary" type="button" onClick={() => setDetail(item.id)}>Ver detalhes</button></td></tr>)}</tbody>
        </table>
      </div>}
      <Pagination pagination={view.pagination} disabled={view.isFetching} onPage={page => { setDetail(''); view.setPage(page) }} />
    </>}
  </AdminLayout>
}

export function FeedbackPanel() {
  const [filters, setFilters] = useState({})
  const [version, resetForm] = useState(0)
  const catalog = useQuery({ queryKey: ['analysis-options'], queryFn: () => api.get('/admin/analysis/options').then(unwrap) })
  const view = usePagedView('feedback', '/admin/feedback', filters)
  const apply = params => { setFilters(params); view.setPage(1); resetForm(current => current + 1) }
  return <AdminLayout>
    <header className="section-heading"><h1>Elogios e sugestões</h1><p>Feedback das pesquisas concluídas, organizado pelo tipo de comentário.</p></header>
    <Notice error={catalog.error} loading={catalog.isLoading} />
    <AnalysisFilters key={version} fields={filters} apply={apply} type="feedback" options={catalog.data} />
    <Notice error={view.error} loading={view.isLoading} empty={view.data && !view.rows.length && 'Nenhum feedback corresponde aos filtros.'} />
    {view.rows.length > 0 && <ul className="feedback-grid">
      {view.rows.map(item => <li className="card" key={item.id}>
        <div className="feedback-heading"><span className={'badge feedback-' + item.kind}>{feedbackKinds[item.kind]}</span><time dateTime={item.receivedDate}>{date(item.receivedDate)}</time></div>
        <p>{item.content}</p></li>)}
    </ul>}
    <Pagination pagination={view.pagination} disabled={view.isFetching} onPage={view.setPage} />
  </AdminLayout>
}

function ContactReveal({ id, close }) {
  const [state, setState] = useState({ loading: true })
  const request = useRef(null)
  useEffect(() => {
    const controller = new AbortController()
    request.current = controller
    api.get('/admin/return-requests/' + id + '/contact', { signal: controller.signal }).then(unwrap).then(data => {
      if (!controller.signal.aborted) setState({ data })
    }).catch(error => { if (!controller.signal.aborted) setState({ error }) })
    return () => controller.abort()
  }, [id])
  return <section className="card evaluation-detail" aria-labelledby="contact-title">
    <div className="toolbar"><h2 id="contact-title">Contato da solicitação</h2>
      <button type="button" className="secondary" autoFocus onClick={() => { request.current?.abort(); close() }}>Ocultar contato</button></div>
    <Notice error={state.error} loading={state.loading} />
    {state.data && <dl className="evaluation-answers">
      <div><dt>Nome</dt><dd>{state.data.name || 'Não informado'}</dd></div>
      <div><dt>Contato</dt><dd>{state.data.contact}</dd></div>
      <div><dt>Canal informado</dt><dd>{state.data.preferredChannel || 'Não informado'}</dd></div>
      {state.data.message && <div><dt>Mensagem</dt><dd>{state.data.message}</dd></div>}
    </dl>}
  </section>
}

export function ReturnsPanel() {
  const client = useQueryClient()
  const [filters, setFilters] = useState({ status: 'open' })
  const [version, resetForm] = useState(0)
  const [contact, setContact] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [message, setMessage] = useState('')
  const view = usePagedView('return-requests', '/admin/return-requests', filters)
  const status = useMutation({
    mutationFn: item => api.patch('/admin/return-requests/' + item.id + '/status', { status: nextReturn[item.status] }),
    onSuccess: async result => {
      setMessage(result.message)
      setConfirm(null)
      setContact('')
      await client.invalidateQueries({ queryKey: ['return-requests'] })
    },
  })
  const apply = params => { setFilters(params); view.setPage(1); setContact(''); setConfirm(null); resetForm(value => value + 1) }
  return <AdminLayout>
    <header className="section-heading"><h1>Solicitações de retorno</h1><p>Acompanhe a situação de cada pedido. O contato é exibido somente sob solicitação.</p></header>
    <form className="card analysis-filters" key={version} aria-label="Filtros" onSubmit={event => { event.preventDefault(); apply(readFields(event.currentTarget)) }}>
      <div className="analysis-fields">
        <label className="field">Data inicial (UTC)<input type="date" name="from" defaultValue={filters.from} /></label>
        <label className="field">Data final (UTC)<input type="date" name="to" defaultValue={filters.to} /></label>
        <label className="field">Situação<select name="status" defaultValue={filters.status ?? ''}><option value="">Todas</option>
          {Object.entries(returnLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      </div>
      <div className="toolbar"><button className="primary">Aplicar filtros</button><button type="button" className="secondary" onClick={() => apply({})}>Limpar filtros</button></div>
    </form>
    <Success message={message} />
    {confirm && <section className="card evaluation-detail" aria-label="Confirmar situação">
      <p>Alterar situação para <strong>{returnLabels[nextReturn[confirm.status]]}</strong>?</p>
      <Notice error={status.error} />
      <div className="row-actions"><button className="secondary" disabled={status.isPending} onClick={() => setConfirm(null)}>Cancelar</button>
        <button className="primary" autoFocus disabled={status.isPending} onClick={() => status.mutate(confirm)}>{status.isPending ? 'Salvando…' : 'Confirmar situação'}</button></div>
    </section>}
    {contact && <ContactReveal key={contact} id={contact} close={() => setContact('')} />}
    <Notice error={view.error} loading={view.isLoading} empty={view.data && !view.rows.length && 'Nenhuma solicitação encontrada.'} />
    {view.rows.length > 0 && <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela de retornos">
      <table className="table"><thead><tr><th scope="col">Recebida (UTC)</th><th scope="col">Situação</th><th scope="col">Ações</th></tr></thead>
        <tbody>{view.rows.map(item => <tr key={item.id}><td>{dateTime.format(new Date(item.createdAt))}<small>{item.id.slice(0, 8)}</small></td>
          <td><span className={'badge return-' + item.status}>{returnLabels[item.status]}</span></td>
          <td><div className="row-actions"><button className="secondary" onClick={() => { setContact(item.id); setConfirm(null) }}>Ver contato</button>
            {nextReturn[item.status] && <button className="secondary" onClick={() => { setConfirm(item); setContact(''); setMessage(''); status.reset() }}>
              {item.status === 'open' ? 'Iniciar atendimento' : 'Concluir'}</button>}</div></td></tr>)}</tbody>
      </table>
    </div>}
    <Pagination pagination={view.pagination} disabled={view.isFetching} onPage={page => { setContact(''); setConfirm(null); view.setPage(page) }} />
  </AdminLayout>
}
