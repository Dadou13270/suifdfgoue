import React, { useEffect, useMemo, useState } from 'react'
import { useDoc } from './store.js'
import { TextField } from './Cell.jsx'
import { uid } from './util.js'
import { ENG, releaseOne } from './engage.js'

export default function Engins({ config }) {
  const [doc, patch] = useDoc('fleet/main')
  const [q, setQ] = useState('')
  const [cis, setCis] = useState('')
  const [edit, setEdit] = useState(false)
  const [add, setAdd] = useState({ cat: '', code: '', cis: '' })
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')
  const sts = config.statuses
  const fixCat = (e) => { const m = e.cat === 'CCFM' && /^CCFS(6|9)\b/.exec(String(e.code || '').toUpperCase()); return m ? `CCFS${m[1]}` : e.cat }
  const eng = useMemo(() => (doc?.engins || []).map((e) => { const c = fixCat(e); return c === e.cat ? e : { ...e, cat: c } }), [doc])
  const cats = useMemo(() => {
    const base = doc?.cats?.length ? [...doc.cats] : [...new Set(eng.map((e) => e.cat))]
    ;['CCFS6', 'CCFS9'].forEach((n) => { if (eng.some((e) => e.cat === n) && !base.includes(n)) base.splice(Math.max(base.indexOf('CCFM'), -1) + 1 + (n === 'CCFS9' && base.includes('CCFS6') ? base.indexOf('CCFS6') - base.indexOf('CCFM') : 0), 0, n) })
    return base
  }, [doc, eng])
  useEffect(() => { if (doc && eng.some((e, i) => e !== doc.engins[i])) patch({ engins: eng, cats }) }, [doc]) // eslint-disable-line
  const stOf = (id) => sts.find((s) => s.id === id) || { id, label: id, color: '#6b7280' }
  const save = (list) => patch({ engins: list })
  const cycle = (e) => { const i = sts.findIndex((s) => s.id === e.status); save(eng.map((x) => (x.id === e.id ? { ...x, status: sts[(i + 1) % sts.length].id } : x))) }
  const cisList = useMemo(() => [...new Set(eng.map((e) => e.cis).filter(Boolean))].sort(), [eng])
  const shown = eng.filter((e) => (!cis || e.cis === cis) && (!q || `${e.code} ${e.cis}`.toLowerCase().includes(q.toLowerCase())))
  const key = (code, c) => `${code} ${c || ''}`.trim().toUpperCase()
  const dupAdd = !!add.code.trim() && eng.some((e) => key(e.code, e.cis) === key(add.code.trim(), add.cis.trim()))
  const addEngine = () => {
    const e = { id: uid(), cat: add.cat.trim(), code: add.code.trim(), cis: add.cis.trim(), status: sts.find((x) => x.avail)?.id || sts[0].id }
    const newCats = doc?.cats?.length && !doc.cats.includes(e.cat) ? { cats: [...doc.cats, e.cat] } : {}
    patch({ engins: [...eng, e], ...newCats })
    setMsg(`${e.code} ${e.cis} ajouté (${e.cat}).`)
    setAdd({ ...add, code: '' })
  }
  const engaged = shown.filter((e) => e.status === ENG)
  const groups = [...new Set(engaged.map((e) => e.eng?.group || 'Engagés'))]
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
          <button className={adding ? 'primary' : ''} onClick={() => { setAdding(!adding); setMsg('') }}>+ Engin</button>
          <button className={edit ? 'primary' : ''} onClick={() => setEdit(!edit)}>{edit ? 'Terminer' : 'Modifier le parc'}</button>
        </div>
      </div>
      {!doc ? null : !eng.length && <p className="muted">Parc vide. Ajoutez des engins ou importez les données du classeur (Paramètres › Données).</p>}
      {adding && (
        <div className="card">
          <div className="line wrap">
            <input list="cat-list" placeholder="Catégorie (existante ou nouvelle)" value={add.cat} onChange={(e) => setAdd({ ...add, cat: e.target.value })} />
            <datalist id="cat-list">{cats.map((c) => <option key={c} value={c} />)}</datalist>
            <input placeholder="Code (CCFM-12)" value={add.code} onChange={(e) => setAdd({ ...add, code: e.target.value.toUpperCase() })} />
            <input list="cis-list" placeholder="CIS" value={add.cis} onChange={(e) => setAdd({ ...add, cis: e.target.value.toUpperCase() })} />
            <datalist id="cis-list">{cisList.map((c) => <option key={c} value={c} />)}</datalist>
            <button className="primary" disabled={!add.code.trim() || !add.cat.trim() || dupAdd} onClick={addEngine}>+ Ajouter</button>
            <button onClick={() => setAdding(false)}>Fermer</button>
          </div>
          {dupAdd && <p className="small" style={{ color: '#dc2626' }}>{add.code.trim()} {add.cis.trim()} existe déjà dans le parc.</p>}
          {msg && <p className="small">{msg}</p>}
        </div>
      )}
      {engaged.length > 0 && (
        <section className="card engaged">
          <h3 className="cathead">🔥 Engagés <span className="muted">{engaged.length}</span></h3>
          <p className="muted small">Touchez un engin pour le désengager : il redevient disponible.</p>
          {groups.map((g) => {
            const list = engaged.filter((e) => (e.eng?.group || 'Engagés') === g)
            const meta = list[0]?.eng
            return (
              <div key={g} className="enggroup">
                <b>{g}</b>{meta?.note && <span className="muted"> — {meta.note}</span>}{meta?.date && <span className="muted small"> · {meta.date}</span>}
                <div className="engchips">{list.map((e) => (
                  <button key={e.id} className="engchip" title="Désengager" onClick={() => save(releaseOne(eng, e.id, sts))}>{e.code} <span className="cis">{e.cis}</span> ✕</button>
                ))}</div>
              </div>
            )
          })}
        </section>
      )}
      <div className="grid cats">
        {cats.map((cat) => {
          const list = shown.filter((e) => e.cat === cat && e.status !== ENG)
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
