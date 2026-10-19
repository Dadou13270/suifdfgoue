import React, { useMemo, useState } from 'react'
import { useDays, useDoc } from './store.js'
import { addDays, iso, cellKey, effBlock, blockName, fmtShort } from './util.js'

const MAX_DAYS = 400
const typeOf = (b) => String(b.title || '').replace(/\s*\d+(\.\d+)?$/, '').trim() || 'Autre'
const fmtDT = (t) => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const norm = (s) => String(s || '').toUpperCase()

export default function Stats({ config }) {
  const today = iso(new Date())
  const [from, setFrom] = useState(() => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1, 12)) })
  const [to, setTo] = useState(() => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)) })
  const [q, setQ] = useState('')
  const [fg, setFg] = useState('')
  const [fp, setFp] = useState('')
  const [cad] = useDoc('cadres/main')
  const cadres = useMemo(() => (cad?.list || []).filter((c) => c.nom).sort((a, b) => b.nom.length - a.nom.length), [cad])

  const dates = useMemo(() => {
    const out = []
    if (!from || !to || from > to) return out
    for (let d = from; d <= to && out.length < MAX_DAYS; d = addDays(d, 1)) out.push(d)
    return out
  }, [from, to])
  const [days] = useDays(dates, true)
  const capped = from && to && from <= to && addDays(from, MAX_DAYS) < to

  const [mode, setMode] = useState('month')
  const ymd = (y, m, d) => iso(new Date(y, m, d, 12))
  const range = (k, ref) => {
    const r = new Date(ref + 'T12:00:00'); const y = r.getFullYear(); const m = r.getMonth()
    if (k === 'week') { const mo = new Date(r); mo.setDate(r.getDate() - ((r.getDay() + 6) % 7)); const su = new Date(mo); su.setDate(mo.getDate() + 6); return [iso(mo), iso(su)] }
    if (k === 'month') return [ymd(y, m, 1), ymd(y, m + 1, 0)]
    if (k === 'season') return [ymd(y, 5, 1), ymd(y, 8, 30)]
    return [ymd(y, 0, 1), ymd(y, 11, 31)]
  }
  const preset = (k) => { const [f, t] = range(k, today); setMode(k); setFrom(f); setTo(t) }
  const shift = (dir) => {
    if (mode === 'custom') { const n = Math.max(1, Math.round((new Date(to) - new Date(from)) / 864e5) + 1); setFrom(addDays(from, dir * n)); setTo(addDays(to, dir * n)); return }
    const r = new Date(from + 'T12:00:00')
    const ref = mode === 'week' ? addDays(from, 7 * dir) : mode === 'month' ? ymd(r.getFullYear(), r.getMonth() + dir, 15) : ymd(r.getFullYear() + dir, 5, 15)
    const [f, t] = range(mode, ref); setFrom(f); setTo(t)
  }

  const { byType, chain, agents, cols } = useMemo(() => {
    const byType = new Map(); const chain = []; const ag = new Map(); const colset = new Set()
    const reCache = new Map()
    const find = (text) => {
      const up = norm(text)
      return cadres.find((x) => { let re = reCache.get(x.nom); if (!re) { re = new RegExp(`(^|[^A-Z0-9])${norm(x.nom).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Z0-9])`); reCache.set(x.nom, re) } return re.test(up) })
    }
    const addAg = (c, col, d, group, eng) => {
      const key = c ? c.nom : null; if (!key) return
      const a = ag.get(key) || { nom: c.nom, grade: c.grade || '', aff: c.aff || '', total: 0, days: new Set(), by: {}, eng: 0, list: [] }
      a.total++; a.days.add(d); a.by[col] = (a.by[col] || 0) + 1; if (eng) a.eng++
      a.list.push({ date: d, group, col, engaged: eng })
      colset.add(col); ag.set(key, a)
    }
    dates.forEach((d) => {
      const day = days[d]; if (!day) return
      const blocks = [...config.blocks.map((b) => effBlock(b, day)), ...(day.customBlocks || [])]
      blocks.forEach((b) => {
        const name = blockName(b, day)
        const t = typeOf(b)
        const eng = !!day.engaged?.[b.id]?.at
        const ala = !!day.aladin?.[b.id]?.at
        const head = String(day.heads?.[b.id] || '').trim()
        const realHead = head && !/non planifi/i.test(head)
        const cellTexts = b.rows.map((r) => String(day.cells?.[cellKey(b.id, r.id)]?.text || '').trim())
        const done = realHead || cellTexts.some(Boolean)
        if (done) {
          const row = byType.get(t) || { type: t, n: 0, eng: 0, al: 0, groups: new Map(), gal: new Map(), days: new Set() }
          row.n++; if (eng) row.eng++; if (ala) { row.al++; row.gal.set(name, (row.gal.get(name) || 0) + 1) } row.days.add(d); row.groups.set(name, (row.groups.get(name) || 0) + 1)
          byType.set(t, row)
        }
        if (realHead && b.section !== 'cdt') { const c = find(head); if (c) addAg(c, `Chef ${t}`, d, name, eng) }
        if (b.section === 'cdt') {
          b.rows.forEach((r, i) => {
            const text = cellTexts[i]; if (!text) return
            const c = find(text)
            const e = /\s-\s(.+)$/.exec(text)?.[1] || ''
            const aff = c?.aff || /\(([A-Z]{2,5})\)/.exec(norm(text))?.[1] || ''
            chain.push({ date: d, group: name, pos: r.label || '', grade: c?.grade || '', nom: c?.nom || text.replace(/\s-\s.+$/, '').replace(/\s*\([A-Z]{2,5}\)/, ''), aff, eng: e, engaged: eng, aladin: ala })
            if (c) addAg(c, `${t} · ${r.label || ''}`.trim(), d, name, eng)
          })
        }
      })
    })
    return { byType: [...byType.values()].sort((a, b) => b.n - a.n), chain, agents: [...ag.values()].sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom)), cols: [...colset].sort() }
  }, [days, dates, config, cadres])
  const [sub, setSub] = useState('groupes')
  const [sel, setSel] = useState('')
  const [qa, setQa] = useState('')

  const total = byType.reduce((n, t) => n + t.n, 0)
  const groups = [...new Set(chain.map((r) => r.group))].sort()
  const poss = [...new Set(chain.map((r) => r.pos))].sort()
  const shown = chain.filter((r) => (!fg || r.group === fg) && (!fp || r.pos === fp) && (!q || `${r.grade} ${r.nom}`.toLowerCase().includes(q.toLowerCase())))
  const loaded = dates.every((d) => days[d] !== undefined)

  return (
    <div className="statpage">
      <div className="subbar">
        <b>Statistiques <span className="muted">{dates.length} jour(s){loaded ? '' : ' · chargement…'}</span></b>
        <div className="stperiod">
          <div className="seg">{[['week', 'Semaine'], ['month', 'Mois'], ['season', 'Saison'], ['year', 'Année']].map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => preset(k)}>{l}</button>)}</div>
          <div className="stdates">
            <button aria-label="Période précédente" onClick={() => shift(-1)}>‹</button>
            <input type="date" aria-label="Du" value={from} onChange={(e) => { setMode('custom'); setFrom(e.target.value) }} />
            <span className="muted">→</span>
            <input type="date" aria-label="Au" value={to} onChange={(e) => { setMode('custom'); setTo(e.target.value) }} />
            <button aria-label="Période suivante" onClick={() => shift(1)}>›</button>
          </div>
        </div>
      </div>
      {capped && <p className="muted small">Période limitée à {MAX_DAYS} jours.</p>}

      <nav className="tabs stsub">{[['groupes', 'Groupes effectués'], ['chaine', 'Chaîne de commandement'], ['agents', 'Par agent']].map(([k, l]) => <button key={k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>)}</nav>

      {sub === 'groupes' && <>
      <h3 className="cathead">Groupes effectués par type <span className="muted">{total}</span></h3>
      {!byType.length ? <p className="muted">Aucun groupe constitué sur la période.</p> : (
        <div className="grid stcards">
          {byType.map((t) => (
            <div className="card stcard" key={t.type}>
              <div className="stn">{t.n}</div>
              <b>{t.type}</b>
              <div className="muted small">{t.days.size} jour(s){t.eng ? ` · dont ${t.eng} engagé(s)` : ''}{t.al ? ` · 🚨 ${t.al} Aladin` : ''}</div>
              <div className="small">{[...t.groups].sort((a, b) => b[1] - a[1]).map(([g, n]) => <div key={g}>{g} <b>× {n}</b>{t.gal.get(g) ? <span className="aladn"> · 🚨 Aladin × {t.gal.get(g)}</span> : null}</div>)}</div>
            </div>
          ))}
        </div>
      )}
      <p className="muted small">Un groupe est « effectué » un jour donné dès que son chef ou au moins un de ses moyens est renseigné.</p>
      </>}
      {sub === 'chaine' && <>
      <h3 className="cathead">Chaîne de commandement <span className="muted">{shown.length}/{chain.length}</span></h3>
      <div className="actions stfilters">
        <input placeholder="Rechercher un nom…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={fg} onChange={(e) => setFg(e.target.value)}><option value="">Tous les groupes</option>{groups.map((g) => <option key={g}>{g}</option>)}</select>
        <select value={fp} onChange={(e) => setFp(e.target.value)}><option value="">Toutes les positions</option>{poss.map((g) => <option key={g}>{g}</option>)}</select>
      </div>
      {!shown.length ? <p className="muted">Aucune chaîne de commandement renseignée sur la période.</p> : (
        <div className="tablewrap"><table className="week">
          <thead><tr><th>Date</th><th>Groupe</th><th>Position</th><th>Grade</th><th>Nom</th><th>Aff.</th><th>Engin</th><th>Engagé</th></tr></thead>
          <tbody>{shown.map((r, i) => <tr key={i}><td>{fmtShort(r.date)}</td><td>{r.group}</td><td>{r.pos}</td><td>{r.grade}</td><td><b>{r.nom}</b></td><td>{r.aff}</td><td>{r.eng}</td><td>{r.engaged ? '🔥' : ''}{r.aladin ? '🚨' : ''}</td></tr>)}</tbody></table></div>
      )}
      </>}

      {sub === 'agents' && <>
      <h3 className="cathead">Statistiques par agent <span className="muted">{agents.length}</span></h3>
      <div className="actions stfilters"><input placeholder="Rechercher un agent…" value={qa} onChange={(e) => setQa(e.target.value)} /></div>
      {!agents.length ? <p className="muted">Aucun agent identifié sur la période (les noms doivent exister dans Cadres).</p> : (
        <div className="tablewrap"><table className="week">
          <thead><tr><th>Agent</th><th>Grade</th><th>Total</th><th>Jours</th>{cols.map((c) => <th key={c}>{c}</th>)}<th>Engagé</th></tr></thead>
          <tbody>{agents.filter((a) => !qa || `${a.grade} ${a.nom}`.toLowerCase().includes(qa.toLowerCase())).map((a) => (
            <React.Fragment key={a.nom}>
              <tr className="stag" onClick={() => setSel(sel === a.nom ? '' : a.nom)}><td><b>{a.nom}</b>{a.aff ? ` (${a.aff})` : ''}</td><td>{a.grade}</td><td><b>{a.total}</b></td><td>{a.days.size}</td>{cols.map((c) => <td key={c}>{a.by[c] || ''}</td>)}<td>{a.eng || ''}</td></tr>
              {sel === a.nom && <tr><td colSpan={cols.length + 5}><div className="small stlist">{a.list.sort((x, y) => x.date.localeCompare(y.date)).map((l, i) => <div key={i}>{fmtShort(l.date)} · {l.group} · {l.col}{l.engaged ? ' · 🔥 engagé' : ''}</div>)}</div></td></tr>}
            </React.Fragment>
          ))}</tbody></table></div>
      )}
      <p className="muted small">Cliquez sur un agent pour voir le détail de ses jours.</p>
      </>}
    </div>
  )
}
