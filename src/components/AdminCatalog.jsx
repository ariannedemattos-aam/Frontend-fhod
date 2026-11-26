import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AccountAccess } from './AccountAccess'
import { AdminLayout } from './AdminPanels'
import { Notice, Pagination, SearchField, Success } from './AdminFeedback'
import { api, unwrap } from '../services/api'
import { surveyService } from '../services/surveyService'

function SectorSurveyLink({ sector, close }) {
  const link = new URL('/pesquisa/setor/' + sector.id, window.location.origin).href
  const [qr, setQr] = useState('')
  const [qrError, setQrError] = useState(null)
  const [copyError, setCopyError] = useState(null)
  const [message, setMessage] = useState('')
  const services = useQuery({ queryKey: ['survey-sectors', 'services', sector.id], queryFn: () => surveyService.services(sector.id) })
  useEffect(() => {
    let active = true
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(link, { width: 300, margin: 3, errorCorrectionLevel: 'M' }))
      .then(image => { if (active) setQr(image) })
      .catch(() => { if (active) setQrError(new Error('Não foi possível gerar o QR Code.')) })
    return () => { active = false }
  }, [link])

  async function copy() {
    setCopyError(null)
    setMessage('')
    try {
      await navigator.clipboard.writeText(link)
      setMessage('Link copiado.')
    } catch {
      setCopyError(new Error('Selecione o endereço no campo do link para copiá-lo.'))
    }
  }

  return <section className="card invitation-result" aria-label="Pesquisa do setor">
    <div>
      <h3>Pesquisa de {sector.name}</h3>
      <p>O mesmo endereço pode ser usado por várias pessoas e abre a pesquisa neste setor.</p>
      <Notice error={services.error} loading={services.isLoading} empty={services.data?.length === 0 && 'Cadastre um serviço ativo neste setor antes de divulgar a pesquisa.'} />
      <label className="field">Link do setor<input readOnly value={link} onFocus={event => event.currentTarget.select()} /></label>
      <div className="toolbar">
        <button type="button" className="secondary" onClick={copy}>Copiar link</button>
        <a className="secondary" href={link} target="_blank" rel="noopener">Abrir pesquisa</a>
        <button type="button" className="secondary" onClick={close}>Fechar</button>
      </div>
      <Notice error={qrError || copyError} /><Success message={message} />
    </div>
    {qr && <figure className="invitation-qr">
      <img src={qr} width="250" height="250" alt={'QR Code da pesquisa de ' + sector.name} />
      <figcaption><a className="secondary" href={qr} download={'pesquisa-' + sector.slug + '.png'}>Baixar QR Code</a></figcaption>
    </figure>}
  </section>
}

const resources = {
  sectors: { label: 'Setores', fields: ['slug'] },
  services: { label: 'Serviços', fields: ['slug', 'sector_id'] },
  stages: { label: 'Etapas', fields: [] },
  teams: { label: 'Equipes', fields: ['sector_id', 'service_id'] },
  shifts: { label: 'Turnos', fields: ['display_order'] },
  users: { label: 'Usuários', detail: row => row.email },
  roles: { label: 'Papéis' },
  permissions: { label: 'Permissões', detail: row => row.description },
}

async function referenceList(resource) {
  const result = []
  let page = 1
  while (true) {
    const response = await api.get('/admin/' + resource, { params: { page, limit: 100 } })
    result.push(...response.data)
    if (page >= response.pagination.totalPages) return result
    page += 1
  }
}

