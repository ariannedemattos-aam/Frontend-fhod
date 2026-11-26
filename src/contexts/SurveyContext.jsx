import { createContext, useContext, useState } from 'react'

const SurveyContext = createContext(null)
const key = 'fhdod_survey'
const blank = () => ({ attendances: [], answers: {} })
export const useSurvey = () => useContext(SurveyContext)

export function SurveyProvider({ children }) {
  const [survey, setSurvey] = useState(() => JSON.parse(sessionStorage.getItem(key) || 'null') || blank())
  function persist(next) {
    setSurvey(next)
    sessionStorage.setItem(key, JSON.stringify(next))
  }
  const update = values => persist({ ...survey, ...values })
  function beginInvitation({ id, surveyToken, status }) {
    persist({ ...(survey.id === id ? survey : blank()), id, token: surveyToken, started: status === 'in_progress' })
  }
  const beginSector = attendance => persist({ ...blank(), attendances: [attendance] })
  function clear() {
    sessionStorage.removeItem(key)
    setSurvey(blank())
  }
  return <SurveyContext.Provider value={{ survey, update, beginInvitation, beginSector, clear }}>{children}</SurveyContext.Provider>
}
