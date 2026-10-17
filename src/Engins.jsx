import React, { useMemo, useState } from 'react'
import { useDoc } from './store.js'
import { TextField } from './Cell.jsx'
import { uid } from './util.js'

export default function Engins({ config }) {
  const [doc, patch] = useDoc('fleet/main')
  const [q, setQ] = useState('')
  const [cis, setCis] = useState('')
  const [edit, setEdit] = useState(false)
  const [add, setAdd] = useState({ cat: '', code: '', cis: '' })
  const sts = config.statuses
  const eng = doc?.engins || []
  const cats = doc?.cats?.length ? doc.cats : [...new Set(eng.map((e) => e.cat))]
  const stOf = (id) => sts.find((s) => s.id === id) || { id, label: id, color: '#6b7280' }
  const save = (list) => patch({ engins: list })
  const cycle = (e) => { const i = sts.findIndex((s) => s.id === e.status); save(eng.map((x) => (x.id === e.id ? { ...x, status: sts[(i + 1) % sts.length].id } : x))) }
  const cisList = useMemo(() => [...new Set(eng.map((e) => e.cis).filter(Boolean))].sort(), [eng])
  const shown = eng.filter((e) => (!cis || e.cis === cis) && (!q || `${e.code} ${e.cis}`.toLowerCase().includes(q.toLowerCase())))
  const count = (id) => shown.filter((e) => e.status === id).length

  return (
    <div>
      <div className="subbar">
        <div className="stats">
          {sts.map((s) => <span key={s.id} className="pill" style={{ '--st': s.color }}><i />{s.label} <b>{count(s.id)}</b></span>)}
          <span className="muted">/ {shown.length}</span>
        </div>
        <div className="actions">
          <input className="short" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="short" value={cis} onChange={(e) => setCis(e.target.value)}><option value="">Tous les CIS</option>{cisList.map((c) => <option key={c}>{c}</option>)}</select>
          <button className={edit ? 'primary' : ''} onClick={() => setEdit(!edit)}>{edit ? 'Terminer' : 'Modifier le parc'}</button>
        </div>
      </div>
      {!doc ? null : !eng.length && <p className="muted">Parc vide. Ajoutez des engins ou importez les données du classeur (Paramètres › Données).</p>}
      {edit && (
        <div className="card line wrap">
          <select value={add.cat} onChange={(e) => setAdd({ ...add, cat: e.target.value })}><option value="">Catégorie</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
          <input placeholder="Code (CCFM-12)" value={add.code} onChange={(e) => setAdd({ ...add, code: e.target.value })} />
          <input placeholder="CIS" value={add.cis} onChange={(e) => setAdd({ ...add, cis: e.target.value.toUpperCase() })} />
          <button className="primary" disabled={!add.code || !add.cat}
            onClick={() => { save([...eng, { id: uid(), ...add, status: sts[0].id }]); setAdd({ ...add, code: '' }) }}>+ Ajouter</button>
        </div>
      )}
      <div className="grid cats">
        {cats.map((cat) => {
          const list = shown.filter((e) => e.cat === cat)
          if (!list.length) return null
          return (
            <section className="card" key={cat}>
              <h3 className="cathead">{cat} <span className="muted">{list.length}</span></h3>
              <ul className="englist">
                {list.map((e) => {
                  const s = stOf(e.status)
                  return (
                    <li key={e.id}>
                      {edit ? <TextField value={`${e.code}`} onCommit={(t) => save(eng.map((x) => (x.id === e.id ? { ...x, code: t } : x)))} />
                        : <span className="ecode">{e.code}</span>}
                      {edit
                        ? <TextField className="cisf" value={e.cis} onCommit={(t) => save(eng.map((x) => (x.id === e.id ? { ...x, cis: t.toUpperCase() } : x)))} />
                        : <span className="cis">{e.cis}</span>}
                      <button className="status" style={{ '--st': s.color }} onClick={() => cycle(e)}>{s.label}</button>
                      {edit && <button className="danger" aria-label="Supprimer" onClick={() => save(eng.filter((x) => x.id !== e.id))}>✕</button>}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
