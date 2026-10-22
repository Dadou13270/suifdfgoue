import React, { useEffect, useState } from 'react'
import { useDoc, writeDoc } from './store.js'
import { uid } from './util.js'


// Dispositions enregistrées et disposition active : partagées par tous (seuls superadmin / admin les choisissent)
export function useLayouts() {
  const [doc] = useDoc('layouts/main')
  // Firestore refuse les tableaux imbriqués : chaque ligne est stockée sous la forme { ids: [...] }
  const list = (doc?.list || []).map((l) => ({ ...l, rows: (l.rows || []).map((r) => (Array.isArray(r) ? r : r.ids || [])) }))
  const id = doc?.activeId || ''
  const setActive = (v) => writeDoc('layouts/main', { activeId: v }, true)
  const active = list.find((l) => l.id === id) || null
  const save = (next) => writeDoc('layouts/main', { list: next.map((l) => ({ id: l.id, name: l.name, rows: (l.rows || []).map((ids) => ({ ids })) })) }, true)
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

// Barre de choix de la disposition (et édition en vue jour) — sans boîtes de dialogue du navigateur
export function LayoutBar({ lay, editable, edit, onEdit, onSave, onCancel }) {
  const { list, active, activeId, setActive, save } = lay
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [askDel, setAskDel] = useState(false)
  useEffect(() => { setName(''); setMsg(''); setAskDel(false) }, [edit]) // eslint-disable-line
  const run = async (fn, ok) => { try { await fn(); setMsg(ok) } catch (e) { setMsg(`Échec de l'enregistrement : ${e?.code || e?.message || e}`) } }
  const saveAs = () => {
    const n = name.trim(); if (!n) { setMsg('Saisissez un nom pour la nouvelle disposition.'); return }
    if (list.some((x) => x.name.toLowerCase() === n.toLowerCase())) { setMsg('Ce nom existe déjà.'); return }
    const l = { id: uid(), name: n }
    onSave(l, (rows) => run(async () => { await save([...list, { ...l, rows }]); setActive(l.id) }, `Disposition « ${n} » enregistrée.`))
  }
  const overwrite = () => onSave(active, (rows) => run(() => save(list.map((x) => (x.id === active.id ? { ...x, rows } : x))), `Disposition « ${active.name} » mise à jour.`))
  const del = () => run(async () => { await save(list.filter((x) => x.id !== active.id)); setActive(''); setAskDel(false) }, 'Disposition supprimée.')
  return (
    <div className="laybar">
      <label>Disposition&nbsp;
        <select value={activeId} disabled={edit} onChange={(e) => { setActive(e.target.value); setMsg('') }}>
          <option value="">Par défaut</option>
          {list.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      {editable && !edit && <button onClick={onEdit}>✎ Modifier la disposition</button>}
      {editable && !edit && active && !askDel && <button className="danger" onClick={() => setAskDel(true)}>Supprimer</button>}
      {editable && !edit && active && askDel && <><span className="small">Supprimer « {active.name} » ?</span><button className="danger" onClick={del}>Oui, supprimer</button><button onClick={() => setAskDel(false)}>Non</button></>}
      {edit && <div className="laybar-edit">
        <span className="muted small">Glissez les groupes ou utilisez les flèches, puis enregistrez.</span>
        {active && <button className="primary" onClick={overwrite}>Enregistrer « {active.name} »</button>}
        <input className="layname" placeholder="Nom de la nouvelle disposition" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveAs()} />
        <button className={active ? '' : 'primary'} onClick={saveAs}>Enregistrer sous ce nom</button>
        <button onClick={onCancel}>Terminer</button>
      </div>}
      {msg && <span className="small laymsg">{msg}</span>}
    </div>
  )
}
