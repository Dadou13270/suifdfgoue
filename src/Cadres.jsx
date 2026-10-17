import React, { useState } from 'react'
import { useDoc } from './store.js'
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
  const missing = (pers?.list || []).filter((p) => ['FDF4', 'FDF5'].includes(p.fdf) && !(doc?.list || []).some((c) => N(c.nom) === N(p.nom)))
  const [q, setQ] = useState('')
  const [g, setG] = useState('')
  const list = doc?.list || []
  const bes = doc?.besoins || []
  const set = (id, p) => patch({ list: list.map((c) => (c.id === id ? { ...c, ...p } : c)) })
  const shown = list.filter((c) => (!g || c.giff === g) && (!fd || fdfOf(c) === fd) && (!ml || (ml === 'oui' ? !!c.mil : !c.mil)) && (!q || `${c.nom} ${c.prenom}`.toLowerCase().includes(q.toLowerCase())))
  const totB = bes.reduce((a, b) => a + (Number(b.afournir) || 0), 0)
  const setB = (i, p) => patch({ besoins: bes.map((b, k) => (k === i ? { ...b, ...p } : b)) })

  return (
    <div>
      <div className="subbar">
        <b>Cadres COD VLTT / CDG <span className="muted">{shown.length}/{list.length}</span></b>
        <div className="actions">
          <input className="short" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="short" value={ml} onChange={(e) => setMl(e.target.value)}><option value="">MIL : tous</option><option value="oui">MIL cochés</option><option value="non">Hors MIL</option></select>
          <select className="short" value={fd} onChange={(e) => setFd(e.target.value)}><option value="">Tous FDF</option>{fdfs.map((x) => <option key={x}>{x}</option>)}</select>
          <button onClick={() => patch({ list: [...missing.map((p) => ({ id: uid(), grade: p.grade || '', nom: N(p.nom), prenom: p.prenom || '', dispos: 0, giff: '', mil: false, fonct: '', cdg: '', aff: '', just: '' })), ...list] })} disabled={!missing.length} title="Ajoute à la liste les FDF4 et FDF5 de Gestion du personnel">+ FDF4/5 du personnel{missing.length ? ` (${missing.length})` : ''}</button>
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
      <section className="card besoins">
        <h3>Sollicitations CIS (FDF3 à fournir en COD)</h3>
        <table className="week">
          <thead><tr><th>CIS</th><th>À fournir</th><th>Total dispo FDF3</th></tr></thead>
          <tbody>
            {bes.map((b, i) => (
              <tr key={i}><td><TextField value={b.cis} onCommit={(v) => setB(i, { cis: v })} /></td>
                <td><TextField value={String(b.afournir ?? '')} onCommit={(v) => setB(i, { afournir: Number(v) || 0 })} /></td>
                <td><TextField value={String(b.dispo ?? '')} onCommit={(v) => setB(i, { dispo: Number(v) || 0 })} /></td></tr>
            ))}
            <tr className="brow"><th>Total</th><th>{totB}</th><th>{bes.reduce((a, b) => a + (Number(b.dispo) || 0), 0)}</th></tr>
          </tbody>
        </table>
        <button onClick={() => patch({ besoins: [...bes, { cis: '', afournir: 0, dispo: 0 }] })}>+ CIS</button>
      </section>
    </div>
  )
}