function CatalogForm({ resource, entry, lists, onCancel, onSaved }) {
  const fields = resources[resource].fields
  const [sector, setSector] = useState(entry?.sector_id ?? '')
  const [service, setService] = useState(entry?.service_id ?? '')
  const services = (lists.services ?? []).filter(item => !sector || item.sector_id === sector)
  const save = useMutation({
    mutationFn: input => entry
      ? api.put('/admin/' + resource + '/' + entry.id, input)
      : api.post('/admin/' + resource, input),
    onSuccess: onSaved,
  })
  return (
    <form className="card form-card" onSubmit={event => {
      event.preventDefault()
      const values = new FormData(event.currentTarget)
      const data = { name: values.get('name').trim(), description: values.get('description').trim() || null }
      for (const field of fields) {
        const raw = values.get(field).trim()
        data[field] = field === 'display_order' ? Number(raw || 0) : raw || null
      }
      save.mutate(data)
    }}>
      <h2>{entry ? 'Editar registro' : 'Novo registro'}</h2>
      <label className="field">Nome<input name="name" required autoFocus maxLength={resource === 'shifts' ? 50 : 120} defaultValue={entry?.name} /></label>
      <label className="field">Descrição<textarea name="description" rows="3" maxLength={2000} defaultValue={entry?.description ?? ''} /></label>
      {fields.includes('slug') && <label className="field">Identificador do catálogo<input name="slug" maxLength={140} defaultValue={entry?.slug ?? ''} /></label>}
      {fields.includes('sector_id') && <label className="field">Setor
        <select name="sector_id" value={sector} onChange={event => { setSector(event.target.value); setService('') }}>
          <option value="">Sem vínculo</option>
          {lists.sectors?.map(item => <option key={item.id} value={item.id}>{item.name}{!item.is_active && ' (arquivado)'}</option>)}
        </select>
      </label>}
      {fields.includes('service_id') && <label className="field">Serviço
        <select name="service_id" value={service} onChange={event => setService(event.target.value)}>
          <option value="">Sem vínculo</option>
          {services.map(item => <option key={item.id} value={item.id}>{item.name}{!item.is_active && ' (arquivado)'}</option>)}
        </select>
      </label>}
      {fields.includes('display_order') && <label className="field">Ordem de exibição<input name="display_order" type="number" min={0} step={1} max={2147483647} defaultValue={entry?.display_order ?? 0} /></label>}
      <Notice error={save.error} />
      <div className="toolbar">
        <button type="button" className="secondary" onClick={onCancel} disabled={save.isPending}>Cancelar</button>
        <button className="primary" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar registro'}</button>
      </div>
    </form>
  )
}


function ServiceStagesForm({ service, close, saved }) {
  const client = useQueryClient()
  const query = useQuery({queryKey:['service-stage-editor',service.id],queryFn:async()=>{
    const [all,active] = await Promise.all([referenceList('stages'),surveyService.stages(service.id)])
    return { all:all.filter(item=>item.is_active), active:active.map(item=>item.id) }
  }})
  const save=useMutation({
    mutationFn:stageIds=>api.put('/admin/services/'+service.id+'/stages',{stageIds}),
    onSuccess:async response=>{
      await Promise.all([client.invalidateQueries({queryKey:['service-stages']}),client.invalidateQueries({queryKey:['service-stage-editor']}),
        client.invalidateQueries({queryKey:['question-service-config',service.id]})])
      saved(response)
    },
  })
  return <section className="card form-card" aria-label="Etapas da jornada">
    <h3>Etapas de {service.name}</h3><Notice error={query.error||save.error} loading={query.isLoading}/>
    {query.data&&<OrderedStages options={query.data.all} initial={query.data.active} close={close} save={ids=>save.mutate(ids)} busy={save.isPending}/>}
    {!query.data&&<button type="button" className="secondary" onClick={close}>Fechar</button>}
  </section>
}

