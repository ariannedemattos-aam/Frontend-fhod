import { expect, test } from 'vitest'
import { can, startPage } from '../src/services/profileAccess.js'

test('o destino inicial e os menus dependem das permissões devolvidas pela API', () => {
  expect(startPage({ permissions:['dashboard.read'] })).toBe('/admin/dashboard')
  expect(startPage({ permissions:['ombudsman.manage'] })).toBe('/admin/ouvidoria')
  expect(startPage({ permissions:['questions.read'] })).toBe('/setor/perguntas')
  expect(startPage({ role:'UserAdmin', permissions:[] })).toBe('/403')
  expect(can({ permissions:['dashboard.read'] },'return_requests.manage','users.manage')).toBe(false)
})
