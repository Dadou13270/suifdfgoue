import React from 'react'
import { EngineCell, TextField } from './Cell.jsx'
import { cellKey, uid } from './util.js'

export const isAddable = (b) => !!b.addable

// Lignes ajoutées à la volée pour un jour donné (ex. « Autres »)
export default function ExtraRows({ b, day, config, onPatch, compact }) {
  const list = day.extra?.[b.id] || []
  const add = () => onPatch({ extra: { [b.id]: [...list, { id: uid(), label: '' }] } })
  const ren = (r, t) => onPatch({ extra: { [b.id]: list.map((x) => (x.id === r.id ? { ...x, label: t } : x)) } })
  const rm = (r) => onPatch({ extra: { [b.id]: list.filter((x) => x.id !== r.id) }, cells: { [cellKey(b.id, r.id)]: { text: '', status: '', auto: false } } })
  return (
    <div className={`extras ${compact ? 'compact' : ''}`}>
      {list.map((r) => (
        <div className="row extra" key={r.id}>
          <TextField value={r.label} placeholder="Intitulé" onCommit={(t) => ren(r, t)} />
          <EngineCell ckey={cellKey(b.id, r.id)} compact={compact} cell={day.cells?.[cellKey(b.id, r.id)]} legend={config.legend}
            onChange={(c) => onPatch({ cells: { [cellKey(b.id, r.id)]: c } })} />
          <button className="danger" aria-label="Retirer la ligne" onClick={() => rm(r)}>✕</button>
        </div>
      ))}
      <button className="addbtn" onClick={add}>+ Ajouter {compact ? '' : `à « ${b.title} »`}</button>
    </div>
  )
}