function OrderedStages({ options, initial, close, save, busy }) {
  const [selected,setSelected]=useState(initial)
  return <form onSubmit={event=>{event.preventDefault();save(selected)}}>
    <fieldset className="journey"><legend>Etapas ativas no serviço</legend>
      <p>Marque na ordem do atendimento. Desmarque e marque novamente para mover uma etapa ao fim.</p>
      {options.map(item=><label key={item.id} className="checkbox-field">
        <input type="checkbox" checked={selected.includes(item.id)}
          onChange={event=>setSelected(event.target.checked?[...selected,item.id]:selected.filter(id=>id!==item.id))}/>
        {item.name}{selected.includes(item.id)&&' · '+(selected.indexOf(item.id)+1)+'ª etapa'}
      </label>)}
      {!options.length&&<p>Cadastre uma etapa ativa para vinculá-la ao serviço.</p>}
    </fieldset>
    <div className="toolbar"><button type="button" className="secondary" onClick={close}>Cancelar</button>
      <button className="primary" disabled={busy}>{busy?'Salvando…':'Salvar etapas'}</button></div>
  </form>
}

export function AdminCatalog() {
  const client = useQueryClient()
  const [resource, setResource] = useState('sectors')
  const [filters, setFilters] = useState({ search: '', status: '', page: 1 })
  const [serviceStages,setServiceStages]=useState(null)
  const [surveySector, setSurveySector] = useState(null)
  const [editor, setEditor] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [message, setMessage] = useState('')
  const confirmation = useRef(null)
  const entry = resources[resource]
  const manageAccess = resource === 'users'
  const editable = Boolean(entry.fields)
  const hasStatus = editable || resource === 'users'
  const query = useQuery({
    queryKey: ['admin-catalog', resource, filters],
    queryFn: () => api.get('/admin/' + resource, { params: { ...filters, status: filters.status || undefined, limit: 15 } }),
  })
  const linked = entry.fields?.includes('sector_id')
  const references = useQuery({
    queryKey: ['catalog-reference', resource],
    enabled: Boolean(linked),
    queryFn: async () => {
      const [sectors, services] = await Promise.all([
        referenceList('sectors'),
        resource === 'teams' ? referenceList('services') : Promise.resolve([]),
      ])
      return { sectors, services }
    },
  })
  const table = query.data
  const updateFilters = changes => setFilters(current => ({ ...current, page: 1, ...changes }))
  useEffect(() => {
    const lastPage = Math.max(table?.pagination.totalPages ?? 1, 1)
    if (table && filters.page > lastPage) setFilters(current => ({ ...current, page: lastPage }))
  }, [table, filters.page])
  useEffect(() => { if (confirm) confirmation.current?.focus() }, [confirm])

  async function refresh(result) {
    setMessage(result.message)
    setServiceStages(null)
    setSurveySector(null)
    setEditor(null)
    setConfirm(null)
    await Promise.all([
      client.invalidateQueries({ queryKey: ['admin-catalog'] }),
      client.invalidateQueries({ queryKey: ['catalog-reference'] }),
      client.invalidateQueries({ queryKey: ['survey-sectors'] }),
      client.invalidateQueries({ queryKey: ['survey-shifts'] }),
      client.invalidateQueries({ queryKey: ['question-services'] }),
    ])
  }
  const status = useMutation({
    mutationFn: row => api.patch('/admin/' + resource + '/' + row.id + '/status', { active: !row.is_active }),
    onSuccess: refresh,
  })
  return (
    <AdminLayout>
      <header className="section-heading"><h1>Cadastros administrativos</h1></header>
      <nav className="catalog-tabs" aria-label="Catálogos">
        {Object.entries(resources).map(([name, config]) => (
          <button key={name} type="button" className="secondary" aria-pressed={resource === name} disabled={status.isPending} onClick={() => {
            setResource(name)
            setServiceStages(null)
            setSurveySector(null)
            setFilters({ search: '', status: '', page: 1 })
            setEditor(null)
            setConfirm(null)
            setMessage('')
            status.reset()
          }}>{config.label}</button>
        ))}
      </nav>
      <h2>{entry.label}</h2>
      <div className="toolbar catalog-toolbar">
        <SearchField label="Buscar por nome" value={filters.search} onSearch={search => updateFilters({ search })} />
        {hasStatus && <label className="field">Status<select value={filters.status} onChange={event => updateFilters({ status: event.target.value })}>
          <option value="">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option>
        </select></label>}
        {(editable||manageAccess) && <button className="primary" type="button" disabled={status.isPending} onClick={() => { setEditor({}); setMessage(''); setConfirm(null) }}>{manageAccess?'Nova conta':'Novo registro'}</button>}
      </div>
      <Success message={message} />
      {serviceStages&&<ServiceStagesForm key={serviceStages.id} service={serviceStages} close={()=>setServiceStages(null)} saved={refresh}/>}
      {surveySector && <SectorSurveyLink key={surveySector.id} sector={surveySector} close={() => setSurveySector(null)} />}
      {editor && manageAccess && <AccountAccess key={editor.id??'new'} record={editor.id?editor:null} close={()=>setEditor(null)} saved={refresh}/>}
      {editor && !manageAccess && <>
        {linked && <Notice error={references.error} loading={references.isLoading} />}
        {(!linked || references.data) && <CatalogForm key={editor.id ?? 'new'} entry={editor.id ? editor : null} resource={resource}
          lists={references.data ?? {}} onCancel={() => setEditor(null)} onSaved={refresh} />}
      </>}
      {confirm && <div ref={confirmation} tabIndex={-1} className="card form-card" role="region" aria-label="Confirmar alteração de status">
        <p>{confirm.is_active ? 'Arquivar' : 'Reativar'} <strong>{confirm.name}</strong>?</p>
        {confirm.is_active === 1 && <p>O registro sairá das novas seleções. O histórico será preservado.</p>}
        <Notice error={status.error} />
        <div className="toolbar">
          <button type="button" className="secondary" disabled={status.isPending} onClick={() => { setConfirm(null); status.reset() }}>Cancelar</button>
          <button type="button" className="primary" disabled={status.isPending} onClick={() => status.mutate(confirm)}>
            {status.isPending ? 'Salvando…' : 'Confirmar'}
          </button>
        </div>
      </div>}
      <Notice error={query.error} loading={query.isLoading} empty={table?.data.length === 0 && 'Nenhum registro encontrado.'} />
      {table?.data.length > 0 && <div className="table-scroll" tabIndex={0} role="region" aria-label={'Tabela de ' + entry.label}>
        <table className="table">
          <thead><tr><th scope="col">Nome</th>{hasStatus && <th scope="col">Status</th>}{(editable||manageAccess) && <th scope="col">Ações</th>}</tr></thead>
          <tbody>{table.data.map(row => <tr key={row.id}>
            <td><strong>{row.name}</strong>{(entry.detail?.(row) || row.description || row.slug) && <small>{entry.detail?.(row) || row.description || row.slug}</small>}</td>
            {hasStatus && <td><span className={'badge ' + (row.is_active ? '' : 'status-inactive')}>{row.is_active ? 'Ativo' : 'Inativo'}</span></td>}
            {manageAccess&&<td><button type="button" className="secondary" onClick={()=>{setEditor(row);setMessage('')}}>Gerenciar acesso</button></td>}
            {editable && <td><div className="row-actions">
              {resource==='services'&&Boolean(row.is_active)&&<button type="button" className="secondary"
                onClick={()=>{setServiceStages(row);setEditor(null);setConfirm(null)}}>Etapas da jornada</button>}
              {resource === 'sectors' && Boolean(row.is_active) && <button type="button" className="secondary" onClick={() => { setSurveySector(row); setEditor(null); setConfirm(null) }}>Link e QR Code</button>}
              <button type="button" className="secondary" onClick={() => { setEditor(row); setConfirm(null); setMessage('') }}>Editar</button>
              <button type="button" className="secondary" onClick={() => { setConfirm(row); setEditor(null); setMessage(''); status.reset() }}>{row.is_active ? 'Arquivar' : 'Reativar'}</button>
            </div></td>}
          </tr>)}</tbody>
        </table>
      </div>}
      <Pagination pagination={table?.pagination} disabled={query.isFetching} onPage={page => updateFilters({ page })} />
    </AdminLayout>
  )
}
