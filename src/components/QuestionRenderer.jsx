import { useState } from 'react'

const labels = ['Muito insatisfeito','Insatisfeito','Neutro','Satisfeito','Muito satisfeito']
const faces = ['☹','☹','😐','☺','☺']

function Rating({ title, name, options, value, onChange }) {
  return <fieldset className="rating-field">
    <legend className="sr-only">{title}</legend>
    <div className={'rating '+(options.length===11?'rating-general':'')}>
      {options.map(({label,score,face})=><label className="rate" data-selected={value===score} key={score}>
        <input type="radio" name={name} value={score} checked={value===score} onChange={()=>onChange(score)}/>
        {face&&<b aria-hidden="true">{face}</b>}<span>{label}</span>
      </label>)}
    </div>
  </fieldset>
}

export function SatisfactionRating({value,onChange}) {
  const options=labels.map((label,index)=>({label,score:index+1,face:faces[index]}))
  return <Rating title="Avaliação de 1 a 5" name="satisfaction" value={value} onChange={onChange} options={options}/>
}

export function QuestionRenderer({question,value,onChange}) {
  const [other,setOther]=useState(value||'')
  if(question.type==='rating_1_5') return <SatisfactionRating value={value} onChange={onChange}/>
  if(question.type==='rating_0_10') return <Rating title="Nota geral de 0 a 10" name="overall" value={value} onChange={onChange}
    options={Array.from({length:11},(_,score)=>({score,label:String(score)}))}/>
  if(['single_choice','boolean','multiple_choice'].includes(question.type)){
    const multiple=question.type==='multiple_choice'
    return <fieldset className="rating-field">
      <legend className="sr-only">{multiple?'Marque as opções que se aplicam':'Escolha uma opção'}</legend>
      <div className="grid">{(question.options??[]).map(o=><label className="choice" key={o.value}>
        <input type={multiple?'checkbox':'radio'} name={question.id}
          checked={multiple?(value||[]).includes(o.value):value===o.value}
          onChange={e=>onChange(multiple?(e.target.checked?[...(value||[]),o.value]:(value||[]).filter(x=>x!==o.value)):o.value)}/>
        {o.label}
      </label>)}</div>
    </fieldset>
  }
  return <textarea className="question-text" aria-label={question.text} maxLength={question.maxLength||1000} rows={question.type==='long_text'?6:2}
    value={other} onChange={e=>{setOther(e.target.value);onChange(e.target.value)}}/>
}
