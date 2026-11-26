import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AdminLayout } from './AdminPanels'
import { Notice, Pagination, Success } from './AdminFeedback'
import { api, unwrap } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { can } from '../services/profileAccess'

const statusLabels = { open: 'Pendente', in_progress: 'Em atendimento', closed: 'Concluída' }
const priorityLabels = { normal: 'Normal', high: 'Alta' }
const date = value => value?.slice(0,10).split('-').reverse().join('/') || '—'
const currentMonth = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date())
const listOptions = items => items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)
const selectedIds = form => new FormData(form).getAll('staff')

function RosterEditor({ options, sectorId, entry, close }) {
  const client = useQueryClient()
  const [sector, setSector] = useState(entry?.sectorId ?? sectorId)
  const save = useMutation({
    mutationFn: body => api.put('/admin/roster/shifts', body),
    onSuccess: () => client.invalidateQueries({ queryKey: ['roster'] }),
  })
  const teams = options.teams.filter(item => item.sectorId === sector)
  const staff = options.staff.filter(item => item.sectorId === sector)
  return <form className="card form-card" onSubmit={event => {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    save.mutate({ sectorId: sector, date: fields.get('date'), shiftId: fields.get('shift'), teamId: fields.get('team'), staffIds: selectedIds(event.currentTarget) })
  }}>
    <h2>{entry ? 'Editar turno' : 'Registrar turno'}</h2>
    <label className="field">Setor<select value={sector} disabled={Boolean(entry)} required onChange={e => setSector(e.target.value)}><option value="">Selecione</option>{listOptions(options.sectors)}</select></label>
    <label className="field">Data<input name="date" type="date" defaultValue={entry?.date} readOnly={Boolean(entry)} required/></label>
    <label className="field">Turno<select name="shift" defaultValue={entry?.shiftId ?? ''} required>
      <option value="">Selecione</option>{listOptions(entry ? options.shifts.filter(item => item.id === entry.shiftId) : options.shifts)}
    </select></label>
    <label className="field">Equipe<select key={sector} name="team" defaultValue={entry?.teamId ?? ''} required>
      <option value="">Selecione</option>{listOptions(teams)}
    </select></label>
    {sector&&!teams.length&&<p>Cadastre uma equipe vinculada ao setor antes de registrar um turno.</p>}
    <fieldset className="journey" key={'staff-'+sector}><legend>Profissionais no turno</legend>
      {staff.length ? staff.map(person => <label className="checkbox-field" key={person.id}>
        <input type="checkbox" name="staff" value={person.id} defaultChecked={entry?.staff.some(item => item.id === person.id)}/>{person.name}
      </label>) : <p>Nenhum profissional disponível neste setor.</p>}
    </fieldset>
    <Notice error={save.error}/><Success message={save.data?.message}/>
    <div className="toolbar"><button className="secondary" type="button" onClick={close}>Fechar</button>
      <button className="primary" disabled={!teams.length||save.isPending}>{save.isPending?'Salvando…':'Salvar escala'}</button></div>
  </form>
}

