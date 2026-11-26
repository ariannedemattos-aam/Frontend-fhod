import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, unwrap } from '../services/api'
import { Notice } from './AdminFeedback'

const roles = { userAdmin:'Super Admin', userSetor:'Admin de Setor', gestao:'Gestão', ouvidoria:'Ouvidoria', visualizador:'Visualizador' }

function AccessForm({ record, access, sectors, close, saved }) {
  const [role,setRole]=useState(access?.role in roles ? access.role : 'visualizador')
  const save=useMutation({
    mutationFn: body=>record ? api.put('/admin/users/'+record.id+'/access',body) : api.post('/admin/users/accounts',body),
    onSuccess:saved,
  })
  const locked=access?.role==='userAdmin'
  return <form className="card form-card" onSubmit={event=>{
    event.preventDefault()
    const fields=new FormData(event.currentTarget)
    save.mutate({ role, sectorIds:role==='userSetor'?fields.getAll('sector'):[],
      ...(!record&&{name:fields.get('name'),email:fields.get('email'),password:fields.get('password')}) })
  }}>
    <h2>{record?'Acesso de '+record.name:'Nova conta de colaborador'}</h2>
    {!record&&<>
      <label className="field">Nome<input name="name" required minLength={2} maxLength={150}/></label>
      <label className="field">E-mail<input name="email" type="email" autoComplete="off" maxLength={255} required/></label>
      <label className="field">Senha inicial<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required/></label>
    </>}
    <label className="field">Perfil<select value={role} disabled={locked} onChange={event=>setRole(event.target.value)}>
      {Object.entries(roles).map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select></label>
    {role==='userSetor'&&<fieldset className="journey"><legend>Setores ativos atribuídos</legend>
      {sectors.map(item=><label key={item.id} className="checkbox-field">
        <input type="checkbox" name="sector" value={item.id} defaultChecked={access?.sectorIds.includes(item.id)}/>{item.name}
      </label>)}
    </fieldset>}
    {locked&&<p>O acesso Super Admin está protegido contra alterações nesta tela.</p>}
    <Notice error={save.error}/>
    <div className="toolbar"><button className="secondary" type="button" onClick={close}>Cancelar</button>
      {!locked&&<button className="primary" disabled={save.isPending}>Salvar acesso</button>}</div>
  </form>
}

export function AccountAccess({ record, close, saved }) {
  const existing=useQuery({queryKey:['account-access',record?.id],enabled:Boolean(record),queryFn:()=>api.get('/admin/users/'+record.id+'/access').then(unwrap)})
  const sectors=useQuery({queryKey:['survey-sectors'],queryFn:()=>api.get('/public/sectors').then(unwrap)})
  if(sectors.isLoading||(record&&existing.isLoading)) return <Notice loading/>
  if(existing.error||sectors.error) return <><Notice error={existing.error||sectors.error}/><button className="secondary" onClick={close}>Fechar</button></>
  return <AccessForm record={record} access={existing.data} sectors={sectors.data??[]} close={close} saved={saved}/>
}
