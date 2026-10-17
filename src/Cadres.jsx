import React, { useEffect, useState } from 'react'
import { useDoc, subscribe } from './store.js'
import { TextField } from './Cell.jsx'
import { uid } from './util.js'
import { DEFAULT_CONFIG } from './defaults.js'

const COLS = [['grade', 'Grade', 70], ['nom', 'Nom', 130], ['prenom', 'Prénom', 110], ['dispos', 'Dispos', 70, 'num'], ['giff', 'GIFF', 90, 'giff'], ['mil', 'MIL', 50, 'mil'],
  ['fonct', 'Aff. fonctionnelle', 110], ['cdg', 'CDG terr.', 90], ['aff', 'Affectation', 90], ['just', 'Justification', 200]]

export default function Cadres({ config }) {
  const [doc, patch] = useDoc('cadres/main')
  const [pers] = useDoc('personnel/main')
  const [fd, setFd] = useState('')
  const [ml, setMl] = useState('')
  const fdfs = config?.lists?.fdf || ['FDF3', 'FDF4', 'FDF5']
  const N = (s) => String(s || '').trim().toUpperCase()
  const fdfOf = (c) => (pers?.list || []).find((p) => N(p.nom) === N(c.nom))?.fdf || ''
  // noms saisis dans les plannings
  const [plans, setPlans] = useState({})
  const pids = (config?.plannings || []).map((p) => p.id).join(',')
  useEffect(() => {
    const offs = pids.split(',').filter(Boolean).map((id) => subscribe(`planning/${id}`, (v) => setPlans((x) => ({ ...x, [id]: v?.days || {} }))))
    return () => offs.forEach((o) => o())
  }, [pids])
  const inPlans = new Map()
  ;(config?.plannings || []).forEach((pl) => Object.values(plans[pl.id] || {}).forEach((row) => pl.cols.forEach((c) => { const n = N(row?.[c.id]); if (n && !inPlans.has(n)) inPlans.set(n, { nom: n, fdf: c.fdf || '' }) })))
  const have = new Set((doc?.list || []).map((c) => N(c.nom)))
  const byNom = new Map()
  ;(pers?.list || []).filter((p) => p.nom && !have.has(N(p.nom))).forEach((p) => byNom.set(N(p.nom), p))
  inPlans.forEach((v, n) => { if (!have.has(n) && !byNom.has(n)) byNom.set(n, { nom: n, prenom: '', grade: '' }) })
  const missing = [...byNom.values()]
  const [q, setQ] = useState('')
  const [g, setG] = useState('')
  const list = doc?.list || []
  const set = (id, p) => patch({ list: list.map((c) => (c.id === id ? { ...c, ...p } : c)) })
  const shown = list.filter((c) => (!g || c.giff === g) && (!fd || fdfOf(c) === fd) && (!ml || (ml === 'oui' ? !!c.mil : !c.mil)) && (!q || `${c.nom} ${c.prenom}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr') || String(a.prenom || '').localeCompare(String(b.prenom || ''), 'fr'))

  return (
    <div>
      <div className="subbar">
        <b>Cadres COD VLTT / CDG <span className="muted">{shown.length}/{list.length}</span></b>
        <div className="actions">
          <input className="short" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="short" value={ml} onChange={(e) => setMl(e.target.value)}><option value="">MIL : tous</option><option value="oui">MIL cochés</option><option value="non">Hors MIL</option></select>
          <select className="short" value={fd} onChange={(e) => setFd(e.target.value)}><option value="">Tous FDF</option>{fdfs.map((x) => <option key={x}>{x}</option>)}</select>
          <button onClick={() => patch({ list: [...missing.map((p) => ({ id: uid(), grade: p.grade || '', nom: N(p.nom), prenom: p.prenom || '', dispos: 0, giff: '', mil: false, fonct: '', cdg: '', aff: '', just: '' })), ...list] })} disabled={!missing.length} title="Ajoute à la liste les noms présents dans Gestion du personnel ou saisis dans les plannings et absents des cadres">+ Noms manquants{missing.length ? ` (${missing.length})` : ''}</button>
          <select className="short" value={g} onChange={(e) => setG(e.target.value)}><option value="">Tous GIFF</option><option>CENTRE</option><option>OUEST</option><option>EST</option></select>
          <button className="primary" onClick={() => patch({ list: [{ id: uid(), grade: '', nom: 'NOUVEAU', prenom: '', dispos: 0, giff: '', mil: false, fonct: '', cdg: '', aff: '', just: '' }, ...list] })}>+ Cadre</button>
        </div>
      </div>
      {doc && !list.length && <p className="muted">Liste vide. Importez les données du classeur (Paramètres › Données).</p>}
      <div className="tablewrap">
        <table className="week cadtable">
          <thead><tr><th>FDF</th>{COLS.map(([k, l]) => <th key={k} className={k === 'nom' ? 'sticky' : ''}>{l}</th>)}<th /></tr></thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id}>
                <td><b>{fdfOf(c)}</b></td>
                {COLS.map(([k, , w, t]) => (
                  <td key={k} className={k === 'nom' ? 'sticky' : ''} style={{ minWidth: w }}>
                    {k === 'grade'
                      ? (() => {
                          const f = fdfOf(c)
                          const all = config?.lists?.grades || DEFAULT_CONFIG.lists.grades
                          const ok = f ? (config?.fdfGrades || DEFAULT_CONFIG.fdfGrades)[f] : null
                          const opts = (ok?.length ? all.filter((g) => ok.includes(g)) : all)
                          return <select value={c.grade || ''} onChange={(e) => set(c.id, { grade: e.target.value })} title={f ? `Grades ${f}` : ''}>
                            <option value="">—</option>{[...new Set([...(c.grade ? [c.grade] : []), ...opts])].map((g) => <option key={g}>{g}</option>)}
                          </select>
                        })()
                      : t === 'mil'
                      ? <input type="checkbox" className="milchk" aria-label="MIL" checked={!!c.mil} onChange={(e) => set(c.id, { mil: e.target.checked })} />
                      : t === 'giff'
                      ? <select value={c.giff} onChange={(e) => set(c.id, { giff: e.target.value })}><option value="">—</option><option>CENTRE</option><option>OUEST</option><option>EST</option></select>
                      : <TextField value={String(c[k] ?? '')} onCommit={(v) => set(c.id, { [k]: t === 'num' ? Number(v) || 0 : v })} />}
                  </td>
                ))}
                <td><button className="danger" aria-label="Supprimer" onClick={() => patch({ list: list.filter((x) => x.id !== c.id) })}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
