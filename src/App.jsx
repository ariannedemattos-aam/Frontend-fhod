import {useState,useEffect,useRef} from 'react';import {Routes,Route,Navigate,Link,useNavigate} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query';import {useForm} from 'react-hook-form';import {z} from 'zod';import {zodResolver} from '@hookform/resolvers/zod'
import {surveyService} from './services/surveyService';import {useSurvey} from './contexts/SurveyContext';import {useAuth} from './contexts/AuthContext';import {QuestionRenderer} from './components/QuestionRenderer';import {ProtectedRoute} from './components/ProtectedRoute'
import {AdminLayout, Dashboard, QuestionsAdmin, NewQuestion, TvWall} from './components/AdminPanels';
import {AdminCatalog} from './components/AdminCatalog';
import {EvaluationsPanel, FeedbackPanel, ReturnsPanel} from './components/AnalysisPanels';
const Demo=()=>import.meta.env.VITE_ENABLE_MOCKS!=='false'?<div className="demo">Ambiente de demonstração — dados simulados</div>:null
function PublicFrame({children}){return <><Demo/><main className="public"><div className="brand">Fundação Hospitalar Dr. Oswaldo Diesel</div>{children}</main></>}
function Welcome(){return <PublicFrame><section className="card hero"><p className="step-label">Pesquisa de satisfação</p><h1>Sua opinião faz a diferença!</h1><p className="lead">Queremos saber como foi o seu atendimento para continuar melhorando nossos serviços.</p><Link className="primary" to="/pesquisa/atendimento">Iniciar avaliação</Link><nav className="public-links" aria-label="Outros acessos"><Link to="/login">Acesso de colaboradores</Link><Link to="/tvwall">Painel público</Link></nav><p className="privacy">Suas respostas são tratadas com privacidade. Você só fornece contato se desejar retorno.</p></section></PublicFrame>}
function Attendance(){
  const nav=useNavigate(),{survey,update}=useSurvey();
  const [selected,setSelected]=useState(null),[serviceId,setServiceId]=useState(''),[shiftId,setShiftId]=useState('');
  const catalog=useQuery({queryKey:['survey-sectors'],queryFn:async()=>{const sectors=await surveyService.sectors();const found=await Promise.all(sectors.map(async s=>({...s,services:await surveyService.services(s.id)})));return found.filter(s=>s.services.length)}});
  const shifts=useQuery({queryKey:['survey-shifts'],queryFn:surveyService.shifts});
  const shift=shifts.data?.find(item=>item.id===shiftId);
  const choose=()=>{
    const service=selected.services.find(item=>item.id===serviceId);
    if(!service||!shift)return;
    update({attendances:[...survey.attendances,{id:selected.id,name:selected.name,serviceId:service.id,serviceName:service.name,shiftId:shift.id,shiftName:shift.name}]});
    nav('/pesquisa/outros-atendimentos');
  };
  return <PublicFrame><h1 className="title">Qual atendimento você recebeu?</h1><p className="lead">Selecione um setor e informe o serviço e o turno do atendimento.</p>
    {(catalog.isLoading||shifts.isLoading)&&<p className="state" role="status">Carregando atendimentos…</p>}
    {(catalog.error||shifts.error)&&<p className="error" role="alert">{(catalog.error||shifts.error).message}</p>}
    {catalog.data?.length===0&&<p className="state">Nenhum atendimento disponível.</p>}
    <div className="grid">{catalog.data?.map(s=><button className="attendance" key={s.id} aria-pressed={selected?.id===s.id} onClick={()=>{setSelected(s);setServiceId(s.services.length===1?s.services[0].id:'')}}><strong>{s.name}</strong>{s.description}</button>)}</div>
    {selected&&<form className="card form-card" onSubmit={event=>{event.preventDefault();choose()}}>
      <label className="field">Serviço<select required value={serviceId} onChange={e=>setServiceId(e.target.value)}><option value="" disabled>Selecione</option>{selected.services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="field">Turno<select required value={shiftId} onChange={e=>setShiftId(e.target.value)}><option value="" disabled>Selecione</option>{shifts.data?.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <button className="primary" disabled={!serviceId||!shift}>Confirmar atendimento</button>
    </form>}</PublicFrame>
}
function More(){const nav=useNavigate(),{survey,update}=useSurvey();return <PublicFrame><h1 className="title">Você recebeu outro atendimento?</h1><div className="card"><p className="lead">Atendimentos selecionados:</p><ul>{survey.attendances.map((a,i)=><li key={i}>{[a.name,a.serviceName,a.shiftName].filter(Boolean).join(' · ')} <button type="button" className="text-button" onClick={()=>update({attendances:survey.attendances.filter((_,x)=>x!==i)})}>Remover</button></li>)}</ul><div className="actions"><button className="secondary" onClick={()=>nav('/pesquisa/atendimento')}>Sim, recebi outro atendimento</button><button className="primary" disabled={!survey.attendances.length} onClick={()=>nav('/pesquisa/perguntas')}>Não, continuar avaliação</button></div></div></PublicFrame>}

function SurveyBootstrap({children}){
  const {survey,update}=useSurvey();
  const [error,setError]=useState('');
  const pending=useRef();
  useEffect(()=>{
    if(survey.id||!survey.attendances.length)return;
    let active=true;
    pending.current ??= (async()=>{
      const shifts=await surveyService.shifts();
      if(!shifts.length)throw new Error('Nenhum turno disponível.');
      const {id,surveyToken:token}=await surveyService.create();
      for(const attendance of survey.attendances){
        const serviceId=attendance.serviceId ?? (await surveyService.services(attendance.id))[0]?.id;
        if(!serviceId)throw new Error('Nenhum serviço disponível para este setor.');
        await surveyService.addAttendance(id,token,{sectorId:attendance.id,serviceId,shiftId:attendance.shiftId ?? shifts[0].id});
      }
      await surveyService.start(id,token);
      return {id,token};
    })();
    pending.current.then(data=>{if(active)update(data)}).catch(error=>{if(active)setError(error.message)});
    return()=>{active=false};
  },[survey.id,survey.attendances,update]);
  if(!survey.attendances.length)return <Navigate to="/pesquisa/atendimento" replace/>;
  if(error)return <PublicFrame><p className="error">{error}</p></PublicFrame>;
  return survey.id?children:<PublicFrame><p>Preparando sua pesquisa…</p></PublicFrame>
}
function Questions(){const nav=useNavigate(),{survey,update}=useSurvey();const {data=[],isLoading,error}=useQuery({queryKey:['questions',survey.id],queryFn:()=>surveyService.questions(survey.id,survey.token),enabled:!!survey.id});const questions=data;const [index,setIndex]=useState(0);const [saveError,setSaveError]=useState(''),[saving,setSaving]=useState(false);const q=questions[index];if(error)return <PublicFrame><p className="error">{error.message}</p></PublicFrame>;if(isLoading)return <PublicFrame><p>Carregando perguntas…</p></PublicFrame>;if(!q)return <Navigate to="/pesquisa/pontos-positivos" replace/>;const val=survey.answers[q.id];const next=async()=>{if(q.required&&(val===undefined||val===''||(Array.isArray(val)&&!val.length)))return;setSaving(true);try{if(val!==undefined)await surveyService.answer(survey.id,survey.token,q.id,val)}catch(error){setSaveError(error.message);return}finally{setSaving(false)}setSaveError('');if(index===questions.length-1)nav('/pesquisa/pontos-positivos');else setIndex(index+1)};return <PublicFrame><p className="step-label">Pergunta {index+1} de {questions.length}{q.stage&&' · '+q.stage}</p><h1 className="title">{q.text}</h1><QuestionRenderer key={q.id} question={q.type==='rating'?{...q,type:'rating_1_5'}:q} value={val} onChange={v=>update({answers:{...survey.answers,[q.id]:v}})}/>{q.required&&val===undefined&&<p className="error" aria-live="polite">Selecione uma resposta para continuar.</p>}{saveError&&<p className="error">{saveError}</p>}<div className="actions"><button className="secondary" disabled={!index} onClick={()=>setIndex(index-1)}>Voltar</button><button className="primary" disabled={saving} onClick={next}>{saving?'Salvando…':'Continuar'}</button></div></PublicFrame>}
function TextStep({kind,title,next,optional=false}){const nav=useNavigate(),{survey,update}=useSurvey();return <PublicFrame><h1 className="title">{title}</h1><p className="lead">{optional?'Esta resposta é opcional.':'Conte-nos com suas palavras.'}</p><textarea rows="6" maxLength="500" aria-label={title} value={survey[kind]||''} onChange={e=>update({[kind]:e.target.value})}/><div className="actions"><button className="secondary" onClick={()=>nav(-1)}>Voltar</button><button className="primary" onClick={()=>nav(next)}>Continuar</button></div></PublicFrame>}
function Return(){const nav=useNavigate(),{survey,update}=useSurvey();const [want,setWant]=useState(survey.returnRequest?.want||false);return <PublicFrame><h1 className="title">Deseja que entremos em contato?</h1><p className="lead">Se desejar retorno sobre sua experiência, deixe um meio de contato.</p><div className="grid"><label className="choice"><input type="radio" name="return" checked={want} onChange={()=>setWant(true)}/>Sim, desejo retorno</label><label className="choice"><input type="radio" name="return" checked={!want} onChange={()=>setWant(false)}/>Não, obrigado</label>{want&&<label className="field">Telefone ou e-mail<input maxLength={255} aria-label="Telefone ou e-mail" value={survey.returnRequest?.contact||''} onChange={e=>update({returnRequest:{want:true,contact:e.target.value}})}/></label>}</div><div className="actions"><button className="secondary" onClick={()=>nav(-1)}>Voltar</button><button className="primary" disabled={want&&!survey.returnRequest?.contact?.trim()} onClick={()=>{update({returnRequest:{...(survey.returnRequest||{}),want}});nav('/pesquisa/avaliacao-geral')}}>Continuar</button></div></PublicFrame>}
function Overall(){const nav=useNavigate(),{survey,clear}=useSurvey();const [score,setScore]=useState(survey.overall);const [error,setError]=useState(''),[sending,setSending]=useState(false);
  if(!survey.id)return <Navigate to="/pesquisa/atendimento" replace/>;
  const submit=async()=>{
    setError('');setSending(true);
    try{
      if(survey.positive||survey.negative||survey.comments)await surveyService.feedback(survey.id,survey.token,{positive:survey.positive,negative:survey.negative,suggestion:survey.comments});
      if(survey.returnRequest?.want)await surveyService.returnRequest(survey.id,survey.token,{contact:survey.returnRequest.contact});
      await surveyService.complete(survey.id,survey.token,score);
      clear();nav('/pesquisa/concluida');
    }catch(error){setError(error.message)}finally{setSending(false)}
  };return <PublicFrame><h1 className="title">De modo geral, qual nota você dá ao seu atendimento?</h1><QuestionRenderer question={{id:'overall',type:'rating_0_10'}} value={score} onChange={setScore}/>{error&&<p className="error">{error}</p>}<div className="actions"><button className="secondary" onClick={()=>nav(-1)}>Voltar</button><button className="primary" disabled={score===undefined||sending} onClick={submit}>Enviar avaliação</button></div></PublicFrame>}
function ThankYou(){return <PublicFrame><section className="card hero"><h1>Obrigado pela sua avaliação!</h1><p className="lead">Sua opinião ajuda a melhorar o cuidado oferecido pela Fundação Hospitalar Dr. Oswaldo Diesel.</p><Link className="primary" to="/">Finalizar</Link></section></PublicFrame>}
const schema=z.object({email:z.string().email('Informe um e-mail válido'),password:z.string().min(1,'Informe a senha')})
function Login(){const {login}=useAuth(),nav=useNavigate();const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm({resolver:zodResolver(schema)});const [error,setError]=useState('');const submit=async v=>{try{const user=await login(v);nav(user.role==='UserAdmin'?'/admin/dashboard':'/setor/perguntas')}catch(e){setError(e.message)}};return <PublicFrame><section className="card"><h1 className="title">Acesso de colaboradores</h1><form onSubmit={handleSubmit(submit)}><label className="field">E-mail<input type="email" autoComplete="email" {...register('email')}/>{errors.email&&<span className="error">{errors.email.message}</span>}</label><label className="field">Senha<input type="password" autoComplete="current-password" {...register('password')}/>{errors.password&&<span className="error">{errors.password.message}</span>}</label>{error&&<p className="error">{error}</p>}<button className="primary" type="submit" disabled={isSubmitting} style={{marginTop:20}}>{isSubmitting?'Entrando…':'Entrar'}</button></form></section></PublicFrame>}
function Unavailable(){return <AdminLayout><h1>Função indisponível</h1><p>Esta função ainda não foi integrada à API.</p><Link to="/admin/dashboard">Voltar para indicadores</Link></AdminLayout>}
const Page404=()=> <PublicFrame><h1 className="title">Página não encontrada</h1><Link to="/">Voltar ao início</Link></PublicFrame>
export function App(){return <Routes><Route path="/" element={<Welcome/>}/><Route path="/pesquisa" element={<Welcome/>}/><Route path="/pesquisa/atendimento" element={<Attendance/>}/><Route path="/pesquisa/outros-atendimentos" element={<More/>}/><Route path="/pesquisa/perguntas" element={<SurveyBootstrap><Questions/></SurveyBootstrap>}/><Route path="/pesquisa/pontos-positivos" element={<TextStep kind="positive" title="O que mais gostou no atendimento?" next="/pesquisa/pontos-negativos" optional/>}/><Route path="/pesquisa/pontos-negativos" element={<TextStep kind="negative" title="O que podemos melhorar?" next="/pesquisa/comentarios" optional/>}/><Route path="/pesquisa/comentarios" element={<TextStep kind="comments" title="Deseja deixar algum comentário?" next="/pesquisa/retorno" optional/>}/><Route path="/pesquisa/retorno" element={<Return/>}/><Route path="/pesquisa/avaliacao-geral" element={<Overall/>}/><Route path="/pesquisa/concluida" element={<ThankYou/>}/><Route path="/login" element={<Login/>}/><Route path="/tvwall" element={<TvWall/>}/><Route path="/403" element={<PublicFrame><h1>Acesso não autorizado</h1></PublicFrame>}/><Route path="/setor/perguntas" element={<ProtectedRoute roles={['UserSetor','UserAdmin']}><QuestionsAdmin sector/></ProtectedRoute>}/><Route path="/setor/perguntas/nova" element={<ProtectedRoute roles={['UserSetor','UserAdmin']}><NewQuestion sector/></ProtectedRoute>}/><Route path="/admin/cadastros" element={<ProtectedRoute roles={['UserAdmin']}><AdminCatalog/></ProtectedRoute>}/><Route path="/admin/configuracoes" element={<Navigate to="/admin/cadastros" replace/>}/><Route path="/admin/perguntas/:id/editar" element={<ProtectedRoute roles={['UserAdmin']}><NewQuestion/></ProtectedRoute>}/><Route path="/setor/perguntas/:id/editar" element={<ProtectedRoute roles={['UserSetor']}><NewQuestion sector/></ProtectedRoute>}/><Route path="/admin/dashboard" element={<ProtectedRoute roles={['UserAdmin']}><Dashboard/></ProtectedRoute>}/><Route path="/admin/perguntas" element={<ProtectedRoute roles={['UserAdmin']}><QuestionsAdmin/></ProtectedRoute>}/><Route path="/admin/perguntas/nova" element={<ProtectedRoute roles={['UserAdmin']}><NewQuestion/></ProtectedRoute>}/><Route path="/admin/avaliacoes" element={<ProtectedRoute roles={['UserAdmin']}><EvaluationsPanel key="evaluations"/></ProtectedRoute>}/><Route path="/admin/feedback" element={<ProtectedRoute roles={['UserAdmin']}><FeedbackPanel/></ProtectedRoute>}/><Route path="/setor/feedback" element={<ProtectedRoute roles={['UserSetor']}><FeedbackPanel/></ProtectedRoute>}/><Route path="/admin/retornos" element={<ProtectedRoute roles={['UserAdmin']}><ReturnsPanel/></ProtectedRoute>}/><Route path="/admin/relatorios" element={<ProtectedRoute roles={['UserAdmin']}><EvaluationsPanel key="reports" report/></ProtectedRoute>}/><Route path="/admin/convites" element={<ProtectedRoute roles={['UserAdmin']}><Unavailable/></ProtectedRoute>}/><Route path="*" element={<Page404/>}/></Routes>}
