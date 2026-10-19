import React, { useState } from 'react'
import { readDoc, removeDoc, writeDoc } from './store.js'
import { addDays } from './util.js'
import { isSuper } from './roles.js'

const PLS = ['chefsgiff', 'gcdt', 'vpc']
const yearDates = (y) => { const out = []; let d = `${y}-01-01`; while (d.startsWith(String(y))) { out.push(d); d = addDays(d, 1) } return out }
const inYear = (d, y) => typeof d === 'string' && d.startsWith(`${y}-`)
const empty = (v) => !v || (typeof v === 'object' && !Object.keys(v).length)

async function collect(y) {
  const days = {}
  const dates = yearDates(y)
  for (let i = 0; i < dates.length; i += 40) {
    const part = await Promise.all(dates.slice(i, i + 40).map((d) => readDoc(`days/${d}`)))
    part.forEach((v, k) => { if (!empty(v)) days[dates[i + k]] = v })
  }
  const plannings = {}
  for (const id of PLS) {
    const p = await readDoc(`planning/${id}`)
    const ds = Object.fromEntries(Object.entries(p?.days || {}).filter(([d]) => inYear(d, y)))
    if (Object.keys(ds).length) plannings[id] = ds
  }
  const r = await readDoc('releves/main')
  const releves = (r?.log || []).filter((l) => inYear(l.date, y))
  return { days, plannings, releves }
}

export default function YearDb({ role }) {
  const now = new Date().getFullYear()
  const [year, setYear] = useState(now)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState('replace')
  const sup = isSuper(role)

  const run = async (label, fn) => {
    setBusy(true); setMsg(`${label}…`)
    try { setMsg(await fn()) } catch (e) { setMsg(`Échec : ${e?.message || e}`) }
    setBusy(false)
  }
  const resume = (d) => `${Object.keys(d.days).length} jour(s) de dispositif, ${Object.keys(d.plannings).length} planning(s), ${d.releves.length} relève(s)`

  const exp = () => run('Export en cours', async () => {
    const d = await collect(year)
    const out = { type: 'fdf-annee', version: 1, year, exportedAt: new Date().toISOString(), ...d }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' }))
    a.download = `base_${year}.json`; a.click()
    return `Export ${year} : ${resume(d)}.`
  })

  const clear = () => run('Suppression en cours', async () => {
    const d = await collect(year)
    if (!window.confirm(`Vider la base ${year} ?\n${resume(d)}\nAction définitive. Pensez à exporter avant.`)) return 'Annulé.'
    if (window.prompt(`Tapez ${year} pour confirmer la suppression`) !== String(year)) return 'Annulé : année non confirmée.'
    for (const dt of Object.keys(d.days)) await removeDoc(`days/${dt}`)
    for (const id of PLS) {
      const p = await readDoc(`planning/${id}`)
      if (p?.days) await writeDoc(`planning/${id}`, { ...p, days: Object.fromEntries(Object.entries(p.days).filter(([x]) => !inYear(x, year))) }, false)
    }
    const r = await readDoc('releves/main')
    if (r?.log) await writeDoc('releves/main', { ...r, log: r.log.filter((l) => !inYear(l.date, year)) }, false)
    return `Base ${year} vidée : ${resume(d)} supprimé(s).`
  })

  const imp = (e) => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    run('Import en cours', async () => {
      let d
      try { d = JSON.parse(await f.text()) } catch { return 'Fichier invalide.' }
      if (d?.type !== 'fdf-annee') return "Ce fichier n'est pas une base annuelle."
      if (d.year !== year) return `Le fichier est de ${d.year} : sélectionnez ${d.year} pour l'importer.`
      const txt = mode === 'replace' ? 'REMPLACE les données existantes de' : 'FUSIONNE avec les données existantes de'
      if (!window.confirm(`Importer ${resume(d)} ? Cela ${txt} ${year}.`)) return 'Annulé.'
      if (mode === 'replace') {
        const cur = await collect(year)
        for (const dt of Object.keys(cur.days)) await removeDoc(`days/${dt}`)
      }
      for (const [dt, v] of Object.entries(d.days || {})) if (inYear(dt, year)) await writeDoc(`days/${dt}`, v, mode === 'merge')
      for (const [id, ds] of Object.entries(d.plannings || {})) {
        const p = (await readDoc(`planning/${id}`)) || {}
        const keep = mode === 'replace' ? Object.fromEntries(Object.entries(p.days || {}).filter(([x]) => !inYear(x, year))) : { ...(p.days || {}) }
        const add = Object.fromEntries(Object.entries(ds).filter(([x]) => inYear(x, year)))
        await writeDoc(`planning/${id}`, { ...p, days: mode === 'merge' ? { ...keep, ...Object.fromEntries(Object.entries(add).map(([x, v]) => [x, { ...(keep[x] || {}), ...v }])) } : { ...keep, ...add } }, false)
      }
      const r = (await readDoc('releves/main')) || {}
      const base = mode === 'replace' ? (r.log || []).filter((l) => !inYear(l.date, year)) : (r.log || [])
      const ids = new Set(base.map((l) => l.id))
      const log = [...base, ...(d.releves || []).filter((l) => !ids.has(l.id))].sort((a, b) => (b.at || 0) - (a.at || 0))
      await writeDoc('releves/main', { ...r, log }, false)
      return `Base ${year} importée : ${resume(d)}.`
    })
  }

  return (
    <div className="stack ydb">
      <h3>Base de données de l'année</h3>
      <p className="muted small">Concerne : dispositif (jours), plannings et historique des relèves de l'année choisie. Parc, personnel, cadres, calendrier et configuration ne sont pas touchés.</p>
      <label className="ydb-year">Année
        <select value={year} onChange={(e) => { setYear(+e.target.value); setMsg('') }}>
          {[now + 1, now, now - 1, now - 2].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <button onClick={exp} disabled={busy}>⭳ Exporter la base {year}</button>
      <div className="ydb-imp">
        <select value={mode} onChange={(e) => setMode(e.target.value)} disabled={!sup}>
          <option value="replace">Remplacer l'existant</option>
          <option value="merge">Fusionner avec l'existant</option>
        </select>
        <label className={'filebtn' + (!sup || busy ? ' off' : '')}>⭱ Importer une base<input type="file" accept="application/json" onChange={imp} disabled={!sup || busy} hidden /></label>
      </div>
      <button className="danger" onClick={clear} disabled={!sup || busy}>Vider la base {year}</button>
      {!sup && <p className="muted small">Import et suppression : réservés au super administrateur.</p>}
      {msg && <div className="banner">{msg}</div>}
    </div>
  )
}
