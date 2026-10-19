import React, { useEffect, useMemo, useState } from 'react'
import { useDoc } from './store.js'
import { TextField } from './Cell.jsx'
import { addDays, iso } from './util.js'

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const DOW = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']

export default function Plannings({ config, date, role }) {
  const pls = config.plannings
  const [pid, setPid] = useState(pls[0]?.id)
  const pl = pls.find((p) => p.id === pid) || pls[0]
  const [ym, setYm] = useState(date.slice(0, 7))
  const [doc, patch, replace] = useDoc(`planning/${pl?.id}`)
  const [razAsk, setRazAsk] = useState(false)
  useEffect(() => setRazAsk(false), [pid, ym])
  const canRaz = role === 'superadmin' || role === 'admin'
  const raz = () => {
    const keep = Object.fromEntries(Object.entries(doc?.days || {}).filter(([d]) => !d.startsWith(ym)))
    replace({ ...(doc || {}), days: keep })
    setRazAsk(false)
  }
  const [cadres] = useDoc('cadres/main')
  const [pers] = useDoc('personnel/main')
  const days = doc?.days || {}
  const [y, m] = ym.split('-').map(Number)
  const first = `${ym}-01`
  const n = new Date(y, m, 0).getDate()
  const dates = Array.from({ length: n }, (_, i) => addDays(first, i))
  const today = iso(new Date())

  const names = useMemo(() => {
    const s = new Set((cadres?.list || []).map((c) => c.nom))
    Object.values(days).forEach((r) => Object.values(r).forEach((v) => v && s.add(v)))
    return [...s].sort()
  }, [cadres, days])

  const namesFor = (c) => {
    const P = (pers?.list || []).filter((p) => p.nom)
    const pick = (f) => [...new Set(P.filter(f).map((p) => p.nom))].sort()
    const tries = [() => pick((p) => (!c.cadre || p.cadreEmploi === c.cadre) && (!c.fdf || p.fdf === c.fdf)), () => (c.cadre ? pick((p) => p.cadreEmploi === c.cadre) : []), () => (c.fdf ? pick((p) => p.fdf === c.fdf) : [])]
    if (c.mil) { const l = [...new Set((cadres?.list || []).filter((x) => x.mil && x.nom).map((x) => x.nom))].sort(); if (l.length) return l }
    if (!c.mil && !c.fdf && c.cadre === 'Chef de groupe') { const f3 = new Set(P.filter((p) => p.fdf === 'FDF3').map((p) => String(p.nom).trim().toUpperCase())); const l = [...new Set((cadres?.list || []).map((x) => x.nom).filter((n) => n && f3.has(String(n).trim().toUpperCase())))].sort(); if (l.length) return l }
    if (!c.cadre && !c.fdf && !c.mil) return names
    for (const t of tries) { const l = t(); if (l.length) return l }
    return names
  }
  const totals = useMemo(() => {
    const t = {}
    Object.values(days).forEach((r) => pl.cols.forEach((c) => { const v = (r[c.id] || '').trim(); if (v) t[v] = (t[v] || 0) + 1 }))
    return Object.entries(t).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [days, pl])

  const [jumped, setJumped] = useState('')
  useEffect(() => {
    // ouvre le dernier mois renseigné quand le mois courant est vide
    const ks = Object.keys(days).filter((k) => Object.values(days[k] || {}).some(Boolean)).sort()
    if (doc && jumped !== pl?.id && ks.length) {
      setJumped(pl.id)
      if (!ks.some((k) => k.startsWith(ym))) setYm(ks[ks.length - 1].slice(0, 7))
    }
  }, [doc, pl?.id]) // eslint-disable-line
  const [hl, setHl] = useState('')
  if (!pl) return <p className="muted">Aucun planning configuré (Paramètres › Plannings).</p>
  const shift = (d) => { const x = new Date(y, m - 1 + d, 1); setYm(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`) }
  const dup = (r) => { const v = pl.cols.map((c) => (r?.[c.id] || '').trim()).filter(Boolean); return new Set(v).size !== v.length }

  return (
    <div className="plan">
      <div className="subbar">
        <div className="seg wrapseg">{pls.map((p) => <button key={p.id} className={p.id === pl.id ? 'on' : ''} onClick={() => setPid(p.id)}>{p.title}</button>)}</div>
        <div className="datebar">
          <button onClick={() => shift(-1)} aria-label="Mois précédent">‹</button>
          <b className="monthname">{MONTHS[m - 1]} {y}</b>
          <button onClick={() => shift(1)} aria-label="Mois suivant">›</button>
          {canRaz && (razAsk
            ? <><span className="small">Effacer {pl.title} {MONTHS[m - 1]} {y} ?</span><button className="danger" onClick={raz}>Confirmer</button><button onClick={() => setRazAsk(false)}>Annuler</button></>
            : <button className="danger" onClick={() => setRazAsk(true)} title="Efface les données du planning affiché pour ce mois">RAZ</button>)}
        </div>
      </div>
      <datalist id="names-list">{names.map((x) => <option key={x} value={x} />)}</datalist>
      {pl.cols.filter((c) => c.cadre || c.fdf || c.mil).map((c) => <datalist key={c.id} id={`names-${pl.id}-${c.id}`}>{namesFor(c).map((x) => <option key={x} value={x} />)}</datalist>)}
      <div className="planlayout">
        <div className="tablewrap">
          <table className="week plantable">
            <thead><tr><th className="sticky">Date</th>{pl.cols.map((c) => <th key={c.id}>{c.label}{(c.cadre || c.fdf || c.mil) && <div className="muted small">{[c.mil && 'MIL', c.fdf, c.cadre].filter(Boolean).join(' · ')}</div>}</th>)}</tr></thead>
            <tbody>
              {dates.map((d) => {
                const dw = new Date(d + 'T12:00:00').getDay()
                return (
                  <tr key={d} className={`${dw === 0 || dw === 6 ? 'we' : ''} ${d === today ? 'today' : ''} ${dup(days[d]) ? 'dup' : ''}`}>
                    <th className="sticky"><span className="muted">{DOW[dw]}</span> {d.slice(8)}</th>
                    {pl.cols.map((c) => {
                      const v = days[d]?.[c.id] || ''
                      return (
                        <td key={c.id} className={hl && v.trim() === hl ? 'hl' : ''}>
                          <TextField value={v} list={pl.names ? (c.cadre || c.fdf || c.mil ? `names-${pl.id}-${c.id}` : 'names-list') : undefined}
                            onCommit={(t) => patch({ days: { [d]: { [c.id]: t.trim() } } })} />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <aside className="card totals">
          <h3>Total par personne</h3>
          <p className="muted small">Sur toute la période du planning. Toucher un nom le surligne.</p>
          <ul>
            {totals.map(([nm, k]) => (
              <li key={nm}><button className={`link ${hl === nm ? 'on' : ''}`} onClick={() => setHl(hl === nm ? '' : nm)}>{nm}</button><b>{k}</b></li>
            ))}
            {!totals.length && <li className="muted">Aucune affectation.</li>}
          </ul>
        </aside>
      </div>
      <p className="muted small">Ligne marquée en rouge : une même personne apparaît deux fois le même jour.</p>
    </div>
  )
}
