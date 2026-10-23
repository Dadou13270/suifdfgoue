import { useEffect, useRef, useState, useCallback } from 'react'
import { subscribe, writeDoc } from './store.js'
import { cellKey } from './util.js'
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
  // Retour vers les plannings : un nom modifié à la main dans le dispositif met à jour la case du planning (compteurs justes)
  const syncBack = useCallback((date, data) => {
    if (!data || (!data.cells && !data.heads)) return
    const rules = (config?.autofill?.rules || []).filter((r) => (r.kind === 'planning' || r.kind === 'sector') && r.target && r.planning)
    if (!rules.length) return
    const grades = new Set((config?.lists?.grades || []).map((g) => g.toUpperCase()))
    const list = cadres?.list || []
    const dom = Number(date.slice(8))
    const parse = (text, r) => {
      let t = String(text || '').trim()
      if (r.engineTarget && r.engineTarget === r.target) t = t.replace(/\s-\s.+$/, '')
      t = t.replace(/^\S{1,3}\s*:\s*/, '').replace(/\s*\([A-Za-z]{2,5}\)\s*$/, '').trim()
      const words = t.split(/\s+/)
      if (words.length > 1 && grades.has(words[0].toUpperCase())) t = words.slice(1).join(' ')
      const c = list.find((x) => x.nom && x.nom.toLowerCase() === t.toLowerCase())
      return c ? c.nom : t
    }
    rules.forEach((r) => {
      const [kind, b, row] = r.target.split(':')
      let text
      if (kind === 'head') { if (data.heads && data.heads[b] !== undefined) text = data.heads[b] }
      else { const c = data.cells?.[cellKey(b, row)]; if (c && typeof c === 'object' && 'text' in c) text = c.text }
      if (text === undefined) return
      let col = r.col
      if (r.kind === 'sector') {
        const line = (cal?.lines || []).find((l) => l.group === 'Secteur des GIFF' && l.label === r.calLine)
        col = String(line?.vals?.[dom - 1] || '').trim()
      }
      if (!col) return
      const name = parse(text, r)
      const cur = String(plans[r.planning]?.days?.[date]?.[col] || '').trim()
      if (cur.toLowerCase() === name.toLowerCase()) return
      writeDoc(`planning/${r.planning}`, { days: { [date]: { [col]: name } } }, true)
    })
  }, [config, plans, cal, cadres])
  return { run, loaded, syncBack }
}
