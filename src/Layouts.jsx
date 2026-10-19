import React, { useState } from 'react'
import { useDoc, writeDoc } from './store.js'
import { uid } from './util.js'

const KEY = 'fdf-layout'
const getActive = () => { try { return localStorage.getItem(KEY) || '' } catch { return '' } }

// Dispositions enregistrées (partagées) ; la disposition active est propre à chaque appareil
export function useLayouts() {
  const [doc] = useDoc('layouts/main')
  const list = doc?.list || []
  const [id, setId] = useState(getActive())
  const setActive = (v) => { setId(v); try { localStorage.setItem(KEY, v) } catch {} }
  const active = list.find((l) => l.id === id) || null
  const save = (next) => writeDoc('layouts/main', { list: next }, false)
  return { list, active, activeId: active ? active.id : '', setActive, save }
}

// Lignes de la disposition, rapprochées des groupes réellement présents
export function reconcile(rows, ids) {
  const set = new Set(ids); const seen = new Set()
  const out = (rows || []).map((r) => r.filter((x) => set.has(x) && !seen.has(x) && seen.add(x))).filter((r) => r.length)
  const rest = ids.filter((x) => !seen.has(x))
  if (rest.length) out.push(rest)
  return out
}
export const orderIds = (layout, ids) => (layout ? reconcile(layout.rows, ids).flat() : ids)

const clean = (rows) => rows.filter((r) => r.length)
export const moveBefore = (rows, id, target) => {
  if (id === target) return rows
  const r = rows.map((x) => x.filter((y) => y !== id))
  return clean(r.map((x) => (x.includes(target) ? x.flatMap((y) => (y === target ? [id, y] : [y])) : x)))
}
export const moveToRowEnd = (rows, id, ri) => clean(rows.map((x, i) => (i === ri ? [...x.filter((y) => y !== id), id] : x.filter((y) => y !== id))))
export const moveNewRow = (rows, id) => clean([...rows.map((x) => x.filter((y) => y !== id)), [id]])
export const step = (rows, id, dir) => {
  const ri = rows.findIndex((r) => r.includes(id)); if (ri < 0) return rows
  const row = rows[ri]; const ci = row.indexOf(id)
  if (dir === 'l' || dir === 'r') {
    const j = ci + (dir === 'l' ? -1 : 1); if (j < 0 || j >= row.length) return rows
    const n = [...row]; [n[ci], n[j]] = [n[j], n[ci]]; return rows.map((x, i) => (i === ri ? n : x))
  }
  const rest = rows.map((x, i) => (i === ri ? x.filter((y) => y !== id) : x))
  if (dir === 'u') return clean(ri === 0 ? (row.length > 1 ? [[id], ...rest] : rows) : rest.map((x, i) => (i === ri - 1 ? [...x, id] : x)))
  return clean(ri === rows.length - 1 ? (row.length > 1 ? [...rest, [id]] : rows) : rest.map((x, i) => (i === ri + 1 ? [id, ...x] : x)))
}

// Barre de choix de la disposition (et édition en vue jour)
export function LayoutBar({ lay, editable, edit, onEdit, onSave, onCancel }) {
  const { list, active, activeId, setActive, save } = lay
  const saveAs = () => {
    const name = (window.prompt('Nom de la disposition', active?.name || '') || '').trim(); if (!name) return
    const l = { id: uid(), name }; onSave(l, (rows) => { save([...list, { ...l, rows }]); setActive(l.id) })
  }
  const overwrite = () => onSave(active, (rows) => save(list.map((x) => (x.id === active.id ? { ...x, rows } : x))))
  const del = () => { if (window.confirm(`Supprimer la disposition « ${active.name} » ?`)) { save(list.filter((x) => x.id !== active.id)); setActive('') } }
  return (
    <div className="laybar">
      <label>Disposition&nbsp;
        <select value={activeId} disabled={edit} onChange={(e) => setActive(e.target.value)}>
          <option value="">Par défaut</option>
          {list.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      {editable && !edit && <button onClick={onEdit}>✎ Modifier la disposition</button>}
      {editable && !edit && active && <button className="danger" onClick={del}>Supprimer</button>}
      {edit && <>
        <span className="muted small">Glissez les groupes ou utilisez les flèches.</span>
        {active && <button className="primary" onClick={overwrite}>Enregistrer « {active.name} »</button>}
        <button className={active ? '' : 'primary'} onClick={saveAs}>Enregistrer sous…</button>
        <button onClick={onCancel}>Terminer sans enregistrer</button>
      </>}
    </div>
  )
}
