import React, { useState } from 'react'
import { useDoc } from './store.js'
import { TextField } from './Cell.jsx'
import { cellKey, uid, fmtLong } from './util.js'

export default function Calendrier({ config, date, onApply }) {
  const [doc, patch] = useDoc('calendar/main')
  const [edit, setEdit] = useState(false)
  const [msg, setMsg] = useState('')
  const lines = doc?.lines || []
  const len = doc?.length || 31
  const dom = Number(date.slice(8))
  const col = Math.min(dom, len) - 1
  const save = (l) => patch({ lines: l })
  const setLine = (id, p) => save(lines.map((l) => (l.id === id ? { ...l, ...p } : l)))
  const groups = [...new Set(lines.map((l) => l.group))]
  const targets = config.blocks.flatMap((b) => b.rows.map((r) => [`${b.id}:${r.id}`, `${b.title} · ${r.label}`]))

  const apply = () => {
    const cells = {}
    let n = 0
    lines.forEach((l) => {
      const v = (l.vals?.[col] || '').trim()
      if (!l.target || !v) return
      const [b, r] = l.target.split(':')
      cells[cellKey(b, r)] = { text: v }; n++
    })
    onApply({ cells }); setMsg(`${n} cellules du dispositif remplies pour le ${fmtLong(date)}.`)
  }

  return (
    <div>
      <div className="subbar">
        <div><b>Jour {dom}</b> <span className="muted">du calendrier (calendrier perpétuel par quantième)</span></div>
        <div className="actions">
          <button className="primary" onClick={apply} disabled={!lines.length}>Appliquer au dispositif du {date.slice(8)}/{date.slice(5, 7)}</button>
          <button className={edit ? 'primary' : ''} onClick={() => setEdit(!edit)}>{edit ? 'Terminer' : 'Modifier'}</button>
        </div>
      </div>
      {msg && <div className="banner">{msg}</div>}
      {doc && !lines.length && <p className="muted">Calendrier vide. Importez les données du classeur (Paramètres › Données).</p>}
      <div className="tablewrap">
        <table className="week caltable">
          <thead>
            <tr><th className="sticky">Ligne</th>{edit && <th>Cible dispositif</th>}
              {Array.from({ length: len }, (_, i) => <th key={i} className={i === col ? 'curcol' : ''}>{i + 1}</th>)}</tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <React.Fragment key={g}>
                <tr className="brow"><th className="sticky" colSpan={1}>{g}</th><td colSpan={len + (edit ? 1 : 0)} /></tr>
                {lines.filter((l) => l.group === g).map((l) => (
                  <tr key={l.id}>
                    <th className="sticky sub">{edit ? <TextField value={l.label} onCommit={(t) => setLine(l.id, { label: t })} /> : l.label}</th>
                    {edit && <td><select value={l.target || ''} onChange={(e) => setLine(l.id, { target: e.target.value })}>
                      <option value="">— aucune</option>{targets.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
                      <button className="danger" onClick={() => save(lines.filter((x) => x.id !== l.id))}>✕</button></td>}
                    {Array.from({ length: len }, (_, i) => (
                      <td key={i} className={i === col ? 'curcol' : ''}>
                        <TextField value={l.vals?.[i]} onCommit={(t) => { const v = [...(l.vals || [])]; v[i] = t; while (v.length < len) v.push(''); setLine(l.id, { vals: v }) }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <div className="line"><button onClick={() => save([...lines, { id: uid(), group: groups[0] || 'Nouveau groupe', label: 'Nouvelle ligne', vals: Array(len).fill(''), target: '' }])}>+ Ligne</button></div>}
    </div>
  )
}
