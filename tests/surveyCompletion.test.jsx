// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../src/App.jsx'
import { SurveyProvider } from '../src/contexts/SurveyContext.jsx'
import { surveyService } from '../src/services/surveyService.js'

vi.mock('../src/services/surveyService.js',()=>({surveyService:{complete:vi.fn().mockResolvedValue(null)}}))

afterEach(()=>{cleanup();sessionStorage.clear()})

test('a confirmação é exibida após limpar a pesquisa concluída',async()=>{
  sessionStorage.setItem('fhdod_survey',JSON.stringify({id:'pesquisa-ficticia',token:'token-simulado',attendances:[],answers:{}}))
  render(<MemoryRouter initialEntries={['/pesquisa/avaliacao-geral']}><SurveyProvider><App/></SurveyProvider></MemoryRouter>)
  fireEvent.click(screen.getByRole('radio',{name:'4',exact:true}))
  fireEvent.click(screen.getByRole('button',{name:'Enviar avaliação'}))
  expect(await screen.findByRole('heading',{name:'Obrigado pela sua avaliação!'})).toBeTruthy()
  expect(surveyService.complete).toHaveBeenCalledWith('pesquisa-ficticia','token-simulado',4)
  expect(sessionStorage.getItem('fhdod_survey')).toBeNull()
})
