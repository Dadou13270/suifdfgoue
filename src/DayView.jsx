import React, { useContext, useState } from 'react'
import { EngineCell, TextField, Lookup, LocField, DutyField } from './Cell.jsx'
import { cellKey, listIdFor, guessFilter, blockName } from './util.js'
import { isAddable } from './ExtraRows.jsx'
import HeadLine from './HeadLine.jsx'
import CustomBlock, { ConfigBlock, AddBlockButton } from './CustomBlock.jsx'

export function Legend({ legend }) {
  return (
    <div className="legend">
      {legend.map((l) => (
        <span key={l.id} className="lg" title={l.desc}><i style={{ background: l.color }} />{l.label}</span>
      ))}
    </div>
  )
}

function Block({ b, config, day, onPatch }) {
  const { fix } = useContext(Lookup)
  const [open, setOpen] = useState(true)
  const head = day.heads?.[b.id]
  return (
    <section className="card block">
      <button className="bhead" onClick={() => setOpen(!open)}>
        <b>{blockName(b, day)}</b><span className="chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="bbody">
          {b.customName && <TextField className="headfield" value={day.names?.[b.id]} placeholder="Nom personnalisé (ex. Renfort CIS…)" onCommit={(t) => onPatch({ names: { [b.id]: t } })} />}
          {b.head && (b.headCis ? <HeadLine b={b} day={day} config={config} onPatch={onPatch} fix={fix} />
            : <div className={day.headsAuto?.[b.id] ? 'auto' : ''}><TextField className="headfield" value={head} fix={fix} placeholder={b.headHint || 'Chef / intitulé'}
            onCommit={(t) => onPatch({ heads: { [b.id]: t }, headsAuto: { [b.id]: false } })} /></div>)}
          {b.rows.map((r) => (
            <div className="row" key={r.id}>
              <label>{r.label}</label>
              <EngineCell cis={day.headCis?.[b.id]} filter={guessFilter(r)} listId={listIdFor(r)} cell={day.cells?.[cellKey(b.id, r.id)]} legend={config.legend}
                onChange={(c) => onPatch({ cells: { [cellKey(b.id, r.id)]: c } })} />
            </div>
          ))}
          {b.duty && (
            <div className="row loc">
              <label>🕒 Astreinte / Caserné</label>
              <DutyField value={day.duty?.[b.id]} lists={config.lists} onChange={(v) => onPatch({ duty: { [b.id]: v } })} />
            </div>
          )}
          {b.location && (
            <div className="row loc">
              <label>📍 Emplacement et horaires</label>
              <LocField value={day.locs?.[b.id]} lists={config.lists} onChange={(v) => onPatch({ locs: { [b.id]: v } })} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function DayView({ config, day, onPatch }) {
  return (
    <>
      <section className="card headcard">
        {config.header.map((h) => (
          <div className="hf" key={h.id}>
            <label>{h.label}</label>
            <select value={day.header?.[h.id] ?? ''} onChange={(e) => onPatch({ header: { [h.id]: e.target.value } })}>
              <option value="">—</option>
              {(config.lists[h.list] || []).map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </section>
      <Legend legend={config.legend} />
      {config.blocks.some((b) => b.section === 'cdt') && (
        <>
          <h3 className="sectitle">{config.cdtTitle || 'Chaîne de commandement'}</h3>
          <div className="grid">{config.blocks.filter((b) => b.section === 'cdt').map((b) => isAddable(b) ? <ConfigBlock key={b.id} b={b} config={config} day={day} onPatch={onPatch} /> : <Block key={b.id} b={b} config={config} day={day} onPatch={onPatch} />)}</div>
          <h3 className="sectitle">Dispositif</h3>
        </>
      )}
      <div className="grid">
        {config.blocks.filter((b) => b.section !== 'cdt').map((b) => isAddable(b) ? <ConfigBlock key={b.id} b={b} config={config} day={day} onPatch={onPatch} /> : <Block key={b.id} b={b} config={config} day={day} onPatch={onPatch} />)}
        {(day.customBlocks || []).map((b) => <CustomBlock key={b.id} b={b} config={config} day={day} onPatch={onPatch} />)}
      </div>
      <div className="line"><AddBlockButton day={day} onPatch={onPatch} /><span className="muted small">Bloc propre à ce jour. Pour un bloc permanent : Paramètres › Blocs.</span></div>
      <section className="card">
        <label className="lbl">Commentaire du jour</label>
        <textarea className="comment" defaultValue={day.comment || ''} key={day.comment}
          onBlur={(e) => e.target.value !== (day.comment || '') && onPatch({ comment: e.target.value })} />
      </section>
    </>
  )
}
