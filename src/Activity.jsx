import React, { useMemo, useState } from 'react'
import { useDoc } from './store.js'
import { iso, addDays, fmtDMY } from './util.js'

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

export function ActItem({ x, config }) {
  return (
    <div className={`act ${x.auto ? 'auto' : ''}`}>
      <div className="acthead"><b>{new Date(x.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</b> <span>{x.who}</span>{x.role && <span className="muted"> ({x.role})</span>} <span className="chip">{area(x.path, config)}</span></div>
      <ul>
        {x.ch.map((c, j) => (
          <li key={j}><span>{what(x.path, c.p, config)}</span> : {c.o ? <s className="muted">{c.o}</s> : null}{c.o && c.n ? ' → ' : ''}{c.n ? <b>{c.n}</b> : (!c.o ? <i className="muted">vide</i> : <i className="muted"> supprimé</i>)}</li>
        ))}
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
    items.forEach((x) => x.ch.forEach((c) => rows.push([new Date(x.t).toLocaleTimeString('fr-FR'), x.who, x.role, area(x.path, config), what(x.path, c.p, config), c.o, c.n])))
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
