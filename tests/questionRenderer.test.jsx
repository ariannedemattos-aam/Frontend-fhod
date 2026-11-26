// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { QuestionRenderer } from '../src/components/QuestionRenderer.jsx'

afterEach(cleanup)

test('a nota zero é uma seleção válida com um nome acessível', () => {
  const change=vi.fn()
  render(<QuestionRenderer question={{id:'geral',type:'rating_0_10'}} onChange={change}/>)
  expect(screen.getByRole('group',{name:'Nota geral de 0 a 10'})).toBeTruthy()
  fireEvent.click(screen.getByRole('radio',{name:'0'}))
  expect(change).toHaveBeenCalledWith(0)
})

test('perguntas de múltipla escolha expõem caixas rotuladas e acrescentam a opção', () => {
  const change=vi.fn()
  render(<QuestionRenderer question={{id:'etapa',type:'multiple_choice',options:[{value:'a',label:'Recepção'},{value:'b',label:'Triagem'}]}}
    value={['a']} onChange={change}/>)
  expect(screen.getByRole('checkbox',{name:'Recepção'}).checked).toBe(true)
  fireEvent.click(screen.getByRole('checkbox',{name:'Triagem'}))
  expect(change).toHaveBeenCalledWith(['a','b'])
})
