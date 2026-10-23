import React, { useMemo, useState } from 'react'
import { useDoc } from './store.js'
import { iso, addDays, fmtDMY } from './util.js'
import { ROLES } from './roles.js'

const AREAS = { 'config/main': 'Paramètres', 'config/rights': 'Droits des rôles', 'fleet/main': 'Engins', 'cadres/main': 'Cadres', 'calendar/main': 'Calendrier', 'personnel/main': 'Personnel' }
const PLAN = { chefsgiff: 'Planning chefs de GIFF', gcdt: 'Planning GCDT', vpc: 'Planning garde VPC' }
const KEYS = { header: 'En-tête', heads: 'Chef', headCis: 'CIS', headsAuto: '', locs: 'Emplacement', duty: 'Astreinte/Caserné', names: 'Nom', comment: 'Commentaire', customBlocks: 'Bloc ajouté', overrides: 'Bloc personnalisé', cells: '', extra: 'Ligne ajoutée', autoDone: '' }

export function area(path, config) {
  if (AREAS[path]) return AREAS[path]
  const [a, b] = path.split('/')
  if (a === 'days') return 'Jour ' + fmtDMY(b)
  if (a === 'planning') return PLAN[b] || 'Planning ' + b
  if (a === 'users') return 'Rôle utilisateur'
  return path
}
export function what(path, p, config) {
  if (p === 'auto') return 'Remplissage automatique'
  if (!path.startsWith('days/')) return p
  const [k, ...r] = p.split('.')
  if (k === 'cells') {
    const [bid, rid] = (r[0] || '').split('__'); const b = config.blocks.find((x) => x.id === bid) || (config.blocks.flatMap((x) => []))
    const row = b?.rows?.find((x) => x.id === rid)
    return `${b?.title || bid} ${row?.label || rid || ''}${r[1] === 'status' ? ' (statut)' : ''}`.trim()
  }
  if (['heads', 'headCis', 'locs', 'names', 'duty'].includes(k)) { const b = config.blocks.find((x) => x.id === r[0]); return `${b?.title || r[0]} · ${KEYS[k]}${r[1] ? ' ' + r.slice(1).join('.') : ''}` }
  if (k === 'header') return config.header.find((h) => h.id === r[0])?.label || r[0]
  return KEYS[k] || p
}


