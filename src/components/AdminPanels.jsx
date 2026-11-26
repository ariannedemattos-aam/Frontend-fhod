import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Activity, ClipboardList, LogOut, Monitor } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api, unwrap } from '../services/api'
import { useDashboard } from '../services/useDashboard'

const dimensions = { sectors: 'Setores', services: 'Serviços', stages: 'Etapas', teams: 'Equipes', shifts: 'Turnos' }
const questionTypes = { rating: 'Avaliação de 1 a 5', text: 'Texto livre', single_choice: 'Escolha única', multiple_choice: 'Múltipla escolha' }
const statuses = { pending: 'Pendente', active: 'Ativa', rejected: 'Rejeitada', approved: 'Aprovada', inactive: 'Inativa' }
const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const format = (value) => value == null ? '—' : numberFormat.format(Number(value))
const queryQuestions = ['question-catalog']

function Notice({ error, loading, empty }) {
  if (error) return <p className="error" role="alert">{error.message}</p>
  if (loading) return <p className="state" role="status">Carregando…</p>
  return empty ? <p className="state">{empty}</p> : null
}

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
      <header className="section-heading"><h1>Indicadores</h1><p>Resumo acumulado das avaliações registradas.</p></header>
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

function ReviewQuestion({ id, onClose }) {
  const client = useQueryClient()
  const [action, setAction] = useState('approve')
  const review = useMutation({
    mutationFn: (justification) => api.post('/questions/' + id + '/' + action, { justification }),
    onSuccess: async () => {
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
  const [filter, setFilter] = useState('')
  const [review, setReview] = useState(null)
  const { data = [], error, isLoading } = useQuery({
    queryKey: queryQuestions,
    queryFn: () => api.get('/questions').then(unwrap),
  })
  const rows = data.filter(item => !filter || item.status === filter)
  return (
    <AdminLayout>
      <header className="section-heading"><h1>{sector ? 'Minhas propostas de perguntas' : 'Gerenciar perguntas'}</h1>
        <p>{sector ? 'Acompanhe as propostas dos atendimentos do seu setor.' : 'Revise propostas e acompanhe as perguntas de cada serviço.'}</p>
      </header>
      <div className="toolbar">
        <label className="field">Status<select value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="">Todos</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <Link className="primary" to={sector ? '/setor/perguntas/nova' : '/admin/perguntas/nova'}>Nova pergunta</Link>
      </div>
      <Notice error={error} loading={isLoading} empty={!rows.length && 'Nenhuma pergunta encontrada para este status.'} />
      {rows.length > 0 && <div className="table-scroll"><table className="table"><thead><tr>
        <th scope="col">Pergunta</th><th scope="col">Serviço</th><th scope="col">Status</th>{!sector && <th scope="col">Ação</th>}
      </tr></thead><tbody>{rows.map(item => <tr key={item.id}>
        <td>{item.prompt}<small>{questionTypes[item.type]}</small></td><td>{item.services || 'Geral'}</td>
        <td><span className={'badge status-' + item.status}>{statuses[item.status]}</span></td>
        {!sector && <td>{item.status === 'pending' && (review === item.id
          ? <ReviewQuestion id={item.id} onClose={() => setReview(null)} />
          : <button className="secondary" onClick={() => setReview(item.id)}>Revisar</button>)}</td>}
      </tr>)}</tbody></table></div>}
    </AdminLayout>
  )
}

export function NewQuestion({ sector = false }) {
  const nav = useNavigate()
  const client = useQueryClient()
  const [type, setType] = useState('rating')
  const { data: services = [], error, isLoading } = useQuery({
    queryKey: ['question-services'],
    queryFn: () => api.get('/questions/services').then(unwrap),
  })
  const save = useMutation({
    mutationFn: (data) => api.post('/questions', data),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryQuestions })
      nav(sector ? '/setor/perguntas' : '/admin/perguntas')
    },
  })
  const choice = type.endsWith('_choice')
  return (
    <AdminLayout>
      <header className="section-heading"><h1>Nova pergunta</h1><p>A pergunta fica pendente até a análise da administração.</p></header>
      <Notice error={error} loading={isLoading} empty={!services.length && 'Nenhum serviço disponível para este usuário.'} />
      <form className="card form-card" onSubmit={event => {
        event.preventDefault()
        const fields = new FormData(event.currentTarget)
        save.mutate({
          prompt: fields.get('prompt'), serviceId: fields.get('service'), type, required: fields.has('required'),
          ...(choice && { options: fields.get('options').split(/\r?\n/).map(value => value.trim()).filter(Boolean) }),
        })
      }}>
        <label className="field">Texto da pergunta<textarea name="prompt" rows="3" minLength={10} maxLength={500} required /></label>
        <label className="field">Serviço<select name="service" defaultValue="" required><option value="" disabled>Selecione um serviço</option>
          {services.map(service => <option key={service.id} value={service.id}>{service.sectorName} · {service.name}</option>)}
        </select></label>
        <label className="field">Tipo<select value={type} onChange={event => setType(event.target.value)}>
          {Object.entries(questionTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        {choice && <label className="field">Opções, uma por linha<textarea name="options" rows="4" required maxLength={1010} /></label>}
        <label className="checkbox-field"><input type="checkbox" name="required" /> Resposta obrigatória</label>
        <Notice error={save.error} />
        <div className="toolbar"><Link className="secondary" to={sector ? '/setor/perguntas' : '/admin/perguntas'}>Cancelar</Link>
          <button className="primary" disabled={save.isPending || !services.length}>{save.isPending ? 'Enviando…' : 'Enviar para aprovação'}</button></div>
      </form>
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
