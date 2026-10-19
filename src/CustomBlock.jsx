import React, { useState } from 'react'
import { EngineCell, TextField, LocField, NotifyBar } from './Cell.jsx'
import { cellKey, uid, listIdFor, guessFilter, effBlock, paxOf } from './util.js'
import { useEngage } from './engage.js'

export const newBlock = () => ({ id: uid(), title: 'Autre bloc', head: false, location: false, rows: [{ id: uid(), label: 'Ligne 1' }] })

// Carte de bloc configurable (⚙) : nom, lignes, intitulé, emplacement et horaires.
// update(p, extra) enregistre la définition du bloc ; onDelete / onReset facultatifs.
export function BlockCard({ off, b, day, config, onPatch, compact, update, onDelete, onReset, titleExtra }) {
  const [edit, setEdit] = useState(false)
  const engage = useEngage()
  const clearRow = (r) => ({ [cellKey(b.id, r.id)]: { text: '', status: '', auto: false } })
  const delRow = (r) => update({ rows: b.rows.filter((y) => y.id !== r.id) }, { cells: clearRow(r) })
  const setRowLabel = (r, t) => update({ rows: b.rows.map((y) => (y.id === r.id ? { ...y, label: t } : y)) })

  return (
    <section className={`card block custom ${compact ? 'compact' : ''} ${off ? 'off' : ''}`}>
      <div className="bhead static">
        {edit ? <TextField className="headfield" value={b.title} onCommit={(t) => update({ title: t })} /> : <b>{b.title}{titleExtra}</b>}
        {!edit && paxOf(config, b, day) > 0 && <span className="pax">{paxOf(config, b, day)} PAX</span>}
        <button className={edit ? 'primary' : ''} onClick={() => setEdit(!edit)} aria-label="Configurer le bloc" title="Configurer le bloc">{edit ? 'OK' : '⚙'}</button>
      </div>
      {edit && (
        <div className="bedit-inline">
          <label className="chk"><input type="checkbox" checked={!!b.head} onChange={(e) => update({ head: e.target.checked })} /> Ligne d'intitulé</label>
          <label className="chk"><input type="checkbox" checked={!!b.location} onChange={(e) => update({ location: e.target.checked })} /> Emplacement et horaires</label>
          {b.rows.map((r) => (
            <div className="line" key={r.id}>
              <TextField value={r.label} onCommit={(t) => setRowLabel(r, t)} />
              <button className="danger" aria-label="Supprimer la ligne" onClick={() => delRow(r)}>✕</button>
            </div>
          ))}
          <div className="line wrap">
            <button onClick={() => update({ rows: [...b.rows, { id: uid(), label: `Ligne ${b.rows.length + 1}` }] })}>+ Ligne</button>
            {onReset && <button onClick={onReset}>Configuration d'origine</button>}
            {onDelete && <button className="danger" onClick={onDelete}>Supprimer le bloc</button>}
          </div>
        </div>
      )}
      <div className="bbody">
        {b.head && <TextField className="headfield" value={day.heads?.[b.id]} placeholder={b.headHint || 'Chef / intitulé'} onCommit={(t) => onPatch({ heads: { [b.id]: t } })} />}
        {b.rows.map((r) => (
          <div className="row" key={r.id}>
            <label>{r.label}</label>
            <EngineCell ckey={cellKey(b.id, r.id)} filter={guessFilter(r)} compact={compact} listId={listIdFor(r)} cell={day.cells?.[cellKey(b.id, r.id)]} legend={config.legend}
              onChange={(c) => onPatch({ cells: { [cellKey(b.id, r.id)]: c }, ...(day.notif?.[b.id] && (c?.text || '') !== (day.cells?.[cellKey(b.id, r.id)]?.text || '') ? { notif: { [b.id]: null } } : {}) })} />
          </div>
        ))}
        {b.location && (
          <div className="row loc">
            <label>📍 Emplacement et horaires</label>
            <LocField compact={compact} value={day.locs?.[b.id]} lists={config.lists} onChange={(v) => onPatch({ locs: { [b.id]: v } })} />
          </div>
        )}
        {b.rows.length > 0 && <NotifyBar label={b.section === 'cdt' ? 'Cadres informés' : 'CIS informés'} compact={compact} notif={day.notif?.[b.id]} onNotif={(v) => onPatch({ notif: { [b.id]: v } })} engaged={day.engaged?.[b.id]} onEngaged={(v) => { engage(b, day, v); onPatch({ engaged: { [b.id]: v } }) }} aladin={day.aladin?.[b.id]} onAladin={(v) => { engage(b, day, v, 'aladin'); onPatch({ aladin: { [b.id]: v } }) }} />}
      </div>
    </section>
  )
}

// Bloc créé pour ce jour uniquement
export default function CustomBlock({ b, day, config, onPatch, compact }) {
  const list = day.customBlocks || []
  const update = (p, extra = {}) => onPatch({ customBlocks: list.map((x) => (x.id === b.id ? { ...x, ...p } : x)), ...extra })
  const onDelete = () => {
    const cells = {}; b.rows.forEach((r) => { cells[cellKey(b.id, r.id)] = { text: '', status: '', auto: false } })
    onPatch({ customBlocks: list.filter((x) => x.id !== b.id), cells, heads: { [b.id]: '' }, locs: { [b.id]: { place: '', start: '', end: '' } } })
  }
  return <BlockCard {...{ b, day, config, onPatch, compact, update, onDelete }} />
}

// Bloc de la configuration (ex. « Autres ») : mêmes réglages, propres au jour affiché
export function ConfigBlock({ b, day, config, onPatch, compact, off }) {
  const eb = effBlock(b, day)
  const has = !!day.overrides?.[b.id]
  const update = (p, extra = {}) => onPatch({ overrides: { [b.id]: { title: eb.title, head: !!eb.head, location: !!eb.location, headHint: eb.headHint || '', rows: eb.rows, ...p } }, ...extra })
  const suffix = day.names?.[b.id] ? ` · ${day.names[b.id]}` : ''
  return <BlockCard {...{ off, b: eb, day, config, onPatch, compact, update, titleExtra: suffix, onReset: has ? () => onPatch({ overrides: { [b.id]: null } }) : null }} />
}

export function AddBlockButton({ day, onPatch, compact }) {
  return <button className="addbtn" onClick={() => onPatch({ customBlocks: [...(day.customBlocks || []), newBlock()] })}>+ {compact ? 'Bloc' : 'Ajouter un bloc'}</button>
}
