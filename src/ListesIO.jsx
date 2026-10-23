import React, { useState } from 'react'
import { useDoc } from './store.js'
import { usePersonnel } from './Personnel.jsx'
import { ROLES, assignableBy } from './roles.js'
import { uid } from './util.js'

// ---------- CSV (Excel FR : séparateur « ; », UTF-8 avec BOM) ----------
const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`
const toCsv = (rows) => '﻿' + rows.map((r) => r.map(q).join(';')).join('\r\n')
function parseCsv(text) {
  const t = text.replace(/^﻿/, '')
  const first = t.split(/\r?\n/)[0] || ''
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ','
  const rows = []; let row = [], cur = '', inq = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (inq) { if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++ } else inq = false } else cur += ch }
    else if (ch === '"') inq = true
    else if (ch === sep) { row.push(cur); cur = '' }
    else if (ch === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = '' }
    else cur += ch
  }
  if (cur || row.length) { row.push(cur.replace(/\r$/, '')); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const asObjects = (rows) => { const h = rows[0].map(norm); return rows.slice(1).map((r) => Object.fromEntries(h.map((k, i) => [k, (r[i] ?? '').trim()]))) }
const download = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove() }
const readFile = (file) => file.text().then((t) => (file.name.toLowerCase().endsWith('.json') || /^\s*[\[{]/.test(t) ? { json: JSON.parse(t) } : { rows: parseCsv(t) }))

export default function ListesIO({ config, role, selfId }) {
  const P = usePersonnel(config, role, selfId, true)
  const [fleet, , replaceFleet] = useDoc('fleet/main')
  const [cal, , replaceCal] = useDoc('calendar/main')
  const [msg, setMsg] = useState('')
  const [replace, setReplace] = useState(false)
  const can = assignableBy(role)
  const roleCode = (v) => { const x = norm(v); if (!x) return ''; const c = Object.entries(ROLES).find(([k, r]) => norm(k) === x || norm(r.label) === x)?.[0]; return c && can.includes(c) && !['pending', 'refused', 'superadmin'].includes(c) ? c : '' }
  const fonctions = config.fonctions || []
  const roleOf = (p) => (p.role !== undefined ? p.role : fonctions.find((f) => f.id === p.fonction)?.role || '')

  const wrap = (label, fn) => async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
    try { setMsg(`${label} : ${await fn(await readFile(f))}`) } catch (x) { setMsg(`${label} : fichier illisible (${x.message || 'format'})`) }
  }

  /* ----- personnel ----- */
  const expP = () => download('personnel.csv', toCsv([['nom', 'prenom', 'grade', 'fdf', 'cadre_emploi', 'role', 'email'], ...P.list.map((p) => [p.nom, p.prenom, p.grade, p.fdf, p.cadreEmploi, roleOf(p), p.email])]), 'text/csv')
  const impP = wrap('Personnel', async ({ json, rows }) => {
    const src = json ? (Array.isArray(json) ? json : json.list || []).map((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [norm(k), v]))) : asObjects(rows)
    const items = src.map((o) => ({ nom: String(o.nom || '').toUpperCase(), prenom: o.prenom || '', grade: o.grade || '', fdf: o.fdf || '', cadreEmploi: o.cadreemploi || '', role: roleCode(o.role), email: String(o.email || '').trim() })).filter((p) => p.nom)
    const key = (p) => `${p.nom}|${(p.prenom || '').toLowerCase()}`
    let list = replace ? [] : [...P.list]; let add = 0, upd = 0
    items.forEach((it) => {
      const i = list.findIndex((x) => key(x) === key(it))
      if (i >= 0) { list[i] = { ...list[i], ...Object.fromEntries(Object.entries(it).filter(([, v]) => v !== '')) , role: it.role || list[i].role }; upd++ } else { list.push({ id: uid(), ...it }); add++ }
    })
    await P.save(list)
    return `${add} ajoutée(s), ${upd} mise(s) à jour${replace ? ' (liste remplacée)' : ''}.`
  })

  /* ----- engins ----- */
  const engins = fleet?.engins || []
  const expE = () => download('engins.csv', toCsv([['code', 'cis', 'categorie', 'statut'], ...engins.map((e) => [e.code, e.cis, e.cat, e.status])]), 'text/csv')
  const impE = wrap('Engins', async ({ json, rows }) => {
    const src = json ? (Array.isArray(json) ? json : json.engins || []).map((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [norm(k), v]))) : asObjects(rows)
    const items = src.map((o) => ({ code: String(o.code || '').trim(), cis: String(o.cis || '').trim().toUpperCase(), cat: o.categorie || o.cat || '', status: o.statut || o.status || 'DISPONIBLE' })).filter((e) => e.code)
    const key = (e) => `${e.code.toLowerCase()}|${e.cis}`
    const list = replace ? [] : [...engins]; let add = 0, upd = 0
    items.forEach((it) => { const i = list.findIndex((x) => key(x) === key(it)); if (i >= 0) { list[i] = { ...list[i], ...it }; upd++ } else { list.push({ id: uid(), ...it }); add++ } })
    await replaceFleet({ ...(fleet || {}), engins: list })
    return `${add} ajouté(s), ${upd} mis à jour${replace ? ' (liste remplacée)' : ''}.`
  })

  /* ----- calendrier perpétuel ----- */
  const lines = cal?.lines || []
  const len = cal?.length || 31
  const expC = () => download('calendrier.csv', toCsv([['groupe', 'ligne', 'cible', ...Array.from({ length: len }, (_, i) => String(i + 1))], ...lines.map((l) => [l.group, l.label, l.target, ...Array.from({ length: len }, (_, i) => l.vals?.[i] || '')])]), 'text/csv')
  const impC = wrap('Calendrier', async ({ json, rows }) => {
    let items
    if (json) items = (Array.isArray(json) ? json : json.lines || [])
    else {
      const h = rows[0].map(norm)
      const ix = { group: h.indexOf('groupe'), label: h.indexOf('ligne'), target: h.indexOf('cible') }
      const dayCols = h.map((x, i) => [x, i]).filter(([x]) => /^\d+$/.test(x)).map(([x, i]) => [Number(x), i])
      const n = Math.max(len, ...dayCols.map(([d]) => d))
      items = rows.slice(1).map((r) => ({ group: (r[ix.group] || '').trim(), label: (r[ix.label] || '').trim(), target: (r[ix.target] || '').trim(), vals: Array.from({ length: n }, (_, k) => { const c = dayCols.find(([d]) => d === k + 1); return c ? (r[c[1]] || '').trim() : '' }) }))
    }
    items = items.filter((l) => l.label || l.group)
    const key = (l) => `${l.group}|${l.label}|${l.target || ''}`
    const out = replace ? [] : [...lines]; let add = 0, upd = 0
    items.forEach((it) => { const i = out.findIndex((x) => key(x) === key(it)); if (i >= 0) { out[i] = { ...out[i], ...it, id: out[i].id }; upd++ } else { out.push({ id: it.id || uid(), ...it }); add++ } })
    await replaceCal({ ...(cal || {}), length: cal?.length || 31, lines: out })
    return `${add} ligne(s) ajoutée(s), ${upd} mise(s) à jour${replace ? ' (calendrier remplacé)' : ''}.`
  })

  const Card = ({ title, count, onExport, onImport, hint }) => (
    <div className="card">
      <b>{title}</b> <span className="muted small">{count} ligne(s)</span>
      <div className="line wrap">
        <button onClick={onExport}>⭳ Exporter (CSV Excel)</button>
        <label className="filebtn">⭱ Importer (CSV ou JSON)<input type="file" accept=".csv,.json,text/csv,application/json" onChange={onImport} hidden /></label>
      </div>
      <p className="muted small">{hint}</p>
    </div>
  )
  return (
    <div className="stack">
      <h3>Listes : export / import</h3>
      <label className="chk"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Remplacer toute la liste à l'import (sinon : fusion, sans rien supprimer)</label>
      <Card title="Gestion du personnel" count={P.list.length} onExport={expP} onImport={impP}
        hint="Colonnes : nom ; prenom ; grade ; fdf ; cadre_emploi ; role (ogg, chefcolonne, chefsite, admin ou vide) ; email. Fusion sur nom + prénom." />
      <Card title="Engins" count={engins.length} onExport={expE} onImport={impE}
        hint="Colonnes : code ; cis ; categorie ; statut. Fusion sur code + CIS." />
      <Card title="Calendrier perpétuel" count={lines.length} onExport={expC} onImport={impC}
        hint="Colonnes : groupe ; ligne ; cible ; puis 1 à 31 (valeur du jour du mois, ex. PDB, VIT, CBE1). Fusion sur groupe + ligne + cible." />
      {msg && <div className="banner">{msg}</div>}
    </div>
  )
}
