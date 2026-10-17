import { useEffect, useRef, useState, useCallback } from 'react'
import { subscribe } from './store.js'
import { computeFills, buildPatch } from './autofill.js'

// Charge plannings + calendrier + cadres, complète automatiquement les jours affichés.
export default function useAutoFill({ config, dates, days, patch, ready, cadres, fleet }) {
  const [plans, setPlans] = useState({})
  const [cal, setCal] = useState(undefined)
  const [pers, setPers] = useState(null)
  const ids = [...new Set((config?.autofill?.rules || []).map((r) => r.planning))].join(',')
  useEffect(() => {
    if (!ready) return
    const offs = ids.split(',').filter(Boolean).map((id) => subscribe(`planning/${id}`, (v) => setPlans((p) => ({ ...p, [id]: v || {} }))))
    offs.push(subscribe('personnel/main', (v) => setPers(v || {})))
    offs.push(subscribe('calendar/main', (v) => setCal(v || {})))
    return () => offs.forEach((f) => f())
  }, [ready, ids])

  const loaded = cal !== undefined && cadres !== undefined && fleet !== undefined && ids.split(',').filter(Boolean).every((i) => plans[i])
  const done = useRef(new Set())
  const fillsFor = useCallback((d) => computeFills({ config, date: d, plans, cal, cadres, fleet: fleet?.engins, pers }), [config, plans, cal, cadres, fleet, pers])

  useEffect(() => {
    if (!ready || !loaded || !config.autofill?.enabled) return
    dates.forEach((d) => {
      const day = days[d]
      if (!day || day.autoDone || done.current.has(d)) return
      const { patch: p, n } = buildPatch(day, fillsFor(d), false)
      if (n > 0) { done.current.add(d); patch(d, p) }
    })
  }, [ready, loaded, dates.join(','), days, config.autofill?.enabled, fillsFor]) // eslint-disable-line

  const run = useCallback((ds, overwrite) => {
    let total = 0
    ds.forEach((d) => { const { patch: p, n } = buildPatch(days[d] || {}, fillsFor(d), overwrite); if (n > 0) { patch(d, p); total += n } })
    return total
  }, [days, fillsFor, patch])
  return { run, loaded }
}
