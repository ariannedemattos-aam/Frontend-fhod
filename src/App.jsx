import {useState,useEffect,useRef} from 'react';import {Routes,Route,Navigate,Link,useLocation,useNavigate,useParams} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query';import {useForm} from 'react-hook-form';import {z} from 'zod';import {zodResolver} from '@hookform/resolvers/zod'
import {surveyService} from './services/surveyService';import {useSurvey} from './contexts/SurveyContext';import {useAuth} from './contexts/AuthContext';import {QuestionRenderer} from './components/QuestionRenderer';import {ProtectedRoute} from './components/ProtectedRoute'
import {AdminLayout, Dashboard, QuestionsAdmin, NewQuestion, TvWall} from './components/AdminPanels';
import { startPage } from './services/profileAccess';
import { RosterPanel, OmbudsmanPanel } from './components/OperationsPanels';
import {AdminCatalog} from './components/AdminCatalog';
import {InvitationEntry, InvitationPanel} from './components/InvitationPanels';
import {NotificationInbox} from './components/NotificationControls';
import {EvaluationsPanel, FeedbackPanel, ReturnsPanel} from './components/AnalysisPanels';
const Demo=()=>import.meta.env.VITE_ENABLE_MOCKS!=='false'?<div className="demo">Ambiente de demonstração — dados simulados</div>:null
function PublicFrame({children}){
  const { pathname }=useLocation(), {clear}=useSurvey(), nav=useNavigate();
  const heading=useRef(null);
  useEffect(()=>{const h=heading.current?.querySelector('h1');if(h){h.tabIndex=-1;h.focus();}},[pathname]);
  const ongoing=pathname.startsWith('/pesquisa/') && pathname!=='/pesquisa/concluida';
  return <><Demo/><main ref={heading} className="public"><div className="brand">Fundação Hospitalar Dr. Oswaldo Diesel</div>{children}
    {ongoing&&<footer className="public-exit"><button type="button" className="text-button" onClick={()=>{
      if(window.confirm('Deseja sair da pesquisa? O rascunho deste dispositivo será descartado.')){clear();nav('/pesquisa');}
    }}>Sair da pesquisa</button></footer>}
  </main></>;
}
function Welcome(){return <PublicFrame><section className="card hero"><p className="step-label">Pesquisa de satisfação</p><h1>Sua opinião faz a diferença!</h1><p className="lead">Queremos saber como foi o seu atendimento para continuar melhorando nossos serviços.</p><Link className="primary" to="/pesquisa/atendimento">Iniciar avaliação</Link><nav className="public-links" aria-label="Outros acessos"><Link to="/login">Acesso de colaboradores</Link><Link to="/tvwall">Painel público</Link></nav><p className="privacy">Suas respostas são tratadas com privacidade. Você só fornece contato se desejar retorno.</p></section></PublicFrame>}
function SectorAttendance(){
  const {sectorId}=useParams();
  return <Attendance key={sectorId} sectorId={sectorId}/>;
}
function Attendance({sectorId}){
  const nav=useNavigate(),{survey,update,beginSector}=useSurvey();
  const [selectedId,setSelectedId]=useState(null),[serviceId,setServiceId]=useState(''),[shiftId,setShiftId]=useState(''),[date,setDate]=useState(''),[stageIds,setStageIds]=useState([]);
  const catalog=useQuery({queryKey:['survey-sectors'],queryFn:surveyService.sectors});
  const selected=catalog.data?.find(item=>item.id===(sectorId||selectedId));
  const services=useQuery({queryKey:['survey-sectors','services',selected?.id],queryFn:()=>surveyService.services(selected.id),enabled:Boolean(selected)});
  const selectedService=services.data?.find(item=>item.id===(serviceId||(services.data.length===1?services.data[0].id:'')));
  const shifts=useQuery({queryKey:['survey-shifts'],queryFn:surveyService.shifts});
  const journey=useQuery({queryKey:['service-stages',selectedService?.id],queryFn:()=>surveyService.stages(selectedService.id),enabled:Boolean(selectedService)});
  const shift=shifts.data?.find(item=>item.id===shiftId);
  const choose=()=>{
    if(!selectedService||!shift)return;
    const attendance={id:selected.id,name:selected.name,serviceId:selectedService.id,serviceName:selectedService.name,shiftId:shift.id,shiftName:shift.name,attendanceDate:date||undefined,stageIds,attendanceKey:crypto.randomUUID()};
    if(sectorId) beginSector(attendance);
    else update({attendances:[...survey.attendances,attendance]});
    nav('/pesquisa/outros-atendimentos');
  };
  const error=catalog.error||services.error||shifts.error;
  return <PublicFrame><h1 className="title">{selected&&sectorId?selected.name:'Qual atendimento você recebeu?'}</h1>
    <p className="lead">{sectorId?'Informe o serviço e o turno do atendimento.':'Selecione um setor e informe o serviço e o turno do atendimento.'}</p>
    {(catalog.isLoading||services.isLoading||shifts.isLoading)&&<p className="state" role="status">Carregando atendimentos…</p>}
    {error&&<p className="error" role="alert">{error.message}</p>}
    {sectorId&&catalog.data&&!selected&&<p role="alert">Este link de setor está indisponível. <Link to="/pesquisa">Abrir pesquisa geral</Link></p>}
    {!sectorId&&catalog.data?.length===0&&<p className="state">Nenhum atendimento disponível.</p>}
    {!sectorId&&<div className="grid">{catalog.data?.map(s=><button className="attendance" key={s.id} aria-pressed={selected?.id===s.id} onClick={()=>{setSelectedId(s.id);setServiceId('');setStageIds([])}}><strong>{s.name}</strong>{s.description}</button>)}</div>}
    {services.data?.length===0&&<p className="state">Este setor ainda não possui serviço ativo. <Link to="/pesquisa">Abrir pesquisa geral</Link></p>}
    {selected&&services.data?.length>0&&<form className="card form-card" onSubmit={event=>{event.preventDefault();choose()}}>
      {sectorId&&(survey.id||survey.attendances.length>0)&&<p>Confirmar iniciará uma nova pesquisa no lugar do rascunho atual.</p>}
      <label className="field">Serviço<select aria-label="Serviço" required value={selectedService?.id||''} onChange={e=>{setServiceId(e.target.value);setStageIds([])}}><option value="" disabled>Selecione</option>{services.data.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="field">Turno<select aria-label="Turno" required value={shiftId} onChange={e=>setShiftId(e.target.value)}><option value="" disabled>Selecione</option>{shifts.data?.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="field">Data do atendimento (opcional)<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label>
      {journey.isLoading&&<p role="status">Carregando etapas…</p>}
      {journey.error&&<p className="error" role="alert">Não foi possível carregar as etapas. <button type="button" className="text-button" onClick={()=>journey.refetch()}>Tentar novamente</button></p>}
      {journey.data?.length>0&&<fieldset className="journey"><legend>Quais etapas você realizou? (opcional)</legend>
        <p>Marque as etapas de que se lembra. Você pode continuar sem marcar nenhuma.</p>
        <div className="grid">{journey.data.map(stage=><label className="choice" key={stage.id}>
          <input type="checkbox" checked={stageIds.includes(stage.id)} onChange={event=>setStageIds(event.target.checked?[...stageIds,stage.id]:stageIds.filter(id=>id!==stage.id))}/>
          {stage.name}
        </label>)}</div>
      </fieldset>}
      <button className="primary" disabled={!selectedService||!shift||journey.isLoading||Boolean(journey.error)}>Confirmar atendimento</button>
    </form>}</PublicFrame>
}
function More(){const nav=useNavigate(),{survey,update}=useSurvey();return <PublicFrame><h1 className="title">Você recebeu outro atendimento?</h1><div className="card"><p className="lead">Atendimentos selecionados:</p><ul>{survey.attendances.map((a,i)=><li key={i}>{[a.name,a.serviceName,a.shiftName].filter(Boolean).join(' · ')} <button type="button" className="text-button" onClick={()=>update({attendances:survey.attendances.filter((_,x)=>x!==i)})}>Remover</button></li>)}</ul><div className="actions"><button className="secondary" onClick={()=>nav('/pesquisa/atendimento')}>Sim, recebi outro atendimento</button><button className="primary" disabled={!survey.attendances.length} onClick={()=>nav('/pesquisa/perguntas')}>Não, continuar avaliação</button></div></div></PublicFrame>}

function SurveyBootstrap({children}){
  const {survey,update}=useSurvey();
  const [error,setError]=useState('');
  const pending=useRef();
  const prepared=Boolean(survey.id&&survey.started!==false);
  useEffect(()=>{
    if(prepared||!survey.attendances.length)return;
    let active=true;
    pending.current ??= (async()=>{
      const shifts=await surveyService.shifts();
      if(!shifts.length)throw new Error('Nenhum turno disponível.');
      const {id,surveyToken:token}=survey.id?{id:survey.id,surveyToken:survey.token}:await surveyService.create();
      for(const attendance of survey.attendances){
        const serviceId=attendance.serviceId ?? (await surveyService.services(attendance.id))[0]?.id;
        if(!serviceId)throw new Error('Nenhum serviço disponível para este setor.');
        await surveyService.addAttendance(id,token,{sectorId:attendance.id,serviceId,shiftId:attendance.shiftId ?? shifts[0].id,attendanceKey:attendance.attendanceKey,attendanceDate:attendance.attendanceDate,stageIds:attendance.stageIds});
      }
      await surveyService.start(id,token);
      return {id,token,started:true};
    })();
    pending.current.then(data=>{if(active)update(data)}).catch(error=>{if(active)setError(error.message)});
    return()=>{active=false};
  },[prepared,survey.id,survey.token,survey.attendances,update]);
  if(!prepared&&!survey.attendances.length)return <Navigate to="/pesquisa/atendimento" replace/>;
  if(error)return <PublicFrame><p className="error" role="alert">{error}</p></PublicFrame>;
  return prepared?children:<PublicFrame><p>Preparando sua pesquisa…</p></PublicFrame>
}

function Questions(){
  const nav=useNavigate(), {survey,update}=useSurvey();
  const query=useQuery({queryKey:['questions',survey.id],queryFn:()=>surveyService.questions(survey.id,survey.token),enabled:!!survey.id});
  const questions=query.data??[];
  const [activeId,setActiveId]=useState(null),[saveError,setSaveError]=useState(''),[saving,setSaving]=useState(false);
  const title=useRef(null);
  const activeIndex=Math.max(questions.findIndex(q=>q.id===activeId),0);
  const q=questions[activeIndex];
  useEffect(()=>{if(q) title.current?.focus();},[q?.id]);
  if(query.isLoading)return <PublicFrame><p role="status">Carregando perguntas…</p></PublicFrame>;
  if(query.error&&!q)return <PublicFrame><p className="error" role="alert">{query.error.message}</p><button className="secondary" onClick={()=>query.refetch()}>Tentar novamente</button></PublicFrame>;
  if(!q)return <Navigate to="/pesquisa/pontos-positivos" replace/>;
  const val=survey.answers[q.id];
  const next=async()=>{
    setSaving(true);
    setSaveError('');
    try{
      let visible=questions;
      if(Object.hasOwn(survey.answers,q.id)){
        await surveyService.answer(survey.id,survey.token,q.id,Array.isArray(val)&&!val.length?null:val);
        visible=(await query.refetch({throwOnError:true})).data;
      }
      const index=visible.findIndex(item=>item.id===q.id);
      const following=visible[index+1];
      if(following) setActiveId(following.id);
      else nav('/pesquisa/pontos-positivos');
    }catch(error){setSaveError(error.message)}
    finally{setSaving(false)}
  };
  return <PublicFrame>
    <p className="step-label">Pergunta {activeIndex+1} · {q.stage&&q.stage+' · '}Opcional</p>
    <h1 className="title" ref={title} tabIndex={-1}>{q.text}</h1>
    <QuestionRenderer key={q.id+(val===null?'--vazia':'')} question={q.type==='rating'?{...q,type:'rating_1_5'}:q} value={val} onChange={v=>update({answers:{...survey.answers,[q.id]:v}})}/>
    {val!=null&&<button type="button" className="text-button" disabled={saving}
      onClick={()=>update({answers:{...survey.answers,[q.id]:null}})}>Limpar resposta</button>}
    {saveError&&<p className="error" role="alert">{saveError}</p>}
    <div className="actions">
      <button className="secondary" disabled={saving||!activeIndex} onClick={()=>setActiveId(questions[activeIndex-1].id)}>Voltar</button>
      <button className="primary" disabled={saving} onClick={next}>{saving?'Salvando…':'Continuar'}</button>
    </div>
  </PublicFrame>;
}
function TextStep({kind,title,next,optional=false}){const nav=useNavigate(),{survey,update}=useSurvey();return <PublicFrame><h1 className="title">{title}</h1><p className="lead">{optional?'Esta resposta é opcional. Evite informar nomes, documentos ou contatos.':'Conte-nos com suas palavras.'}</p><textarea rows="6" maxLength="500" aria-label={title} value={survey[kind]||''} onChange={e=>update({[kind]:e.target.value})}/>{kind==='positive'&&<label className="checkbox-field"><input type="checkbox" checked={Boolean(survey.isPraise)} onChange={event=>update({isPraise:event.target.checked})}/> Registrar como elogio</label>}<div className="actions"><button className="secondary" onClick={()=>nav(-1)}>Voltar</button><button className="primary" onClick={()=>nav(next)}>Continuar</button></div></PublicFrame>}
function Return(){const nav=useNavigate(),{survey,update}=useSurvey();const [want,setWant]=useState(survey.returnRequest?.want||false);return <PublicFrame><h1 className="title">Deseja que entremos em contato?</h1><p className="lead">Se desejar retorno sobre sua experiência, deixe um meio de contato.</p><div className="grid"><label className="choice"><input type="radio" name="return" checked={want} onChange={()=>setWant(true)}/>Sim, desejo retorno</label><label className="choice"><input type="radio" name="return" checked={!want} onChange={()=>setWant(false)}/>Não, obrigado</label>{want&&<label className="field">Telefone ou e-mail<input maxLength={255} aria-label="Telefone ou e-mail" value={survey.returnRequest?.contact||''} onChange={e=>update({returnRequest:{want:true,contact:e.target.value}})}/></label>}</div><div className="actions"><button className="secondary" onClick={()=>nav(-1)}>Voltar</button><button className="primary" disabled={want&&!survey.returnRequest?.contact?.trim()} onClick={()=>{update({returnRequest:{...(survey.returnRequest||{}),want}});nav('/pesquisa/avaliacao-geral')}}>Continuar</button></div></PublicFrame>}
function Overall(){const nav=useNavigate(),{survey,clear}=useSurvey();const [score,setScore]=useState(survey.overall);const [error,setError]=useState(''),[sending,setSending]=useState(false);
  if(!survey.id)return <Navigate to="/pesquisa/atendimento" replace/>;
  const submit=async()=>{
    setError('');setSending(true);
    try{
      if(survey.positive||survey.negative||survey.comments)await surveyService.feedback(survey.id,survey.token,{[survey.isPraise?'praise':'positive']:survey.positive,negative:survey.negative,suggestion:survey.comments});
      if(survey.returnRequest?.want)await surveyService.returnRequest(survey.id,survey.token,{contact:survey.returnRequest.contact});
      await surveyService.complete(survey.id,survey.token,score);
      clear();nav('/pesquisa/concluida');
    }catch(error){setError(error.message)}finally{setSending(false)}
  };return <PublicFrame><h1 className="title">Que nota você dá ao hospital de modo geral?</h1><QuestionRenderer question={{id:'overall',type:'rating_0_10'}} value={score} onChange={setScore}/>{error&&<p className="error">{error}</p>}<div className="actions"><button className="secondary" onClick={()=>nav(-1)}>Voltar</button><button className="primary" disabled={score===undefined||sending} onClick={submit}>Enviar avaliação</button></div></PublicFrame>}
function ThankYou(){return <PublicFrame><section className="card hero"><h1>Obrigado pela sua avaliação!</h1><p className="lead">Sua opinião ajuda a melhorar o cuidado oferecido pela Fundação Hospitalar Dr. Oswaldo Diesel.</p><Link className="primary" to="/">Finalizar</Link></section></PublicFrame>}
const schema=z.object({email:z.string().email('Informe um e-mail válido'),password:z.string().min(1,'Informe a senha')})
function Login(){const {login}=useAuth(),nav=useNavigate(),{state}=useLocation();const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm({resolver:zodResolver(schema)});const [error,setError]=useState('');const submit=async v=>{try{const user=await login(v);nav(startPage(user))}catch(e){setError(e.message)}};return <PublicFrame><section className="card"><h1 className="title">Acesso de colaboradores</h1>{state?.logoutWarning&&<p className="error" role="alert">{state.logoutWarning}</p>}<form onSubmit={handleSubmit(submit)}><label className="field">E-mail<input type="email" autoComplete="email" {...register('email')}/>{errors.email&&<span className="error">{errors.email.message}</span>}</label><label className="field">Senha<input type="password" autoComplete="current-password" {...register('password')}/>{errors.password&&<span className="error">{errors.password.message}</span>}</label>{error&&<p className="error">{error}</p>}<button className="primary" type="submit" disabled={isSubmitting} style={{marginTop:20}}>{isSubmitting?'Entrando…':'Entrar'}</button></form></section></PublicFrame>}
function AccessRecovery(){
  const {user}=useAuth();
  return <Link to={user&&startPage(user)!=='/403'?startPage(user):'/login'}>Voltar à área de acesso</Link>;
}
const Page404=()=> <PublicFrame><h1 className="title">Página não encontrada</h1><Link to="/">Voltar ao início</Link></PublicFrame>
export function App(){return <Routes><Route path="/" element={<Welcome/>}/><Route path="/pesquisa" element={<Welcome/>}/><Route path="/pesquisa/convite" element={<PublicFrame><InvitationEntry/></PublicFrame>}/><Route path="/pesquisa/setor/:sectorId" element={<SectorAttendance/>}/><Route path="/pesquisa/atendimento" element={<Attendance/>}/><Route path="/pesquisa/outros-atendimentos" element={<More/>}/><Route path="/pesquisa/perguntas" element={<SurveyBootstrap><Questions/></SurveyBootstrap>}/><Route path="/pesquisa/pontos-positivos" element={<TextStep kind="positive" title="O que mais gostou no atendimento?" next="/pesquisa/pontos-negativos" optional/>}/><Route path="/pesquisa/pontos-negativos" element={<TextStep kind="negative" title="Você quer registrar uma reclamação ou ponto de melhoria?" next="/pesquisa/comentarios" optional/>}/><Route path="/pesquisa/comentarios" element={<TextStep kind="comments" title="Deseja deixar uma sugestão ou comentário?" next="/pesquisa/retorno" optional/>}/><Route path="/pesquisa/retorno" element={<Return/>}/><Route path="/pesquisa/avaliacao-geral" element={<Overall/>}/><Route path="/pesquisa/concluida" element={<ThankYou/>}/><Route path="/login" element={<Login/>}/><Route path="/tvwall" element={<TvWall/>}/><Route path="/403" element={<PublicFrame><h1>Acesso não autorizado</h1><AccessRecovery/></PublicFrame>}/><Route path="/setor/perguntas" element={<ProtectedRoute roles={['UserSetor','UserAdmin']}><QuestionsAdmin sector/></ProtectedRoute>}/><Route path="/setor/perguntas/nova" element={<ProtectedRoute roles={['UserSetor','UserAdmin']}><NewQuestion sector/></ProtectedRoute>}/><Route path="/admin/cadastros" element={<ProtectedRoute roles={['UserAdmin']}><AdminCatalog/></ProtectedRoute>}/><Route path="/admin/configuracoes" element={<Navigate to="/admin/cadastros" replace/>}/><Route path="/admin/perguntas/:id/editar" element={<ProtectedRoute roles={['UserAdmin']}><NewQuestion/></ProtectedRoute>}/><Route path="/setor/perguntas/:id/editar" element={<ProtectedRoute roles={['UserSetor']}><NewQuestion sector/></ProtectedRoute>}/><Route path="/admin/dashboard" element={<ProtectedRoute permissions={['dashboard.read']}><Dashboard/></ProtectedRoute>}/><Route path="/admin/perguntas" element={<ProtectedRoute roles={['UserAdmin']}><QuestionsAdmin/></ProtectedRoute>}/><Route path="/admin/perguntas/nova" element={<ProtectedRoute roles={['UserAdmin']}><NewQuestion/></ProtectedRoute>}/><Route path="/admin/avaliacoes" element={<ProtectedRoute permissions={['surveys.read']}><EvaluationsPanel key="evaluations"/></ProtectedRoute>}/><Route path="/admin/feedback" element={<ProtectedRoute permissions={['feedback.read']}><FeedbackPanel/></ProtectedRoute>}/><Route path="/setor/feedback" element={<ProtectedRoute roles={['UserSetor']}><FeedbackPanel/></ProtectedRoute>}/><Route path="/admin/retornos" element={<ProtectedRoute permissions={['return_requests.manage']}><ReturnsPanel/></ProtectedRoute>}/><Route path="/admin/relatorios" element={<ProtectedRoute permissions={['reports.export','surveys.read']}><EvaluationsPanel key="reports" report/></ProtectedRoute>}/><Route path="/admin/convites" element={<ProtectedRoute roles={['UserAdmin']}><AdminLayout><InvitationPanel/></AdminLayout></ProtectedRoute>}/><Route path="/admin/escalas" element={<ProtectedRoute permissions={['roster.read']}><RosterPanel/></ProtectedRoute>}/>
    <Route path="/admin/ouvidoria" element={<ProtectedRoute permissions={['ombudsman.manage']}><OmbudsmanPanel/></ProtectedRoute>}/>
    <Route path="/notificacoes"  element={<ProtectedRoute><AdminLayout><NotificationInbox/></AdminLayout></ProtectedRoute>}/><Route path="*" element={<Page404/>}/></Routes>}
