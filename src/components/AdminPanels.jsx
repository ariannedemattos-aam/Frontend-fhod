import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Activity, ClipboardList, FileDown, FolderOpen, LogOut, MessageSquare, Monitor, PhoneCall, Star } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api, unwrap } from '../services/api'
import { useDashboard } from '../services/useDashboard'
import { Notice, Pagination, SearchField, Success } from './AdminFeedback'

const dimensions = { sectors: 'Setores', services: 'Serviços', stages: 'Etapas', teams: 'Equipes', shifts: 'Turnos' }
const questionTypes = { rating: 'Avaliação de 1 a 5', text: 'Texto livre', single_choice: 'Escolha única', multiple_choice: 'Múltipla escolha' }
const statuses = { pending: 'Pendente', active: 'Ativa', rejected: 'Rejeitada', approved: 'Aprovada', inactive: 'Inativa' }
const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const format = (value) => value == null ? '—' : numberFormat.format(Number(value))
const queryQuestions = ['question-catalog']

export function AdminLayout({ children }) {
  const { logout, user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'UserAdmin'
  async function signOut() {
    try {
      await logout()
    } catch {
      // A sessão local é encerrada pelo AuthProvider mesmo se a API estiver indisponível.
    } finally {
      queryClient.clear()
      navigate('/login', { replace: true })
    }
  }
  return (
    <div className="admin">
      <aside className="side">
        <Link to="/" className="side-brand"><Activity size={22} aria-hidden="true" /> FHDOD Ouvidoria</Link>
        <nav aria-label="Menu de colaboradores">
          {isAdmin && <NavLink to="/admin/dashboard"><Activity size={18} aria-hidden="true" /> Indicadores</NavLink>}
          <NavLink to={isAdmin ? '/admin/perguntas' : '/setor/perguntas'}><ClipboardList size={18} aria-hidden="true" /> {isAdmin ? 'Perguntas' : 'Minhas propostas'}</NavLink>
          {isAdmin && <NavLink to="/admin/cadastros"><FolderOpen size={18} aria-hidden="true" /> Cadastros</NavLink>}
          {isAdmin && <NavLink to="/admin/avaliacoes"><Star size={18} aria-hidden="true" /> Avaliações</NavLink>}
          <NavLink to={isAdmin ? '/admin/feedback' : '/setor/feedback'}><MessageSquare size={18} aria-hidden="true" /> Feedbacks</NavLink>
          {isAdmin && <NavLink to="/admin/retornos"><PhoneCall size={18} aria-hidden="true" /> Retornos</NavLink>}
          {isAdmin && <NavLink to="/admin/relatorios"><FileDown size={18} aria-hidden="true" /> Relatórios</NavLink>}
          <Link to="/tvwall"><Monitor size={18} aria-hidden="true" /> Painel público</Link>
        </nav>
        <button className="side-exit" onClick={signOut}><LogOut size={18} aria-hidden="true" /> Sair</button>
      </aside>
      <main className="content">
        <div className="topbar"><span>{user?.name}</span><span className="badge">{isAdmin ? 'Administração' : 'Equipe de setor'}</span></div>
        {children}
      </main>
    </div>
  )
}

export function Dashboard() {
  const summary = useDashboard()
  const [dimension, setDimension] = useState('sectors')
  const { data = [], error, isLoading } = useQuery({
    queryKey: ['dashboard-dimension', dimension],
    queryFn: () => api.get('/admin/dashboard/' + dimension).then(unwrap),
    refetchInterval: 30000,
  })
  const totals = summary.data
  const stats = [
    ['Satisfação geral', totals?.averageRating == null ? '—' : format(totals.averageRating) + '/5'],
    ['Respostas registradas', format(totals?.answers)],
    ['Pesquisas concluídas', totals ? format(totals.surveys.completed ?? 0) : '—'],
    ['Avaliações positivas', totals?.ratedAnswers ? format(totals.positiveAnswers / totals.ratedAnswers * 100) + '%' : '—'],
  ]
  return (
    <AdminLayout>
      <header className="section-heading"><h1>Indicadores</h1><p>Resumo acumulado das pesquisas concluídas.</p></header>
      <Notice error={summary.error} loading={summary.isLoading} />
      <div className="statgrid">
        {stats.map(([label, value]) => <article className="stat" key={label}><span>{label}</span><strong>{value}</strong></article>)}
      </div>
      <section className="card dashboard-detail">
        <div className="section-heading"><h2>Satisfação por dimensão</h2>
          <label className="field">Agrupar por<select value={dimension} onChange={event => setDimension(event.target.value)}>
            {Object.entries(dimensions).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
          </select></label>
        </div>
        <Notice error={error} loading={isLoading} empty={!data.length && 'Ainda não há respostas vinculadas a esta dimensão.'} />
        <div className="bar-list">
          {data.map(({ label, responses, averageRating }, index) => (
            <div className="bar-row" key={label + index}><span>{label}</span>
              <progress aria-label={'Satisfação média de ' + label} max="5" value={Number(averageRating ?? 0)} />
              <span className="bar-value">{averageRating == null ? 'Sem nota' : format(averageRating) + '/5'} · {responses} {responses === 1 ? 'resposta' : 'respostas'}</span></div>
          ))}
        </div>
      </section>
    </AdminLayout>
  )
}

function ReviewQuestion({ id, onClose, onSaved }) {
  const client = useQueryClient()
  const [action, setAction] = useState('approve')
  const review = useMutation({
    mutationFn: (justification) => api.post('/questions/' + id + '/' + action, { justification }),
    onSuccess: async result => {
      onSaved(result.message)
      await client.invalidateQueries({ queryKey: queryQuestions })
      onClose()
    },
  })
  return (
    <form className="review" onSubmit={event => {
      event.preventDefault()
      review.mutate(new FormData(event.currentTarget).get('justification'))
    }}>
      <label className="field">Decisão<select value={action} onChange={event => setAction(event.target.value)}><option value="approve">Aprovar e ativar</option><option value="reject">Rejeitar</option></select></label>
      <label className="field">Justificativa<textarea name="justification" minLength={3} maxLength={500} rows="2" required /></label>
      <Notice error={review.error} />
      <div className="toolbar"><button className="secondary" type="button" onClick={onClose}>Cancelar</button><button className="primary" disabled={review.isPending}>{review.isPending ? 'Salvando…' : 'Confirmar decisão'}</button></div>
    </form>
  )
}

export function QuestionsAdmin({ sector = false }) {
  const client = useQueryClient()
  const location = useLocation()
  const [filters, setFilters] = useState({ status: '', search: '', page: 1 })
  const [review, setReview] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [message, setMessage] = useState(location.state?.message ?? '')
  const confirmation = useRef(null)
  const home = sector ? '/setor/perguntas' : '/admin/perguntas'
  const query = useQuery({
    queryKey: [...queryQuestions, filters],
    queryFn: () => api.get('/questions', { params: { ...filters, status: filters.status || undefined, limit: 15 } }),
  })
  const status = useMutation({
    mutationFn: item => api.patch('/questions/' + item.id + '/status', { active: item.status === 'inactive' }),
    onSuccess: async response => {
      setMessage(response.message)
      setConfirm(null)
      await client.invalidateQueries({ queryKey: queryQuestions })
    },
  })
  const table = query.data
  const rows = table?.data ?? []
  const updateFilters = changes => setFilters(current => ({ ...current, page: 1, ...changes }))
  useEffect(() => {
    const last = Math.max(table?.pagination?.totalPages ?? 1, 1)
    if (table?.pagination && filters.page > last) setFilters(current => ({ ...current, page: last }))
  }, [filters.page, table])
  useEffect(() => { if (confirm) confirmation.current?.focus() }, [confirm])
  return (
    <AdminLayout>
      <header className="section-heading"><h1>{sector ? 'Minhas propostas de perguntas' : 'Gerenciar perguntas'}</h1>
        <p>{sector ? 'Acompanhe as propostas dos atendimentos do seu setor.' : 'Revise propostas e acompanhe as perguntas de cada serviço.'}</p>
      </header>
      <div className="toolbar catalog-toolbar">
        <SearchField label="Buscar por pergunta" value={filters.search} onSearch={search => updateFilters({ search })} />
        <label className="field">Status<select value={filters.status} onChange={event => updateFilters({ status: event.target.value })}>
          <option value="">Todos</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <Link className="primary" to={home + '/nova'}>Nova pergunta</Link>
      </div>
      <Success message={message} />
      {confirm && <div ref={confirmation} tabIndex={-1} className="card form-card" role="region" aria-label="Confirmar status da pergunta">
        <p>{confirm.status === 'active'
          ? 'Arquivar esta pergunta? As pesquisas já iniciadas manterão a versão original.'
          : 'Devolver a pergunta à revisão? Ela voltará às pesquisas após nova aprovação.'}</p>
        <Notice error={status.error} />
        <div className="toolbar">
          <button type="button" className="secondary" disabled={status.isPending} onClick={() => { setConfirm(null); status.reset() }}>Cancelar</button>
          <button type="button" className="primary" disabled={status.isPending} onClick={() => status.mutate(confirm)}>{status.isPending ? 'Salvando…' : 'Confirmar'}</button>
        </div>
      </div>}
      <Notice error={query.error} loading={query.isLoading} empty={table && !rows.length && 'Nenhuma pergunta encontrada.'} />
      {rows.length > 0 && <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela de perguntas"><table className="table"><thead><tr>
        <th scope="col">Pergunta</th><th scope="col">Serviço</th><th scope="col">Status</th><th scope="col">Ações</th>
      </tr></thead><tbody>{rows.map(item => <tr key={item.id}>
        <td>{item.prompt}<small>{questionTypes[item.type]} · Versão {item.version ?? 1}</small></td>
        <td>{item.services || 'Geral'}</td>
        <td><span className={'badge status-' + item.status}>{statuses[item.status]}</span></td>
        <td><div className="row-actions">
          {item.canEdit && <Link className="secondary" to={home + '/' + item.id + '/editar'}>Editar</Link>}
          {!sector && item.status === 'pending' && review !== item.id &&
            <button className="secondary" type="button" onClick={() => { setReview(item.id); setConfirm(null) }}>Revisar</button>}
          {!sector && item.canEdit && ['active', 'inactive'].includes(item.status) &&
            <button className="secondary" type="button" onClick={() => { setConfirm(item); setReview(null); setMessage(''); status.reset() }}>
              {item.status === 'active' ? 'Arquivar' : 'Reabrir revisão'}
            </button>}
        </div>
        {!sector && item.status === 'pending' && review === item.id &&
          <ReviewQuestion id={item.id} onSaved={setMessage} onClose={() => setReview(null)} />}</td>
      </tr>)}</tbody></table></div>}
      <Pagination pagination={table?.pagination} disabled={query.isFetching} onPage={page => updateFilters({ page })} />
    </AdminLayout>
  )
}

function QuestionForm({ entry, services, home }) {
  const nav = useNavigate()
  const client = useQueryClient()
  const [type, setType] = useState(entry?.type ?? 'rating')
  const choice = type.endsWith('_choice')
  const save = useMutation({
    mutationFn: data => entry ? api.put('/questions/' + entry.id, data) : api.post('/questions', data),
    onSuccess: async response => {
      await client.invalidateQueries({ queryKey: queryQuestions })
      nav(home, { state: { message: response.message } })
    },
  })
  return (
    <form className="card form-card" onSubmit={event => {
      event.preventDefault()
      const fields = new FormData(event.currentTarget)
      save.mutate({
        prompt: fields.get('prompt'), type, required: fields.has('required'),
        ...(entry ? { version: entry.version, changeReason: fields.get('changeReason') } : { serviceId: fields.get('service') }),
        ...(choice && { options: fields.get('options').split(/\r?\n/).map(value => value.trim()).filter(Boolean) }),
      })
    }}>
      <label className="field">Texto da pergunta<textarea name="prompt" rows="3" minLength={10} maxLength={500} required defaultValue={entry?.prompt} /></label>
      {entry ? <p><strong>Serviço:</strong> {entry.services || 'Geral'}</p> :
        <label className="field">Serviço<select name="service" defaultValue="" required><option value="" disabled>Selecione um serviço</option>
          {services.map(service => <option key={service.id} value={service.id}>{service.sectorName} · {service.name}</option>)}
        </select></label>}
      <label className="field">Tipo<select value={type} onChange={event => setType(event.target.value)}>
        {Object.entries(questionTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      {choice && <label className="field">Opções, uma por linha<textarea name="options" rows="4" required maxLength={1010}
        defaultValue={entry?.type?.endsWith('_choice') ? entry.options.join('\n') : ''} /></label>}
      <label className="checkbox-field"><input type="checkbox" name="required" defaultChecked={Boolean(entry?.required)} /> Resposta obrigatória</label>
      {entry && <label className="field">Motivo da alteração<textarea name="changeReason" required minLength={3} maxLength={500} rows="2" /></label>}
      <Notice error={save.error} />
      <div className="toolbar"><Link className="secondary" to={home}>Cancelar</Link>
        <button className="primary" disabled={save.isPending || (!entry && !services.length)}>{save.isPending ? 'Salvando…' : entry ? 'Salvar nova versão' : 'Enviar para aprovação'}</button></div>
    </form>
  )
}

export function NewQuestion({ sector = false }) {
  const { id } = useParams()
  const home = sector ? '/setor/perguntas' : '/admin/perguntas'
  const { data, error, isLoading } = useQuery({
    queryKey: id ? ['question-detail', id] : ['question-services'],
    queryFn: () => api.get(id ? '/questions/' + id : '/questions/services').then(unwrap),
    staleTime: 0,
  })
  const entry = id ? data : null
  const services = id ? [] : data ?? []
  const canEdit = !id || entry?.canEdit
  return (
    <AdminLayout>
      <header className="section-heading"><h1>{id ? 'Editar pergunta' : 'Nova pergunta'}</h1>
        <p>{id ? 'Cada edição cria uma versão. Pesquisas já iniciadas preservam as perguntas originais.' : 'A pergunta fica pendente até a análise da administração.'}</p>
      </header>
      <Notice error={error} loading={isLoading} empty={data && (!canEdit ? 'O status da pergunta não permite edição por este perfil.' : !id && !services.length && 'Nenhum serviço disponível para este usuário.')} />
      {data && canEdit && <QuestionForm key={id ? entry.version : 'new'} entry={entry} services={services} home={home} />}
      {id && !canEdit && <Link to={home}>Voltar para perguntas</Link>}
    </AdminLayout>
  )
}

export function TvWall() {
  const { data, error, isLoading } = useQuery({
    queryKey: ['tvwall'],
    queryFn: async () => {
      const [overview, sectors] = await Promise.all([
        api.get('/tvwall/overview').then(unwrap),
        api.get('/tvwall/sectors').then(unwrap),
      ])
      return { overview, sectors }
    },
    refetchInterval: 60000,
  })
  return (
    <main className="tv">
      <h1>Fundação Hospitalar Dr. Oswaldo Diesel</h1>
      <p className="tv-label">Satisfação geral</p>
      <div className="big">{format(data?.overview.averageRating)}</div>
      <Notice error={error} loading={isLoading} empty={!data?.overview.averageRating && 'Dados insuficientes para exibição.'} />
      {data?.overview.averageRating != null && <p>de 5 · {data.overview.responses} avaliações</p>}
      <div className="tv-grid">{data?.sectors.map(sector => <article key={sector.name}><span>{sector.name}</span><strong>{format(sector.averageRating)}</strong><small>{sector.responses} respostas</small></article>)}</div>
      <Link to="/" className="tv-back">Voltar para a pesquisa</Link>
    </main>
  )
}