export function RosterPanel() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [month, setMonth] = useState(currentMonth), [sectorId, setSectorId] = useState('')
  const [edit, setEdit] = useState(null)
  const options = useQuery({ queryKey: ['roster-options'], queryFn: () => api.get('/admin/roster/options').then(unwrap) })
  const list = useQuery({ queryKey: ['roster', month, sectorId], enabled: Boolean(month), queryFn: () => api.get('/admin/roster', { params: { month, sectorId: sectorId || undefined } }).then(unwrap) })
  const staff = useMutation({
    mutationFn: input => api.post('/admin/roster/staff', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roster-options'] }),
  })
  const writable = can(user, 'roster.write')
  return <AdminLayout>
    <header className="section-heading"><h1>Escala mensal</h1><p>Organize equipes por setor, data e turno. Os indicadores são calculados por equipe.</p></header>
    <Notice error={options.error || list.error} loading={options.isLoading || list.isLoading}/>
    {options.data&&<>
      <div className="toolbar">
        <label className="field">Mês de trabalho<input type="month" value={month} onChange={e=>{setMonth(e.target.value);setEdit(null)}}/></label>
        <label className="field">Setor<select value={sectorId} onChange={e=>{setSectorId(e.target.value);setEdit(null)}}>
          <option value="">Todos</option>{listOptions(options.data.sectors)}
        </select></label>
        {writable&&<button className="primary" onClick={()=>setEdit({})}>Registrar turno</button>}
      </div>
      {writable&&<details className="card form-card"><summary>Cadastrar profissional</summary>
        <form onSubmit={event=>{
          event.preventDefault()
          const form=event.currentTarget
          const fields=new FormData(form)
          staff.mutate({sectorId:fields.get('sector'),name:fields.get('name')},{onSuccess:()=>form.reset()})
        }}>
          <label className="field">Setor do profissional<select name="sector" required><option value="">Selecione</option>{listOptions(options.data.sectors)}</select></label>
          <label className="field">Nome do profissional<input name="name" minLength={2} maxLength={120} required/></label>
          <button className="primary" disabled={staff.isPending}>Cadastrar profissional</button>
          <Notice error={staff.error}/><Success message={staff.data?.message}/>
        </form>
      </details>}
      {edit&&<RosterEditor key={edit.date ? edit.sectorId+edit.date+edit.shiftId : 'new'} sectorId={sectorId} options={options.data}
        entry={edit.date?edit:null} close={()=>setEdit(null)}/>}
    </>}
    <Notice empty={list.data?.length===0&&'Nenhum turno registrado para este mês.'}/>
    {Boolean(list.data?.length)&&<div className="table-scroll" tabIndex={0} role="region" aria-label="Escalas do mês"><table className="table">
      <thead><tr>{['Data','Setor','Turno','Equipe','Profissionais',...(writable?['Ações']:[])].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{list.data.map(row=><tr key={row.sectorId+row.date+row.shiftId}>
        <td>{date(row.date)}</td><td>{row.sector}</td><td>{row.shift}</td><td>{row.team}</td><td>{row.staff.map(p=>p.name).join(', ')||'—'}</td>
        {writable&&<td><button className="secondary" onClick={()=>setEdit(row)}>Editar turno</button></td>}
      </tr>)}</tbody>
    </table></div>}
  </AdminLayout>
}

function CaseDetails({ id, close }) {
  const queryClient=useQueryClient()
  const { user }=useAuth()
  const query=useQuery({queryKey:['ombudsman-case',id],queryFn:()=>api.get('/admin/ombudsman/'+id).then(unwrap)})
  const contact=useMutation({mutationFn:requestId=>api.get('/admin/return-requests/'+requestId+'/contact').then(unwrap)})
  const save=useMutation({
    mutationFn:body=>api.post('/admin/ombudsman/'+id+'/actions',body),
    onSuccess:async()=>{
      await Promise.all([queryClient.invalidateQueries({queryKey:['ombudsman-case',id]}),queryClient.invalidateQueries({queryKey:['ombudsman']})])
    },
  })
  const entry=query.data
  useEffect(()=>{contact.reset()},[entry?.returnStatus])
  return <section className="card form-card" aria-label="Detalhes da manifestação">
    <h2>Manifestação {id.slice(0,8)}</h2>
    <Notice error={query.error} loading={query.isLoading}/>
    {entry&&<>
      <p><strong>Setores</strong> {entry.sectors||'—'} · <strong>Nota geral</strong> {entry.overallRating??'—'}</p>
      {entry.complaint&&<p><strong>Reclamação</strong> {entry.complaint}</p>}
      {entry.returnStatus?<p><strong>Solicitação de retorno</strong> {statusLabels[entry.returnStatus]}</p>:<p>Retorno não solicitado.</p>}
      {entry.returnId&&can(user,'return_requests.manage')&&<div className="toolbar">
        <Link className="secondary" to={'/admin/retornos?retorno='+entry.returnId}>Acompanhar retorno</Link>
        <button className="secondary" disabled={contact.isPending} onClick={()=>contact.data?contact.reset():contact.mutate(entry.returnId)}>
          {contact.data?'Ocultar contato':'Consultar contato autorizado'}
        </button>
      </div>}
      <Notice error={contact.error}/>{contact.data&&<p><strong>Contato informado</strong> {contact.data.contact}</p>}
      <h3>Histórico de atendimento</h3>
      {entry.history.length?<ul>{entry.history.map(item=><li key={item.id}>
        {date(item.createdAt)} · {item.actor} · {statusLabels[item.status]} · {priorityLabels[item.priority]}<p>{item.note}</p>
      </li>)}</ul>:<p>Nenhuma providência registrada.</p>}
      <form key={entry.history[0]?.id??'initial'} onSubmit={event=>{
        event.preventDefault()
        save.mutate(Object.fromEntries(new FormData(event.currentTarget)))
      }}>
        <label className="field">Situação<select name="status" defaultValue={entry.status}>
          {({open:['open','in_progress'],in_progress:['in_progress','closed'],closed:['closed','in_progress']})[entry.status].map(status=><option key={status} value={status}>{statusLabels[status]}</option>)}
        </select></label>
        <label className="field">Prioridade<select name="priority" defaultValue={entry.priority}>
          {Object.entries(priorityLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select></label>
        <label className="field">Providência, sem dados pessoais<textarea name="note" rows={3} minLength={3} maxLength={1500} required/></label>
        <Notice error={save.error}/><Success message={save.data?.message}/>
        <div className="toolbar"><button className="secondary" type="button" onClick={close}>Fechar</button>
          <button className="primary" disabled={save.isPending}>Registrar providência</button></div>
      </form>
    </>}
    {!entry&&<button className="secondary" onClick={close}>Fechar</button>}
  </section>
}

export function OmbudsmanPanel() {
  const [filters,setFilters]=useState({})
  const [page,setPage]=useState(1)
  const [selected,setSelected]=useState('')
  const sectors=useQuery({queryKey:['ombudsman-sectors'],queryFn:()=>api.get('/public/sectors').then(unwrap)})
  const query=useQuery({queryKey:['ombudsman',filters,page],queryFn:()=>api.get('/admin/ombudsman',{params:{...filters,page,limit:15}}),refetchInterval:30000})
  const rows=query.data?.data??[]
  return <AdminLayout>
    <header className="section-heading"><h1>Fila da Ouvidoria</h1><p>Acompanhe notas baixas, reclamações e pedidos de retorno.</p></header>
    <form className="card analysis-filters" aria-label="Filtros da Ouvidoria" onSubmit={event=>{
      event.preventDefault()
      setFilters(Object.fromEntries([...new FormData(event.currentTarget)].filter(([,value])=>value)))
      setPage(1)
      setSelected('')
    }}>
      <div className="analysis-fields">
        <label className="field">Data inicial (UTC)<input name="from" type="date"/></label>
        <label className="field">Data final (UTC)<input name="to" type="date"/></label>
        <label className="field">Setor<select name="sectorId"><option value="">Todos</option>{listOptions(sectors.data??[])}</select></label>
        <label className="field">Situação<select name="status"><option value="">Todas</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="field">Prioridade<select name="priority"><option value="">Todas</option>{Object.entries(priorityLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <div className="toolbar"><button className="primary">Aplicar filtros</button><button type="reset" className="secondary" onClick={()=>{setFilters({});setPage(1);setSelected('')}}>Limpar filtros</button></div>
    </form>
    <Notice error={query.error||sectors.error} loading={query.isLoading} empty={query.data&&!rows.length&&'Nenhuma manifestação corresponde aos filtros.'}/>
    {selected&&<CaseDetails key={selected} id={selected} close={()=>setSelected('')}/>}
    {rows.length>0&&<div className="table-scroll" tabIndex={0} role="region" aria-label="Manifestações"><table className="table">
      <thead><tr>{['Data','Setores','Nota geral','Prioridade','Situação','Ações'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{rows.map(item=><tr key={item.id}><td>{date(item.createdAt)}</td><td>{item.sectors||'—'}</td><td>{item.overallRating??'—'}</td>
        <td>{priorityLabels[item.priority]}</td><td>{statusLabels[item.status]}</td><td><button className="secondary" onClick={()=>setSelected(item.id)}>Abrir manifestação</button></td></tr>)}</tbody>
    </table></div>}
    <Pagination pagination={query.data?.pagination} disabled={query.isFetching} onPage={setPage}/>
  </AdminLayout>
}