const hm = (v) => { const t = typeof v === 'number' || /^\d{10,}$/.test(String(v)) ? new Date(Number(v)) : new Date(v); return isNaN(t) ? String(v) : t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h') }
const q = (s) => `« ${s} »`
const bname = (config, id) => (config.blocks || []).find((b) => b.id === id)?.title || id

// Traduit les changements bruts d'une entrée en phrases lisibles : [{ t }] (phrase) ou [{ l, o, n }] (champ modifié)
export function explain(path, ch, config) {
  if (!path.startsWith('days/')) return ch.map((c) => ({ l: what(path, c.p, config), o: c.o, n: c.n }))
  const out = [], seen = new Set()
  const say = (t) => { if (!seen.has(t)) { seen.add(t); out.push({ t }) } }
  const G = {}   // champs groupés par objet : validated, journal.<id>, engaged.<bloc>, aladin.<bloc>, notif.<bloc>
  const rest = []
  ch.forEach((c) => {
    const [k, ...r] = c.p.split('.')
    if (k === 'validated') (G.validated ||= { k }).f = { ...(G.validated.f || {}), [r[0] || 'at']: c }
    else if (k === 'journal' && r.length) { const g = (G['journal.' + r[0]] ||= { k, id: r[0], f: {} }); g.f[r[1] || 'text'] = c }
    else if (['engaged', 'aladin', 'notif'].includes(k) && r.length) { const g = (G[k + '.' + r[0]] ||= { k, id: r[0], f: {} }); g.f[r[1] || 'at'] = c }
    else rest.push(c)
  })
  Object.values(G).forEach((g) => {
    const f = g.f
    if (g.k === 'validated') { if (f.at?.n) say(`✅ Dispositif validé à ${hm(f.at.n)}${f.by?.n ? ' par ' + f.by.n : ''}`); else if (f.at?.o) say('↩️ Validation du dispositif annulée') }
    else if (g.k === 'journal') {
      const t = f.text
      if (f.at?.n && t?.n) say(`📒 Main courante : ${q(t.n)}`)
      else if (t?.o && t?.n) say(`✏️ Main courante modifiée : ${q(t.o)} → ${q(t.n)}`)
      else if (!t?.n && t?.o) say(`🗑️ Main courante : entrée supprimée ${q(t.o)}`)
    } else {
      const nm = bname(config, g.id), blk = (config.blocks || []).find((b) => b.id === g.id)
      const word = g.k === 'aladin' ? 'Aladin' : 'Engagé'
      if (g.k === 'notif') { const lab = blk?.section === 'cdt' ? 'Cadres informés' : 'CIS informés'; if (f.at?.n) say(`🔔 ${nm} : ${lab} à ${hm(f.at.n)}${f.by?.n ? ' par ' + f.by.n : ''}`); else if (f.at?.o) say(`↩️ ${nm} : « ${lab} » annulé`) }
      else if (f.at?.n) say(`${g.k === 'aladin' ? '🚨' : '🔥'} ${nm} : ${word} à ${hm(f.at.n)}${f.by?.n ? ' par ' + f.by.n : ''}${f.note?.n ? ' — ' + q(f.note.n) : ''}`)
      else if (f.at?.o) say(`↩️ ${nm} : « ${word} » annulé`)
      else if (f.note) say(`💬 ${nm} : commentaire ${word} ${f.note.n ? q(f.note.n) : 'effacé'}`)
    }
  })
  const lines = []
  rest.forEach((c) => {
    const [k, ...r] = c.p.split('.')
    if (k === 'shown' && r[0]) return say(`${c.n === 'true' || c.n === true ? '➕ Bloc affiché' : '➖ Bloc masqué'} : ${bname(config, r[0])}`)
    if (k === 'overrides' && r[0]) return say(`⚙️ Bloc configuré pour ce jour : ${bname(config, r[0])}`)
    if (k === 'customBlocks') return say(c.n && !c.o ? `➕ Bloc ajouté : ${String(c.n).replace(/^\+ /, '')}` : c.o && !c.n ? `➖ Bloc supprimé : ${String(c.o).replace(/^− /, '')}` : `✏️ Bloc modifié : ${String(c.n).replace(/^✎ /, '')}`)
    lines.push({ l: what(path, c.p, config), o: c.o, n: c.n })
  })
  return [...out, ...lines]
}

export function ActItem({ x, config }) {
  const ls = explain(x.path, x.ch, config)
  return (
    <div className={`act ${x.auto ? 'auto' : ''}`}>
      <div className="acthead"><b>{new Date(x.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</b> <span>{x.who}</span>{x.role && <span className="muted"> ({ROLES[x.role]?.label || x.role})</span>} <span className="chip">{area(x.path, config)}</span></div>
      <ul>
        {ls.map((c, j) => c.t
          ? <li key={j}>{c.t}</li>
          : <li key={j}><span>{c.l}</span> : {c.o ? <s className="muted">{c.o}</s> : null}{c.o && c.n ? ' → ' : ''}{c.n ? <b>{c.n}</b> : (!c.o ? <i className="muted">vide</i> : <i className="muted"> supprimé</i>)}</li>)}
        {x.more > 0 && <li className="muted">… et {x.more} autre(s)</li>}
      </ul>
    </div>
  )
}

export default function Activity({ config }) {
  const [date, setDate] = useState(iso(new Date()))
  const [q, setQ] = useState('')
  const [doc] = useDoc(`activity/${date}`)
  const items = useMemo(() => [...(doc?.items || [])].sort((a, b) => b.t - a.t).filter((x) => !q || JSON.stringify(x).toLowerCase().includes(q.toLowerCase())), [doc, q])
  const exportCsv = () => {
    const Q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`
    const rows = [['Heure', 'Utilisateur', 'Rôle', 'Zone', 'Élément', 'Avant', 'Après']]
    items.forEach((x) => explain(x.path, x.ch, config).forEach((c) => rows.push([new Date(x.t).toLocaleTimeString('fr-FR'), x.who, ROLES[x.role]?.label || x.role, area(x.path, config), c.t || c.l, c.t ? '' : c.o, c.t ? '' : c.n])))
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.map((r) => r.map(Q).join(';')).join('\n')], { type: 'text/csv' })); a.download = `activite_${date}.csv`; a.click()
  }
  return (
    <div className="stack">
      <div className="line">
        <button onClick={() => setDate(addDays(date, -1))} aria-label="Jour précédent">‹</button>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button onClick={() => setDate(addDays(date, 1))} aria-label="Jour suivant">›</button>
        <button onClick={() => setDate(iso(new Date()))}>Aujourd’hui</button>
        <input className="txt" placeholder="Filtrer (nom, zone, valeur…)" value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={exportCsv} disabled={!items.length}>⭳ CSV</button>
      </div>
      <p className="muted small">{doc === undefined ? 'Chargement…' : `${items.length} modification(s) le ${fmtDMY(date)}`}</p>
      <div className="actlist">
        {items.map((x, i) => <ActItem key={x.t + '-' + i} x={x} config={config} />)}
        {doc !== undefined && !items.length && <p className="muted">Aucune modification enregistrée ce jour-là.</p>}
      </div>
    </div>
  )
}
